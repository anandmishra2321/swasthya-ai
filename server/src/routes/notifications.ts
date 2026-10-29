import express, { Request, Response } from 'express';
import { requireAuth } from '../middlewares/auth';
import { Notification } from '../models/Notification';
import mongoose from 'mongoose';

const router = express.Router();

/**
 * GET /api/v1/notifications
 * List notifications for the authenticated user (paginated)
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user._id;
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));
    const skip = (page - 1) * limit;
    const unreadOnly = req.query.unread === 'true';

    const filter: Record<string, unknown> = { userId };
    if (unreadOnly) filter.isRead = false;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ userId, isRead: false }),
    ]);

    res.json({
      success: true,
      data: { notifications, total, page, limit, unreadCount },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

/**
 * PATCH /api/v1/notifications/:id/read
 * Mark a single notification as read
 */
router.patch('/:id/read', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user._id;
    const notification = await Notification.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(req.params.id), userId },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ success: false, error: { message: 'Notification not found' } });
    }
    res.json({ success: true, data: notification });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

/**
 * PATCH /api/v1/notifications/read-all
 * Mark all notifications as read
 */
router.patch('/read-all', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user._id;
    await Notification.updateMany({ userId, isRead: false }, { isRead: true, readAt: new Date() });
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

/**
 * DELETE /api/v1/notifications/:id
 * Delete a single notification
 */
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user._id;
    await Notification.findOneAndDelete({ _id: req.params.id, userId });
    res.json({ success: true, message: 'Notification deleted' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

/**
 * DELETE /api/v1/notifications
 * Clear all notifications for the user
 */
router.delete('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user._id;
    await Notification.deleteMany({ userId });
    res.json({ success: true, message: 'All notifications cleared' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

export default router;
