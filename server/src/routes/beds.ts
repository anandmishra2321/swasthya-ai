import { Router, Response } from 'express';
import { z } from 'zod';
import { BedInventory, BedCategory } from '../models/BedInventory';
import { Organization } from '../models/Organization';
import { authenticate, AuthRequest } from '../middlewares/auth';
import { requireRole, requireOrganizationAccess } from '../middlewares/rbac';
import { validateBody } from '../middlewares/validate';
import { logAuditEvent } from '../services/auditService';
import { sendError, ErrorCode } from '../utils/response';
import { emitToOrg } from '../services/socketService';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

const router = Router();

const updateBedSchema = z.object({
  totalCapacity: z.number().min(1),
  available: z.number().min(0),
  occupied: z.number().min(0),
  cleaning: z.number().min(0).default(0),
  reserved: z.number().min(0).default(0),
  notes: z.string().optional(),
});

// GET /api/v1/beds - Public view of beds with freshness labels
router.get('/', async (req: any, res: Response): Promise<void> => {
  try {
    const { organizationId, category } = req.query;
    const filter: any = {};

    if (organizationId) {
      filter.organizationId = organizationId;
    }
    if (category) {
      filter.category = category;
    }

    const beds = await BedInventory.find(filter)
      .populate('organizationId', 'name address phone emergencyHelpline isVerified')
      .populate('lastUpdatedBy', 'name role')
      .sort({ lastUpdatedAt: -1 });

    const now = Date.now();
    const enrichedBeds = beds.map((b) => {
      const obj: any = b.toObject();
      const ageHours = (now - new Date(b.lastUpdatedAt).getTime()) / (1000 * 60 * 60);
      obj.isStale = ageHours > 12;
      obj.ageHours = Math.round(ageHours * 10) / 10;
      return obj;
    });

    res.json({
      success: true,
      count: enrichedBeds.length,
      data: enrichedBeds,
    });
  } catch (err: any) {
    logger.error('Failed to list bed inventory', { error: err?.message });
    sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
  }
});

// GET /api/v1/beds/summary - Aggregated availability across hospitals
router.get('/summary', async (req: any, res: Response): Promise<void> => {
  try {
    const beds = await BedInventory.find().populate('organizationId', 'name address phone');

    const summary = {
      totalGeneral: 0,
      availableGeneral: 0,
      totalICU: 0,
      availableICU: 0,
      totalEmergency: 0,
      availableEmergency: 0,
      totalOxygen: 0,
      availableOxygen: 0,
      hospitalCount: new Set(beds.map((b) => b.organizationId?._id?.toString())).size,
    };

    beds.forEach((b) => {
      if (b.category === 'general') {
        summary.totalGeneral += b.totalCapacity;
        summary.availableGeneral += b.available;
      } else if (b.category === 'icu') {
        summary.totalICU += b.totalCapacity;
        summary.availableICU += b.available;
      } else if (b.category === 'emergency') {
        summary.totalEmergency += b.totalCapacity;
        summary.availableEmergency += b.available;
      } else if (b.category === 'oxygen') {
        summary.totalOxygen += b.totalCapacity;
        summary.availableOxygen += b.available;
      }
    });

    res.json({
      success: true,
      data: summary,
    });
  } catch (err: any) {
    logger.error('Failed to build bed availability summary', { error: err?.message });
    sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
  }
});

// PUT /api/v1/beds/:id - Update bed count by hospital bed manager or admin
router.put(
  '/:id',
  authenticate,
  requireRole('hospital_admin', 'bed_manager', 'nurse', 'hospital_staff', 'platform_super_admin'),
  validateBody(updateBedSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { totalCapacity, available, occupied, cleaning, reserved, notes } = req.body;

      const bed = await BedInventory.findById(id);
      if (!bed) {
        sendError(res, 404, ErrorCode.NOT_FOUND, 'Bed inventory record not found.');
        return;
      }

      // Bed capacity is organisation-scoped public health data: staff may only
      // update the wards of the organisation they are currently working in.
      const isPlatformAdmin = req.user!.role === 'platform_super_admin';
      if (!isPlatformAdmin) {
        if (!req.activeWorkspaceId) {
          sendError(
            res,
            403,
            ErrorCode.FORBIDDEN,
            'Access denied: select an organisation workspace before updating bed capacity.'
          );
          return;
        }
        if (bed.organizationId.toString() !== req.activeWorkspaceId.toString()) {
          await logAuditEvent({
            actorId: req.user!._id as mongoose.Types.ObjectId,
            actorEmail: req.user!.email,
            actorRole: req.user!.role,
            action: 'BED_STATUS_UPDATE_DENIED',
            targetType: 'BedInventory',
            targetId: bed._id.toString(),
            organizationId: bed.organizationId as mongoose.Types.ObjectId,
            details: { reason: 'cross_organisation', activeWorkspaceId: req.activeWorkspaceId.toString() },
          });
          sendError(
            res,
            403,
            ErrorCode.FORBIDDEN,
            'Access denied: this bed inventory belongs to a different organisation.'
          );
          return;
        }
      }

      // Validate capacity consistency
      if (available + occupied + cleaning + reserved > totalCapacity) {
        sendError(
          res,
          400,
          ErrorCode.VALIDATION_FAILED,
          `Capacity Inconsistency: Sum of available (${available}) + occupied (${occupied}) + cleaning (${cleaning}) + reserved (${reserved}) exceeds total capacity (${totalCapacity}).`
        );
        return;
      }

      bed.totalCapacity = totalCapacity;
      bed.available = available;
      bed.occupied = occupied;
      bed.cleaning = cleaning;
      bed.reserved = reserved;
      bed.notes = notes;
      bed.lastUpdatedBy = req.user!._id as mongoose.Types.ObjectId;
      bed.lastUpdatedAt = new Date();

      await bed.save();

      emitToOrg(String(bed.organizationId), 'beds:updated', { bed });

      await logAuditEvent({
        actorId: req.user!._id as mongoose.Types.ObjectId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'BED_STATUS_UPDATE',
        targetType: 'BedInventory',
        targetId: bed._id.toString(),
        organizationId: bed.organizationId as mongoose.Types.ObjectId,
        details: {
          ward: bed.ward,
          category: bed.category,
          totalCapacity,
          available,
          occupied,
        },
      });

      res.json({
        success: true,
        message: 'Bed status updated successfully.',
        data: bed,
      });
    } catch (err: any) {
      logger.error('Failed to update bed status', { error: err?.message });
      sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
    }
  }
);

// POST /api/v1/beds - Initialize bed ward for an organization
router.post(
  '/',
  authenticate,
  requireRole('hospital_admin', 'bed_manager', 'platform_super_admin'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { organizationId, ward, category, totalCapacity, available, occupied } = req.body;

      const targetOrganizationId = organizationId || req.activeWorkspaceId;

      if (!targetOrganizationId) {
        sendError(
          res,
          400,
          ErrorCode.VALIDATION_FAILED,
          'An organizationId is required, or select an organisation workspace first.'
        );
        return;
      }

      // Staff may only publish inventory for the organisation they work in.
      if (
        req.user!.role !== 'platform_super_admin' &&
        targetOrganizationId.toString() !== req.activeWorkspaceId?.toString()
      ) {
        await logAuditEvent({
          actorId: req.user!._id as mongoose.Types.ObjectId,
          actorEmail: req.user!.email,
          actorRole: req.user!.role,
          action: 'BED_STATUS_UPDATE_DENIED',
          targetType: 'Organization',
          targetId: targetOrganizationId.toString(),
          details: { reason: 'cross_organisation_create', activeWorkspaceId: req.activeWorkspaceId?.toString() },
        });
        sendError(
          res,
          403,
          ErrorCode.FORBIDDEN,
          'Access denied: you cannot publish bed inventory for a different organisation.'
        );
        return;
      }

      const bed = await BedInventory.create({
        organizationId: targetOrganizationId,
        ward,
        category: category as BedCategory,
        totalCapacity,
        available,
        occupied: occupied || 0,
        lastUpdatedBy: req.user!._id,
        lastUpdatedAt: new Date(),
        isDemo: true,
      });

      res.status(201).json({
        success: true,
        data: bed,
      });
    } catch (err: any) {
      logger.error('Failed to initialize bed ward', { error: err?.message });
      sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
    }
  }
);

export default router;
