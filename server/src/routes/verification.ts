import { Router, Response } from 'express';
import { z } from 'zod';
import { VerificationCase } from '../models/VerificationCase';
import { Organization } from '../models/Organization';
import { DoctorProfile } from '../models/DoctorProfile';
import { Membership } from '../models/Membership';
import { authenticate, AuthRequest } from '../middlewares/auth';
import { requireRole } from '../middlewares/rbac';
import { validateBody } from '../middlewares/validate';
import { logAuditEvent } from '../services/auditService';
import { sendError, ErrorCode } from '../utils/response';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

const router = Router();

const decisionSchema = z.object({
  status: z.enum(['verified', 'rejected', 'needs_update']),
  decisionReason: z.string().min(3),
  reviewerNotes: z.string().optional(),
});

// GET /api/v1/verification/queue
router.get(
  '/queue',
  authenticate,
  requireRole('verification_admin', 'platform_super_admin'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { status } = req.query;
      const filter: any = {};
      if (status) {
        filter.status = status;
      }

      const cases = await VerificationCase.find(filter)
        .populate('submittedBy', 'name email phone')
        .populate('reviewerId', 'name email')
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        count: cases.length,
        data: cases,
      });
    } catch (err: any) {
      logger.error('Failed to fetch verification queue', { error: err?.message });
      sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
    }
  }
);

// PATCH /api/v1/verification/:id/decision
router.patch(
  '/:id/decision',
  authenticate,
  requireRole('verification_admin', 'platform_super_admin'),
  validateBody(decisionSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { status, decisionReason, reviewerNotes } = req.body;

      const vCase = await VerificationCase.findById(id);
      if (!vCase) {
        sendError(res, 404, ErrorCode.NOT_FOUND, 'Verification case not found.');
        return;
      }

      vCase.status = status;
      vCase.decisionReason = decisionReason;
      vCase.reviewerNotes = reviewerNotes;
      vCase.reviewerId = req.user!._id as mongoose.Types.ObjectId;
      vCase.decisionAt = new Date();
      await vCase.save();

      // If verified or rejected, update target entity directly
      if (vCase.targetType !== 'doctor') {
        const org = await Organization.findById(vCase.targetId);
        if (org) {
          org.isVerified = status === 'verified';
          org.verificationStatus = status;
          org.verificationNotes = decisionReason;
          await org.save();

          if (status === 'verified' && org.ownerId) {
            await Membership.updateOne(
              { userId: org.ownerId, organizationId: org._id, status: 'invited' },
              { $set: { status: 'active' } }
            );
          }
        }
      } else {
        const doc = await DoctorProfile.findById(vCase.targetId);
        if (doc) {
          doc.isVerified = status === 'verified';
          await doc.save();
        }
      }

      await logAuditEvent({
        actorId: req.user!._id as mongoose.Types.ObjectId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'VERIFICATION_DECISION',
        targetType: 'VerificationCase',
        targetId: vCase._id.toString(),
        details: { status, targetType: vCase.targetType, decisionReason },
      });

      res.json({
        success: true,
        message: `Verification decision recorded: ${status}.`,
        data: vCase,
      });
    } catch (err: any) {
      logger.error('Failed to record verification decision', { error: err?.message });
      sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
    }
  }
);

export default router;
