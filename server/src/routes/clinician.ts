import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middlewares/auth';
import { requireRole } from '../middlewares/rbac';
import {
  HealthDataConsent,
  ClinicianPatientRelationship,
  HealthMetricSample,
  HealthDailySummary,
  WearableConnection,
  HealthDataAccessAudit,
  User,
  PatientProfile,
} from '../models';
import { sendError, ErrorCode } from '../utils/response';
import { logger } from '../utils/logger';

const router = Router();

// Middleware ensuring doctor access
const doctorRoles = [
  'hospital_doctor',
  'private_doctor',
  'homeopathy_doctor',
  'hospital_admin',
];

// GET /api/v1/clinician/patients - List only consented patients with active care relationship
router.get(
  '/patients',
  authenticate,
  requireRole(...doctorRoles),
  async (req: AuthRequest, res: Response): Promise<void> => {

    try {
      const clinicianId = req.user!._id;
      const orgId = req.activeWorkspaceId;

      // Search active consents explicitly granting access to this doctor or their active org
      const consentFilter: any = {
        status: 'active',
        $or: [{ clinicianId }],
        $and: [
          {
            $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: new Date() } }],
          },
        ],
      };

      if (orgId) {
        consentFilter.$or.push({ organizationId: orgId });
      }

      const activeConsents = await HealthDataConsent.find(consentFilter)
        .populate('patientId', 'name email phone preferredLanguage')
        .sort({ grantedAt: -1 })
        .lean();

      // Deduplicate by patient
      const patientMap = new Map<string, any>();
      for (const consent of activeConsents) {
        const patient: any = consent.patientId;
        if (!patient || !patient._id) continue;

        const pIdStr = patient._id.toString();
        if (!patientMap.has(pIdStr)) {
          // Check wearable sync status
          const latestConnection = await WearableConnection.findOne({
            userId: patient._id,
            status: 'connected',
          })
            .sort({ lastSyncAt: -1 })
            .lean();

          const isStale = latestConnection?.lastSyncAt
            ? Date.now() - new Date(latestConnection.lastSyncAt).getTime() > 6 * 3600 * 1000
            : true;

          // Latest vitals sample
          const latestHR = await HealthMetricSample.findOne({
            userId: patient._id,
            metric: 'heart_rate',
          })
            .sort({ measuredAt: -1 })
            .lean();

          patientMap.set(pIdStr, {
            patientId: pIdStr,
            name: patient.name,
            email: patient.email,
            phone: patient.phone,
            preferredLanguage: patient.preferredLanguage,
            consentId: consent._id,
            grantedCategories: consent.categories,
            grantedAt: consent.grantedAt,
            expiresAt: consent.expiresAt,
            wearableConnected: Boolean(latestConnection),
            connectedPlatform: latestConnection?.platform,
            lastSyncAt: latestConnection?.lastSyncAt,
            isStale,
            latestHeartRate: latestHR ? { value: latestHR.value, measuredAt: latestHR.measuredAt } : null,
          });
        }
      }

      res.json({
        success: true,
        count: patientMap.size,
        data: Array.from(patientMap.values()),
      });
    } catch (err: any) {
      logger.error('List consented patients error', { error: err?.message });
      sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
    }
  }
);

// GET /api/v1/clinician/patients/:patientId/metrics - Fetch metrics strictly if consent is active
router.get(
  '/patients/:patientId/metrics',
  authenticate,
  requireRole(...doctorRoles),
  async (req: AuthRequest, res: Response): Promise<void> => {

    try {
      const clinicianId = req.user!._id;
      const orgId = req.activeWorkspaceId;
      const { patientId } = req.params;

      // STRICT Server-side authorization check for active consent
      const consentFilter: any = {
        patientId,
        status: 'active',
        $or: [{ clinicianId }],
        $and: [
          {
            $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: new Date() } }],
          },
        ],
      };

      if (orgId) {
        consentFilter.$or.push({ organizationId: orgId });
      }

      const activeConsent = await HealthDataConsent.findOne(consentFilter);

      if (!activeConsent) {
        sendError(
          res,
          403,
          ErrorCode.FORBIDDEN,
          'Access Denied: Patient has not granted active consent to you or your organization, or consent has expired/been revoked.'
        );
        return;
      }

      // Audit Log this sensitive health data access
      await HealthDataAccessAudit.create({
        patientId,
        accessedBy: clinicianId,
        accessType: 'view_summary',
        metricsViewed: activeConsent.categories,
        accessedAt: new Date(),
        ip: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      });

      // Map permitted metric types based on consented categories
      const permittedMetricTypes: string[] = [];
      if (activeConsent.categories.includes('vitals')) {
        permittedMetricTypes.push('heart_rate', 'resting_heart_rate', 'spo2', 'respiratory_rate', 'temperature');
      }
      if (activeConsent.categories.includes('activity')) {
        permittedMetricTypes.push('steps');
      }
      if (activeConsent.categories.includes('sleep')) {
        permittedMetricTypes.push('sleep_duration');
      }

      const [patientUser, patientProf, samples, dailySummaries, connections] = await Promise.all([
        User.findById(patientId).select('name email phone preferredLanguage').lean(),
        PatientProfile.findOne({ userId: patientId }).lean(),
        HealthMetricSample.find({
          userId: patientId,
          metric: { $in: permittedMetricTypes },
        })
          .sort({ measuredAt: -1 })
          .limit(100)
          .lean(),
        HealthDailySummary.find({ userId: patientId }).sort({ date: -1 }).limit(14).lean(),
        WearableConnection.find({ userId: patientId }).lean(),
      ]);

      const activeConn = connections.find((c) => c.status === 'connected');
      const isStale = activeConn?.lastSyncAt
        ? Date.now() - new Date(activeConn.lastSyncAt).getTime() > 6 * 3600 * 1000
        : true;

      const patientAge = patientProf?.dateOfBirth
        ? Math.floor((Date.now() - new Date(patientProf.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))
        : undefined;

      res.json({
        success: true,
        patient: {
          ...patientUser,
          age: patientAge,
          dateOfBirth: patientProf?.dateOfBirth,
          gender: patientProf?.gender,
          bloodGroup: patientProf?.bloodGroup,
          allergies: patientProf?.allergies,
          chronicConditions: patientProf?.chronicConditions,
        },

        consent: {
          id: activeConsent._id,
          categories: activeConsent.categories,
          grantedAt: activeConsent.grantedAt,
          expiresAt: activeConsent.expiresAt,
        },
        connection: activeConn
          ? {
              platform: activeConn.platform,
              deviceName: activeConn.deviceName,
              lastSyncAt: activeConn.lastSyncAt,
              isStale,
              syncStatus: activeConn.syncStatus,
            }
          : null,
        metrics: samples,
        dailySummaries,
        clinicalNotice:
          'Consumer wearable data is supplementary observational data and does not substitute for certified clinical evaluation or validated medical telemetry.',
      });
    } catch (err: any) {
      logger.error('Fetch patient metrics error', { error: err?.message });
      sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
    }
  }
);

export default router;
