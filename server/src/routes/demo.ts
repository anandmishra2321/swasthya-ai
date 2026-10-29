import { Router } from 'express';
import { runSeed } from '../seed/seed';
import { requireRole } from '../middlewares/rbac';

const router = Router();

/**
 * POST /api/v1/demo/seed
 * Reseed demo data (admin only)
 */
router.post('/seed', requireRole('superadmin', 'admin'), async (req, res, next) => {
  try {
    const { forceReset = false } = req.body;

    const seeded = await runSeed({
      connect: false,
      onlyIfEmpty: false,
      forceReset: forceReset === true,
    });

    res.json({
      success: true,
      message: forceReset
        ? 'Demo data reset and reseeded successfully'
        : 'Demo data seeded successfully',
      data: { seeded },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/demo/status
 * Check if demo data exists (admin only)
 */
router.get('/status', requireRole('superadmin', 'admin'), async (req, res, next) => {
  try {
    const { User, Organization, DoctorProfile } = await import('../models');

    const userCount = await User.estimatedDocumentCount();
    const orgCount = await Organization.estimatedDocumentCount();
    const doctorCount = await DoctorProfile.estimatedDocumentCount();

    const hasDemoData = userCount > 0;

    res.json({
      success: true,
      data: {
        hasDemoData,
        userCount,
        orgCount,
        doctorCount,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
