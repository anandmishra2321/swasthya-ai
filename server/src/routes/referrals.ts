import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middlewares/auth';
import { validateBody } from '../middlewares/validate';
import { Referral } from '../models';
import { sendError, ErrorCode, sendOk } from '../utils/response';

const router = Router();

const referralSchema = z.object({
  toDoctorId: z.string(),
  patientId: z.string(),
  organizationId: z.string().optional(),
  reason: z.string().min(2).max(500),
  notes: z.string().max(2000).optional(),
});

router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = req.user!;
  const filter: any = {};
  if (user.role !== 'platform_super_admin') {
    filter.$or = [{ fromDoctorId: user._id }, { toDoctorId: user._id }];
  }
  const referrals = await Referral.find(filter).sort({ createdAt: -1 });
  sendOk(res, { referrals });
});

router.post('/', authenticate, validateBody(referralSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  const referral = await Referral.create({
    fromDoctorId: req.user!._id,
    toDoctorId: req.body.toDoctorId,
    patientId: req.body.patientId,
    organizationId: req.body.organizationId,
    reason: req.body.reason,
    notes: req.body.notes,
    isDemo: false,
  });
  sendOk(res, { referral }, { status: 201 });
});

router.patch('/:id/status', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { status } = req.body;
  if (!['pending', 'accepted', 'rejected', 'completed'].includes(status)) {
    sendError(res, 400, ErrorCode.VALIDATION_FAILED, 'Invalid status.');
    return;
  }
  const referral = await Referral.findOneAndUpdate(
    { _id: req.params.id, toDoctorId: req.user!._id },
    { $set: { status } },
    { new: true }
  );
  if (!referral) {
    sendError(res, 404, ErrorCode.NOT_FOUND, 'Referral not found.');
    return;
  }
  sendOk(res, { referral });
});

export default router;