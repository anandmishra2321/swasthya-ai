import { Router, Response } from 'express';
import { z } from 'zod';
import { Organization } from '../models/Organization';
import { Membership } from '../models/Membership';
import { OrganizationInvitation } from '../models/OrganizationInvitation';
import { VerificationCase } from '../models/VerificationCase';
import { User } from '../models/User';
import { BedInventory } from '../models/BedInventory';
import { authenticate, AuthRequest } from '../middlewares/auth';
import { requireRole, requireOrganizationAccess } from '../middlewares/rbac';
import { validateBody } from '../middlewares/validate';
import { logAuditEvent } from '../services/auditService';
import { sendError, ErrorCode } from '../utils/response';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import mongoose from 'mongoose';
import crypto from 'crypto';

const router = Router();

const createOrgSchema = z.object({
  name: z.string().min(2),
  type: z.enum(['hospital', 'private_clinic', 'homeopathy_clinic', 'medical_store', 'diagnostic_lab', 'emergency_provider']),
  registrationNumber: z.string().optional(),
  address: z.object({
    street: z.string().optional(),
    area: z.string(),
    city: z.string(),
    pincode: z.string(),
    state: z.string().default('Madhya Pradesh'),
    coordinates: z.object({ lat: z.number(), lng: z.number() }).optional(),
  }),
  phone: z.string(),
  email: z.string().email().optional(),
  emergencyHelpline: z.string().optional(),
  operatingHours: z.string().default('24x7 Emergency / 9:00 AM - 8:00 PM OPD'),
  services: z.array(z.string()).default([]),
  departments: z.array(z.string()).default([]),
  totalBeds: z.number().default(0),
});

const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum([
    'hospital_admin',
    'hospital_doctor',
    'hospital_receptionist',
    'hospital_staff',
    'nurse',
    'bed_manager',
    'clinic_admin',
    'private_doctor',
    'clinic_receptionist',
    'homeopathy_doctor',
    'store_owner',
    'pharmacist',
    'lab_admin',
    'lab_tech',
  ]),
  department: z.string().optional(),
});

// GET /api/v1/organizations - Public directory search
router.get('/', async (req: any, res: Response): Promise<void> => {
  try {
    const { type, city, search, verifiedOnly } = req.query;
    const filter: any = {};

    if (type) {
      filter.type = type;
    }
    if (city) {
      filter['address.city'] = new RegExp(city as string, 'i');
    }
    if (verifiedOnly === 'true') {
      filter.isVerified = true;
    }
    if (search) {
      filter.$or = [
        { name: new RegExp(search as string, 'i') },
        { services: new RegExp(search as string, 'i') },
        { 'address.area': new RegExp(search as string, 'i') },
      ];
    }

    const organizations = await Organization.find(filter).sort({ isVerified: -1, name: 1 });

    // Include bed summaries for hospitals
    const orgsWithDetails = await Promise.all(
      organizations.map(async (org) => {
        const orgObj: any = org.toObject();
        if (org.type === 'hospital') {
          const beds = await BedInventory.find({ organizationId: org._id });
          const totalCapacity = beds.reduce((acc, b) => acc + b.totalCapacity, 0);
          const totalAvailable = beds.reduce((acc, b) => acc + b.available, 0);
          const lastUpdated = beds.length > 0 ? beds.reduce((latest, b) => (b.lastUpdatedAt > latest ? b.lastUpdatedAt : latest), beds[0].lastUpdatedAt) : org.updatedAt;

          orgObj.bedSummary = {
            totalCapacity,
            totalAvailable,
            lastUpdatedAt: lastUpdated,
            isStale: Date.now() - new Date(lastUpdated).getTime() > 24 * 60 * 60 * 1000,
          };
        }
        return orgObj;
      })
    );

    res.json({
      success: true,
      count: orgsWithDetails.length,
      data: orgsWithDetails,
    });
  } catch (err: any) {
    logger.error('Failed to list organizations', { error: err?.message });
    sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
  }
});

// GET /api/v1/organizations/:id - Detail view
router.get('/:id', async (req: any, res: Response): Promise<void> => {
  try {
    const org = await Organization.findById(req.params.id);
    if (!org) {
      sendError(res, 404, ErrorCode.NOT_FOUND, 'Organization not found.');
      return;
    }

    const beds = await BedInventory.find({ organizationId: org._id }).populate('lastUpdatedBy', 'name');
    const members = await Membership.find({ organizationId: org._id, status: 'active' }).populate('userId', 'name email role');

    res.json({
      success: true,
      data: {
        ...org.toObject(),
        beds,
        staffCount: members.length,
        members,
      },
    });
  } catch (err: any) {
    logger.error('Failed to fetch organization', { error: err?.message });
    sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
  }
});

// POST /api/v1/organizations - Create/request organization
router.post('/', authenticate, validateBody(createOrgSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const orgData = req.body;

    const organization = await Organization.create({
      ...orgData,
      ownerId: user._id,
      isVerified: false,
      verificationStatus: 'pending',
      isDemo: user.isDemoAccount,
    });

    // The owner becomes an active administrator only after organization verification.
    await Membership.create({
      userId: user._id,
      organizationId: organization._id,
      role: orgData.type === 'hospital' ? 'hospital_admin' : orgData.type === 'medical_store' ? 'store_owner' : 'clinic_admin',
      status: 'invited',
    });

    const targetType = orgData.type === 'hospital'
      ? 'hospital'
      : orgData.type === 'medical_store'
        ? 'pharmacy'
        : orgData.type === 'diagnostic_lab'
          ? 'lab'
          : orgData.type === 'emergency_provider'
            ? 'ambulance'
            : 'clinic';
    await VerificationCase.create({
      targetType,
      targetId: organization._id,
      targetName: organization.name,
      submittedBy: user._id,
      status: 'pending',
      documents: [],
      isDemo: user.isDemoAccount,
    });

    await logAuditEvent({
      actorId: user._id as mongoose.Types.ObjectId,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'ORGANIZATION_CREATE',
      organizationId: organization._id as mongoose.Types.ObjectId,
      details: { organizationName: organization.name, type: organization.type },
    });

    res.status(201).json({
      success: true,
      message: 'Organization registered successfully and submitted for verification.',
      data: organization,
    });
  } catch (err: any) {
    logger.error('Failed to create organization', { error: err?.message });
    sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
  }
});

// POST /api/v1/organizations/:organizationId/invite - Staff invitation
router.post(
  '/:organizationId/invite',
  authenticate,
  requireOrganizationAccess('organizationId'),
  requireRole(
    'hospital_admin',
    'private_clinic_admin',
    'homeopathy_clinic_admin',
    'medical_store_owner',
    'lab_admin',
    'platform_super_admin'
  ),
  validateBody(inviteMemberSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { organizationId } = req.params;
      const { email, role, department } = req.body;
      const normalizedEmail = email.toLowerCase();

      if (env.NODE_ENV === 'production') {
        sendError(
          res,
          503,
          ErrorCode.INTEGRATION_NOT_CONFIGURED,
          'Organization invitations are unavailable until a verified email delivery provider is configured.'
        );
        return;
      }

      const invitationToken = crypto.randomBytes(32).toString('hex');
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      await OrganizationInvitation.updateMany(
        { organizationId, email: normalizedEmail, status: 'pending' },
        { $set: { status: 'revoked' } }
      );
      const invitation = await OrganizationInvitation.create({
        email: normalizedEmail,
        organizationId,
        role,
        department,
        tokenHash: crypto.createHash('sha256').update(invitationToken).digest('hex'),
        invitedBy: req.user!._id,
        expiresAt,
      });

      await logAuditEvent({
        actorId: req.user!._id as mongoose.Types.ObjectId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'MEMBER_INVITE',
        organizationId: new mongoose.Types.ObjectId(organizationId),
        details: { targetEmail: normalizedEmail, assignedRole: role, invitationId: invitation._id },
      });

      res.status(201).json({
        success: true,
        message: 'Invitation created. Share this one-time link only with the intended recipient.',
        invitationToken,
        expiresAt,
      });
    } catch (err: any) {
      logger.error('Failed to invite organization member', { error: err?.message });
      sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
    }
  }
);

// GET /api/v1/organizations/:organizationId/members
router.get(
  '/:organizationId/members',
  authenticate,
  requireOrganizationAccess('organizationId'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { organizationId } = req.params;
      const members = await Membership.find({ organizationId }).populate('userId', 'name email phone role isEmailVerified');

      res.json({
        success: true,
        data: members,
      });
    } catch (err: any) {
      logger.error('Failed to list organization members', { error: err?.message });
      sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
    }
  }
);

export default router;
