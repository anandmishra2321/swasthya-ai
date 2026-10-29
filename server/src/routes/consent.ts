import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middlewares/auth';
import {
  HealthDataConsent,
  ClinicianPatientRelationship,
  DoctorProfile,
  User,
} from '../models';
import { sendError, ErrorCode } from '../utils/response';
import { logger } from '../utils/logger';

const router = Router();

const grantConsentSchema = z.object({
  clinicianId: z.string().optional(),
  organizationId: z.string().optional(),
  categories: z
    .array(z.enum(['vitals', 'activity', 'sleep', 'prescriptions', 'records']))
    .min(1),
  expiresAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});

const revokeConsentSchema = z.object({
  consentId: z.string(),
});

// GET /api/v1/consent/my-consents - List all consents granted by patient
router.get('/my-consents', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const patientId = req.user!._id;

    const consents = await HealthDataConsent.find({ patientId })
      .populate('clinicianId', 'name email phone')
      .populate('organizationId', 'name type address')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: consents,
    });
  } catch (err: any) {
    logger.error('List consents error', { error: err?.message });
    sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
  }
});

// POST /api/v1/consent/grant - Grant or update consent for a clinician or hospital
router.post('/grant', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const patientId = req.user!._id;
    const parseResult = grantConsentSchema.safeParse(req.body);

    if (!parseResult.success) {
      sendError(res, 400, ErrorCode.VALIDATION_FAILED, 'Invalid consent parameters', parseResult.error.format());
      return;
    }

    const { clinicianId, organizationId, categories, expiresAt, notes } = parseResult.data;

    if (!clinicianId && !organizationId) {
      sendError(res, 400, ErrorCode.VALIDATION_FAILED, 'Must designate either an individual clinician or healthcare organization');
      return;
    }

    // Verify clinician exists if specified
    if (clinicianId) {
      const docUser = await User.findById(clinicianId);
      if (!docUser) {
        sendError(res, 404, ErrorCode.NOT_FOUND, 'Designated clinician user not found');
        return;
      }
    }

    // Upsert or create active consent
    const filter: any = { patientId };
    if (clinicianId) filter.clinicianId = clinicianId;
    if (organizationId) filter.organizationId = organizationId;

    let consent = await HealthDataConsent.findOne(filter);
    if (!consent) {
      consent = new HealthDataConsent({
        patientId,
        clinicianId,
        organizationId,
        categories,
        status: 'active',
        grantedAt: new Date(),
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        notes,
      });
    } else {
      consent.categories = categories;
      consent.status = 'active';
      consent.grantedAt = new Date();
      consent.revokedAt = undefined;
      consent.expiresAt = expiresAt ? new Date(expiresAt) : undefined;
      consent.notes = notes;
    }
    await consent.save();

    // Link ClinicianPatientRelationship if clinicianId provided
    if (clinicianId) {
      await ClinicianPatientRelationship.findOneAndUpdate(
        { patientId, clinicianId },
        {
          status: 'active',
          organizationId,
          type: 'consulting',
          establishedAt: new Date(),
        },
        { upsert: true, new: true }
      );
    }

    res.json({
      success: true,
      message: 'Health data consent successfully granted',
      data: consent,
    });
  } catch (err: any) {
    logger.error('Grant consent error', { error: err?.message });
    sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
  }
});

// POST /api/v1/consent/revoke - Revoke consent immediately
router.post('/revoke', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const patientId = req.user!._id;
    const parseResult = revokeConsentSchema.safeParse(req.body);

    if (!parseResult.success) {
      sendError(res, 400, ErrorCode.VALIDATION_FAILED, 'Missing consentId');
      return;
    }

    const { consentId } = parseResult.data;

    const consent = await HealthDataConsent.findOne({ _id: consentId, patientId });
    if (!consent) {
      sendError(res, 404, ErrorCode.NOT_FOUND, 'Consent agreement not found or not owned by you');
      return;
    }

    consent.status = 'revoked';
    consent.revokedAt = new Date();
    await consent.save();

    res.json({
      success: true,
      message: 'Consent successfully revoked. Clinician access to metrics has been terminated.',
      data: consent,
    });
  } catch (err: any) {
    logger.error('Revoke consent error', { error: err?.message });
    sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
  }
});

// GET /api/v1/consent/available-doctors - Search or list verified clinicians for consent granting
router.get('/available-doctors', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const doctors = await DoctorProfile.find({ isVerified: true })
      .populate('userId', 'name email phone')
      .populate('organizationId', 'name type address')
      .limit(30)
      .lean();

    res.json({
      success: true,
      data: doctors,
    });
  } catch (err: any) {
    logger.error('List available doctors error', { error: err?.message });
    sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
  }
});

export default router;
