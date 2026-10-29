import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middlewares/auth';
import { validateBody } from '../middlewares/validate';
import { Reminder } from '../models';
import { sendError, ErrorCode, sendOk } from '../utils/response';

const router = Router();

const reminderSchema = z.object({
  title: z.string().min(2).max(200),
  medicine: z.string().max(200).optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  frequency: z.enum(['daily', 'weekly', 'once']).default('daily'),
  active: z.boolean().optional(),
});

router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const reminders = await Reminder.find({ userId: req.user!._id }).sort({ createdAt: -1 });
  sendOk(res, { reminders });
});

router.post('/', authenticate, validateBody(reminderSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  const reminder = await Reminder.create({ userId: req.user!._id, ...req.body, isDemo: false });
  sendOk(res, { reminder }, { status: 201 });
});

router.patch('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const reminder = await Reminder.findOneAndUpdate(
    { _id: req.params.id, userId: req.user!._id },
    { $set: req.body },
    { new: true }
  );
  if (!reminder) {
    sendError(res, 404, ErrorCode.NOT_FOUND, 'Reminder not found.');
    return;
  }
  sendOk(res, { reminder });
});

router.delete('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  await Reminder.deleteOne({ _id: req.params.id, userId: req.user!._id });
  sendOk(res, { message: 'Reminder deleted.' });
});

export default router;