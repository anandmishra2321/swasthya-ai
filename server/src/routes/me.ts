import { Router, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { authenticate, generateTokens, AuthRequest } from '../middlewares/auth';
import { validateBody } from '../middlewares/validate';
import { sendOk, sendError, ErrorCode } from '../utils/response';
import { listWorkspacesForUser, resolveWorkspaceAccess } from '../services/workspaceService';
import { logAuditEvent } from '../services/auditService';
import { User } from '../models/User';
import { PatientProfile } from '../models/PatientProfile';
import { DoctorProfile } from '../models/DoctorProfile';

const router = Router();

const switchSchema = z.object({
  organizationId: z.string().nullable().optional(),
});

function publicUser(user: any, activeWorkspaceId?: string, workspaceRole?: string) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    preferredLanguage: user.preferredLanguage,
    activeWorkspaceId: activeWorkspaceId ?? user.activeWorkspaceId,
    workspaceRole,
    isDemoAccount: user.isDemoAccount,
  };
}

// GET /api/v1/me
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = req.user!;

  let profile: unknown = null;
  if (user.role === 'patient') {
    profile = await PatientProfile.findOne({ userId: user._id });
  } else if (user.role.includes('doctor')) {
    profile = await DoctorProfile.findOne({ userId: user._id });
  }

  sendOk(res, {
    user: publicUser(user, req.activeWorkspaceId?.toString(), req.workspaceRole),
    profile,
  });
});

// GET /api/v1/me/workspaces
router.get('/workspaces', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const workspaces = await listWorkspacesForUser(req.user!._id as mongoose.Types.ObjectId);
  sendOk(res, { workspaces }, { total: workspaces.length });
});

// POST /api/v1/me/workspaces/:id/switch
router.post('/workspaces/:id/switch', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = req.user!;
  const organizationId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(organizationId)) {
    sendError(res, 400, ErrorCode.VALIDATION_FAILED, 'Invalid workspace id.', [
      { field: 'id', message: 'Not a valid identifier.' },
    ]);
    return;
  }

  const access = await resolveWorkspaceAccess(user._id as mongoose.Types.ObjectId, organizationId, user.role);
  if (!access.allowed) {
    // Same response whether the org is missing or forbidden-by-role, so this
    // endpoint cannot be used to probe which organizations exist.
    sendError(res, 403, ErrorCode.FORBIDDEN, 'You do not have an approved workspace for this organization.');
    return;
  }

  user.activeWorkspaceId = access.organization._id as mongoose.Types.ObjectId;
  await user.save();

  const tokens = generateTokens(user, access.organization._id.toString());

  await logAuditEvent({
    actorId: user._id as mongoose.Types.ObjectId,
    actorEmail: user.email,
    actorRole: user.role,
    action: 'WORKSPACE_SWITCH',
    organizationId: access.organization._id as mongoose.Types.ObjectId,
    details: { organizationName: access.organization.name, via: 'me/workspaces' },
  });

  sendOk(res, {
    activeWorkspaceId: access.organization._id.toString(),
    workspaceRole: access.role,
    user: publicUser(user, access.organization._id.toString(), access.role ?? undefined),
    ...tokens,
  });
});

// PATCH /api/v1/me — self-service, non-privileged profile fields only.
const updateMeSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: z.string().min(6).max(20).optional(),
  preferredLanguage: z.enum(['en', 'hi']).optional(),
});

router.patch('/', authenticate, validateBody(updateMeSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await User.findById(req.user!._id);
  if (!user) {
    sendError(res, 404, ErrorCode.NOT_FOUND, 'Account not found.');
    return;
  }

  // Role, email-verification state and organization scope are deliberately not
  // updatable here: identity fields require a verification flow, not a PATCH.
  if (req.body.name !== undefined) user.name = req.body.name;
  if (req.body.phone !== undefined) user.phone = req.body.phone;
  if (req.body.preferredLanguage !== undefined) user.preferredLanguage = req.body.preferredLanguage;
  await user.save();

  sendOk(res, { user: publicUser(user) });
});

// GET /api/v1/me/dependents
router.get('/dependents', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = req.user!;
  if (user.role !== 'patient') {
    sendError(res, 403, ErrorCode.FORBIDDEN, 'Only patients can manage dependents.');
    return;
  }
  const profile = await PatientProfile.findOne({ userId: user._id });
  sendOk(res, { dependents: profile?.dependents || [] });
});

// POST /api/v1/me/dependents
const dependentSchema = z.object({
  name: z.string().min(2),
  relation: z.string().min(2),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  allergies: z.array(z.string()).optional(),
});
router.post('/dependents', authenticate, validateBody(dependentSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  const user = req.user!;
  if (user.role !== 'patient') {
    sendError(res, 403, ErrorCode.FORBIDDEN, 'Only patients can manage dependents.');
    return;
  }
  const profile = await PatientProfile.findOne({ userId: user._id });
  if (!profile) {
    sendError(res, 404, ErrorCode.NOT_FOUND, 'Patient profile not found.');
    return;
  }
  profile.dependents = profile.dependents || [];
  profile.dependents.push(req.body);
  await profile.save();
  sendOk(res, { dependents: profile.dependents }, { status: 201 });
});

// DELETE /api/v1/me/dependents/:index
router.delete('/dependents/:index', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = req.user!;
  if (user.role !== 'patient') {
    sendError(res, 403, ErrorCode.FORBIDDEN, 'Only patients can manage dependents.');
    return;
  }
  const idx = parseInt(req.params.index, 10);
  const profile = await PatientProfile.findOne({ userId: user._id });
  if (!profile || !profile.dependents || idx < 0 || idx >= profile.dependents.length) {
    sendError(res, 404, ErrorCode.NOT_FOUND, 'Dependent not found.');
    return;
  }
  profile.dependents.splice(idx, 1);
  await profile.save();
  sendOk(res, { dependents: profile.dependents });
});

import { createPdfBuffer } from '../utils/pdf';

// GET /api/v1/me/summary/pdf - Download patient summary as PDF
router.get('/summary/pdf', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const profile = user.role === 'patient' ? await PatientProfile.findOne({ userId: user._id }) : null;
    const lines: string[] = [];
    lines.push(`Name: ${user.name}`);
    lines.push(`Email: ${user.email}`);
    lines.push(`Role: ${user.role}`);
    if (profile) {
      lines.push(`Blood Group: ${profile.bloodGroup || 'N/A'}`);
      lines.push(`Allergies: ${(profile.allergies || []).join(', ') || 'None'}`);
      lines.push(`Chronic Conditions: ${(profile.chronicConditions || []).join(', ') || 'None'}`);
      lines.push(`Current Medications: ${(profile.currentMedications || []).join(', ') || 'None'}`);
    }
    const buffer = await createPdfBuffer(`Patient Summary - ${user.name}`, lines);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="patient-summary-${user._id}.pdf"`);
    res.send(buffer);
  } catch (err: any) {
    logger.error('Patient summary PDF export failed', { error: err?.message });
  sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
  }
});

export default router;
