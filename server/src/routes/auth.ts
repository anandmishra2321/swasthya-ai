import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { User, IUser, UserRole } from '../models/User';
import { PatientProfile } from '../models/PatientProfile';
import { DoctorProfile } from '../models/DoctorProfile';
import { Membership } from '../models/Membership';
import { MembershipRole } from '../models/Membership';
import { OrganizationInvitation } from '../models/OrganizationInvitation';
import { Organization } from '../models/Organization';
import { Session } from '../models/Session';
import { authenticate, generateTokens, AuthRequest } from '../middlewares/auth';
import { validateBody } from '../middlewares/validate';
import { rateLimit } from '../middlewares/rateLimit';
import { logAuditEvent } from '../services/auditService';
import { sendPasswordResetEmail } from '../services/emailService';
import { listWorkspacesForUser } from '../services/workspaceService';
import { sendError, sendOk, sendNotConfigured, ErrorCode } from '../utils/response';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import mongoose from 'mongoose';

const router = Router();

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Refresh tokens are stored as SHA-256 digests, never in plaintext. */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Records a refresh token so it can be revoked or rotated later. */
async function createSession(
  user: IUser,
  refreshToken: string,
  req: { headers: Record<string, any>; ip?: string },
  rotatedFrom?: mongoose.Types.ObjectId
): Promise<mongoose.Types.ObjectId> {
  const session = await Session.create({
    userId: user._id,
    refreshTokenHash: hashToken(refreshToken),
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
    ipAddress: req.ip,
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    rotatedFrom,
  });
  return session._id as mongoose.Types.ObjectId;
}

/** Revokes every live session for a user (used on reset / suspected reuse). */
async function revokeAllSessions(userId: mongoose.Types.ObjectId | string, reason: string): Promise<number> {
  const result = await Session.updateMany(
    { userId, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date(), revokedReason: reason } }
  );
  return result.modifiedCount ?? 0;
}

// Abuse protection. In-process only — see rateLimit.ts for the multi-instance caveat.
const signupLimiter = rateLimit({ name: 'signup:ip', windowMs: 60 * 60 * 1000, max: 10 });
const loginLimiter = rateLimit({ name: 'login:ip', windowMs: 15 * 60 * 1000, max: 30 });
const forgotPasswordLimiter = rateLimit({ name: 'forgot:ip', windowMs: 60 * 60 * 1000, max: 5 });
const invitationAcceptLimiter = rateLimit({ name: 'invitation-accept:ip', windowMs: 60 * 60 * 1000, max: 10 });

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(12, 'Password must be at least 12 characters'),
  phone: z.string().optional(),
  preferredLanguage: z.enum(['en', 'hi']).default('en'),
  role: z.string().optional(),
}).strict();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const acceptInvitationSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/i),
  name: z.string().min(2),
  password: z.string().min(12),
  phone: z.string().optional(),
}).strict();

function accountRoleForInvitation(role: MembershipRole, organizationType: string): UserRole {
  if (role === 'clinic_admin') {
    return organizationType === 'homeopathy_clinic' ? 'homeopathy_clinic_admin' : 'private_clinic_admin';
  }
  if (role === 'store_owner') return 'medical_store_owner';
  return role as UserRole;
}

// POST /api/v1/auth/signup
router.post('/signup', signupLimiter, validateBody(signupSchema), async (req: any, res: Response): Promise<void> => {
  const { name, email, password, phone, preferredLanguage, role: requestedRole } = req.body;

  const allowedSelfSignupRoles = [
    'patient',
    'hospital_doctor',
    'private_doctor',
    'homeopathy_doctor',
    'hospital_admin',
    'hospital_receptionist',
    'medical_store_owner',
    'lab_admin',
    'nurse',
    'bed_manager',
    'doctor_assistant',
    'healthcare_support_agent',
    'public_health_admin',
  ];

  let role: UserRole = 'patient';
  if (requestedRole) {
    if (!env.ALLOW_ROLE_SIGNUP || !allowedSelfSignupRoles.includes(requestedRole)) {
      sendError(res, 400, ErrorCode.VALIDATION_FAILED, 'Role selection is not available for public registration.');
      return;
    }
    role = requestedRole as UserRole;
  }

  if (env.NODE_ENV === 'production') {
    sendError(
      res,
      503,
      ErrorCode.INTEGRATION_NOT_CONFIGURED,
      'Patient registration is unavailable until an email verification delivery provider is configured.'
    );
    return;
  }

  try {
    const existing = await User.findOne({ email });
    if (existing) {
      sendError(res, 400, ErrorCode.VALIDATION_FAILED, 'An account with this email already exists.');
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const verificationToken = crypto.randomBytes(24).toString('hex');

    const user = await User.create({
      name,
      email,
      passwordHash,
      phone,
      role: role as UserRole,
      preferredLanguage,
      verificationToken,
      verificationTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      isEmailVerified: false,
      isDemoAccount: false,
    });

    // Create corresponding profile
    if (role === 'patient') {
      await PatientProfile.create({
        userId: user._id,
        allergies: [],
        chronicConditions: [],
        currentMedications: [],
        dependents: [],
        consentSharing: false,
      });
    }

    const tokens = generateTokens(user);
    await createSession(user, tokens.refreshToken, req as any);

    await logAuditEvent({
      actorId: user._id as mongoose.Types.ObjectId,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'USER_SIGNUP',
      ipAddress: req.ip,
      details: { role: user.role },
    });

    res.status(201).json({
      success: true,
      message: 'Account created successfully. Please verify your email.',
      demoVerificationLink: `/verify-email?token=${verificationToken}`,
      verificationToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        preferredLanguage: user.preferredLanguage,
      },
      ...tokens,
    });
  } catch (err: any) {
    logger.error('Signup failed with an unexpected error', { error: err?.message });
    sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
  }
});

// POST /api/v1/auth/login
router.post('/login', loginLimiter, validateBody(loginSchema), async (req: any, res: Response): Promise<void> => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      sendError(res, 401, ErrorCode.UNAUTHENTICATED, 'Invalid email or password credentials.');
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      sendError(res, 401, ErrorCode.UNAUTHENTICATED, 'Invalid email or password credentials.');
      return;
    }

    // Get user's approved organizations and memberships
    const workspaces = await listWorkspacesForUser(user._id as mongoose.Types.ObjectId);

    const tokens = generateTokens(user, user.activeWorkspaceId?.toString());
    await createSession(user, tokens.refreshToken, req as any);

    await logAuditEvent({
      actorId: user._id as mongoose.Types.ObjectId,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'USER_LOGIN',
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Login successful.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        preferredLanguage: user.preferredLanguage,
        activeWorkspaceId: user.activeWorkspaceId,
        isDemoAccount: user.isDemoAccount,
      },
      workspaces,
      ...tokens,
    });
  } catch (err: any) {
    logger.error('Login failed with an unexpected error', { error: err?.message });
    sendError(res, 500, ErrorCode.INTERNAL, 'Unable to complete sign-in right now.');
  }
});

// POST /api/v1/auth/verify-email
router.post('/verify-email', async (req: any, res: Response): Promise<void> => {
  const { token } = req.body;
  if (!token) {
    sendError(res, 400, ErrorCode.VALIDATION_FAILED, 'Verification token is required.');
    return;
  }

  try {
    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpiresAt: { $gt: new Date() },
    });
    if (!user) {
      sendError(res, 400, ErrorCode.VALIDATION_FAILED, 'Invalid or expired verification token.');
      return;
    }

    user.isEmailVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpiresAt = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Email address verified successfully! You can now log in.',
    });
  } catch (err: any) {
    logger.error('Email verification failed with an unexpected error', { error: err?.message });
    sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
  }
});

// POST /api/v1/auth/accept-invitation
router.post(
  '/accept-invitation',
  invitationAcceptLimiter,
  validateBody(acceptInvitationSchema),
  async (req: any, res: Response): Promise<void> => {
    const tokenHash = crypto.createHash('sha256').update(req.body.token).digest('hex');
    const now = new Date();
    let invitation;
    try {
      invitation = await OrganizationInvitation.findOneAndUpdate(
        {
          tokenHash,
          status: 'pending',
          expiresAt: { $gt: now },
          $or: [{ processingUntil: { $exists: false } }, { processingUntil: { $lte: now } }],
        },
        { $set: { status: 'processing', processingUntil: new Date(now.getTime() + 5 * 60 * 1000) } },
        { new: true }
      );
    } catch (err: any) {
      logger.error('Failed to validate organization invitation', { error: err?.message });
      sendError(res, 500, ErrorCode.INTERNAL, 'Unable to validate this invitation right now.');
      return;
    }

    if (!invitation) {
      sendError(res, 400, ErrorCode.VALIDATION_FAILED, 'Invitation is invalid, expired, or already used.');
      return;
    }

    let createdUser: IUser | undefined;
    let createdMembership = false;
    let updatedMembershipId: mongoose.Types.ObjectId | undefined;

    try {
      const organization = await Organization.findById(invitation.organizationId);
      if (!organization) {
        await OrganizationInvitation.updateOne(
          { _id: invitation._id, status: 'processing' },
          { $set: { status: 'pending' }, $unset: { processingUntil: 1 } }
        );
        sendError(res, 404, ErrorCode.NOT_FOUND, 'The organization for this invitation no longer exists.');
        return;
      }

      let user = await User.findOne({ email: invitation.email });
      if (user) {
        if (!(await user.comparePassword(req.body.password))) {
          await OrganizationInvitation.updateOne(
            { _id: invitation._id, status: 'processing' },
            { $set: { status: 'pending' }, $unset: { processingUntil: 1 } }
          );
          sendError(res, 401, ErrorCode.UNAUTHENTICATED, 'The password for this account is incorrect.');
          return;
        }
      } else {
        const passwordHash = await bcrypt.hash(req.body.password, await bcrypt.genSalt(12));
        user = await User.create({
          name: req.body.name,
          email: invitation.email,
          phone: req.body.phone,
          passwordHash,
          role: accountRoleForInvitation(invitation.role, organization.type),
          isEmailVerified: true,
          isDemoAccount: false,
        });
        createdUser = user;

        if (user.role.includes('doctor')) {
          await DoctorProfile.create({
            userId: user._id,
            specialty: 'Not specified',
            qualifications: [],
            registrationNumber: '',
            isHomeopathy: user.role.includes('homeopathy'),
            isVerified: false,
          });
        }
      }

      const existingMembership = await Membership.findOne({
        userId: user._id,
        organizationId: invitation.organizationId,
      });
      if (existingMembership && existingMembership.status !== 'invited') {
        await OrganizationInvitation.updateOne(
          { _id: invitation._id, status: 'processing' },
          { $set: { status: 'pending' }, $unset: { processingUntil: 1 } }
        );
        sendError(res, 409, ErrorCode.CONFLICT, 'This account already has an active or suspended organization membership.');
        return;
      }

      if (existingMembership) {
        updatedMembershipId = existingMembership._id as mongoose.Types.ObjectId;
        existingMembership.role = invitation.role;
        existingMembership.department = invitation.department;
        existingMembership.status = 'active';
        existingMembership.invitedBy = invitation.invitedBy;
        await existingMembership.save();
      } else {
        await Membership.create({
          userId: user._id,
          organizationId: invitation.organizationId,
          role: invitation.role,
          department: invitation.department,
          status: 'active',
          invitedBy: invitation.invitedBy,
        });
        createdMembership = true;
      }

      const finalized = await OrganizationInvitation.updateOne(
        { _id: invitation._id, status: 'processing' },
        { $set: { status: 'accepted', acceptedAt: new Date() }, $unset: { processingUntil: 1 } }
      );
      if (finalized.modifiedCount !== 1) {
        throw new Error('Invitation could not be finalized.');
      }

      await logAuditEvent({
        actorId: user._id as mongoose.Types.ObjectId,
        actorEmail: user.email,
        actorRole: user.role,
        action: 'MEMBER_INVITATION_ACCEPTED',
        organizationId: invitation.organizationId,
        details: { role: invitation.role, invitationId: invitation._id },
      });

      const tokens = generateTokens(user, invitation.organizationId.toString());
      await createSession(user, tokens.refreshToken, req as any);
      res.json({
        success: true,
        message: 'Invitation accepted.',
        user: { id: user._id, name: user.name, email: user.email, role: user.role },
        activeWorkspaceId: invitation.organizationId,
        workspaceRole: invitation.role,
        ...tokens,
      });
    } catch (err: any) {
      if (createdMembership) {
        await Membership.deleteOne({ userId: createdUser?._id, organizationId: invitation.organizationId });
      } else if (updatedMembershipId) {
        await Membership.updateOne(
          { _id: updatedMembershipId },
          { $set: { status: 'invited' } }
        );
      }
      if (createdUser) {
        await DoctorProfile.deleteOne({ userId: createdUser._id });
        await User.deleteOne({ _id: createdUser._id });
      }
      await OrganizationInvitation.updateOne(
        { _id: invitation._id, status: 'processing' },
        { $set: { status: 'pending' }, $unset: { processingUntil: 1 } }
      );
      logger.error('Failed to accept organization invitation', { error: err?.message });
      sendError(res, 500, ErrorCode.INTERNAL, 'Unable to accept this invitation right now.');
    }
  }
);

// GET /api/v1/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const memberships = await Membership.find({ userId: user._id, status: 'active' }).populate('organizationId');
    const ownedOrgs = await Organization.find({ ownerId: user._id });

    let profileData: any = null;
    if (user.role === 'patient') {
      profileData = await PatientProfile.findOne({ userId: user._id });
    } else if (user.role.includes('doctor')) {
      profileData = await DoctorProfile.findOne({ userId: user._id });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        preferredLanguage: user.preferredLanguage,
        activeWorkspaceId: req.activeWorkspaceId || user.activeWorkspaceId,
        workspaceRole: req.workspaceRole,
        isDemoAccount: user.isDemoAccount,
      },
      profile: profileData,
      workspaces: [
        ...memberships.map((m: any) => ({
          membershipId: m._id,
          organizationId: m.organizationId?._id,
          organizationName: m.organizationId?.name,
          organizationType: m.organizationId?.type,
          role: m.role,
        })),
        ...ownedOrgs.map((o: any) => ({
          membershipId: null,
          organizationId: o._id,
          organizationName: o.name,
          organizationType: o.type,
          role: 'owner',
        })),
      ],
    });
  } catch (err: any) {
    logger.error('Failed to load current user with an unexpected error', { error: err?.message });
    sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
  }
});

// POST /api/v1/auth/switch-workspace
router.post('/switch-workspace', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { organizationId } = req.body;

  try {
    const user = req.user!;

    if (!organizationId) {
      user.activeWorkspaceId = undefined;
      await user.save();
      const tokens = generateTokens(user);
      res.json({ success: true, message: 'Switched to personal workspace.', ...tokens });
      return;
    }

    // Verify user is member or owner of organization
    const org = await Organization.findById(organizationId);
    if (!org) {
      sendError(res, 404, ErrorCode.NOT_FOUND, 'Organization not found.');
      return;
    }

    const isOwner = org.ownerId?.toString() === (user._id as mongoose.Types.ObjectId).toString();
    const membership = await Membership.findOne({ userId: user._id, organizationId, status: 'active' });

    if (!isOwner && !membership && user.role !== 'platform_super_admin') {
      sendError(res, 403, ErrorCode.FORBIDDEN, 'You are not an authorized member of this organization.');
      return;
    }

    user.activeWorkspaceId = org._id as mongoose.Types.ObjectId;
    await user.save();

    const tokens = generateTokens(user, org._id.toString());

    await logAuditEvent({
      actorId: user._id as mongoose.Types.ObjectId,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'WORKSPACE_SWITCH',
      organizationId: org._id as mongoose.Types.ObjectId,
      details: { organizationName: org.name },
    });

    res.json({
      success: true,
      message: `Workspace switched to ${org.name}.`,
      workspace: {
        organizationId: org._id,
        organizationName: org.name,
        organizationType: org.type,
        role: isOwner ? 'owner' : membership?.role,
      },
      ...tokens,
    });
  } catch (err: any) {
    logger.error('Workspace switch failed with an unexpected error', { error: err?.message });
    sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
  }
});

// POST /api/v1/auth/refresh
const refreshSchema = z.object({ refreshToken: z.string().min(10, 'A refresh token is required.') });

router.post('/refresh', validateBody(refreshSchema), async (req: any, res: Response): Promise<void> => {
  const { refreshToken } = req.body;

  let decoded: { userId: string };
  try {
    decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { userId: string };
  } catch {
    sendError(res, 401, ErrorCode.UNAUTHENTICATED, 'Refresh token is invalid or expired. Please sign in again.');
    return;
  }

  const session = await Session.findOne({ refreshTokenHash: hashToken(refreshToken) });

  if (!session) {
    sendError(res, 401, ErrorCode.UNAUTHENTICATED, 'This session is no longer valid. Please sign in again.');
    return;
  }

  // A revoked token being presented means it leaked: kill the whole family.
  if (session.revokedAt) {
    const revoked = await revokeAllSessions(session.userId, 'refresh_token_reuse_detected');
    await logAuditEvent({
      actorId: session.userId,
      actorEmail: 'unknown',
      actorRole: 'unknown',
      action: 'REFRESH_TOKEN_REUSE_DETECTED',
      ipAddress: req.ip,
      details: { sessionsRevoked: revoked },
    });
    logger.warn('Refresh token reuse detected; all sessions revoked', { userId: session.userId.toString() });
    sendError(
      res,
      401,
      ErrorCode.UNAUTHENTICATED,
      'This session was already used. For safety every session on the account has been revoked — please sign in again.'
    );
    return;
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    sendError(res, 401, ErrorCode.UNAUTHENTICATED, 'Refresh token has expired. Please sign in again.');
    return;
  }

  const user = await User.findById(session.userId || decoded.userId);
  if (!user) {
    sendError(res, 401, ErrorCode.UNAUTHENTICATED, 'Account not found. Please sign in again.');
    return;
  }

  const tokens = generateTokens(user, user.activeWorkspaceId?.toString());

  // Rotate: the presented token is single-use.
  session.revokedAt = new Date();
  session.revokedReason = 'rotated';
  await session.save();
  await createSession(user, tokens.refreshToken, req, session._id as mongoose.Types.ObjectId);

  sendOk(res, {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    activeWorkspaceId: user.activeWorkspaceId,
  });
});

// POST /api/v1/auth/logout
const logoutSchema = z.object({
  refreshToken: z.string().optional(),
  allDevices: z.boolean().optional(),
});

router.post('/logout', authenticate, validateBody(logoutSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  const user = req.user!;
  const { refreshToken, allDevices } = req.body;

  let sessionsRevoked = 0;

  if (allDevices) {
    sessionsRevoked = await revokeAllSessions(user._id as mongoose.Types.ObjectId, 'logout_all_devices');
  } else if (refreshToken) {
    const result = await Session.updateOne(
      { refreshTokenHash: hashToken(refreshToken), userId: user._id, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date(), revokedReason: 'logout' } }
    );
    sessionsRevoked = result.modifiedCount ?? 0;
  }

  await logAuditEvent({
    actorId: user._id as mongoose.Types.ObjectId,
    actorEmail: user.email,
    actorRole: user.role,
    action: 'USER_LOGOUT',
    ipAddress: req.ip,
    details: { sessionsRevoked, allDevices: !!allDevices },
  });

  sendOk(res, { loggedOut: true, sessionsRevoked });
});

// POST /api/v1/auth/forgot-password
const forgotSchema = z.object({ email: z.string().email('A valid email address is required.') });

router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  validateBody(forgotSchema),
  async (req: any, res: Response): Promise<void> => {
    const { email } = req.body;

    try {
      const user = await User.findOne({ email });

      // Identical response either way so this endpoint cannot enumerate accounts.
      if (!user) {
        sendOk(res, {
          message: 'If an account exists for that email address, the password reset request has been recorded.',
          delivery: { channel: 'email', status: 'not_configured', notice: 'No email was sent in this local demo.' },
        });
        return;
      }

      const rawToken = crypto.randomBytes(32).toString('hex');
      user.resetPasswordToken = hashToken(rawToken);
      user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();

      // Send password reset email (will use demo mode in development)
      await sendPasswordResetEmail(user.email, rawToken, env.FRONTEND_ORIGIN || 'http://localhost:5173');

      await logAuditEvent({
        actorId: user._id as mongoose.Types.ObjectId,
        actorEmail: user.email,
        actorRole: user.role,
        action: 'PASSWORD_RESET_REQUESTED',
        ipAddress: req.ip,
      });

      sendOk(res, {
        message: 'If an account exists for that email address, the password reset request has been recorded.',
        delivery: { channel: 'email', status: 'not_configured', notice: 'No email was sent in this local demo.' },
        demoResetLink: `/reset-password?token=${rawToken}`,
      });
    } catch (err: any) {
      logger.error('Password reset request failed', { error: err?.message });
      sendError(res, 500, ErrorCode.INTERNAL, 'Unable to process the request right now.');
    }
  }
);

// POST /api/v1/auth/reset-password
const resetSchema = z.object({
  token: z.string().min(10, 'A reset token is required.'),
  newPassword: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .max(200)
    .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), {
      message: 'Password must contain at least one letter and one number',
    }),
});

router.post('/reset-password', validateBody(resetSchema), async (req: any, res: Response): Promise<void> => {
  const { token, newPassword } = req.body;

  try {
    const user = await User.findOne({
      resetPasswordToken: hashToken(token),
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      sendError(
        res,
        400,
        ErrorCode.VALIDATION_FAILED,
        'This password reset link is invalid or has expired. Please request a new one.'
      );
      return;
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // A password change invalidates every existing session.
    const sessionsRevoked = await revokeAllSessions(user._id as mongoose.Types.ObjectId, 'password_reset');

    await logAuditEvent({
      actorId: user._id as mongoose.Types.ObjectId,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'PASSWORD_RESET_COMPLETED',
      ipAddress: req.ip,
      details: { sessionsRevoked },
    });

    sendOk(res, {
      message: 'Password updated. Please sign in with your new password.',
      sessionsRevoked,
    });
  } catch (err: any) {
    logger.error('Password reset failed', { error: err?.message });
    sendError(res, 500, ErrorCode.INTERNAL, 'Unable to reset the password right now.');
  }
});

export default router;
