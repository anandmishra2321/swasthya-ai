import { Router, Response } from 'express';
import { z } from 'zod';
import { PharmacyInventoryItem } from '../models/PharmacyInventoryItem';
import { authenticate, AuthRequest } from '../middlewares/auth';
import { requireRole } from '../middlewares/rbac';
import { validateBody } from '../middlewares/validate';
import { logAuditEvent } from '../services/auditService';
import { sendError, ErrorCode } from '../utils/response';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

const router = Router();

const createItemSchema = z.object({
  medicineName: z.string().min(2),
  genericName: z.string().min(2),
  brand: z.string().default('Generic'),
  strength: z.string().min(1),
  dosageForm: z.enum(['tablet', 'syrup', 'capsule', 'injection', 'ointment', 'drops', 'powder']),
  packSize: z.string().default('10 units'),
  batchNumber: z.string().min(1),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expiry must be YYYY-MM-DD'),
  quantity: z.number().min(0),
  lowStockThreshold: z.number().default(20),
  price: z.number().min(0),
  isPrescriptionRequired: z.boolean().default(false),
});

// GET /api/v1/inventory - List stock
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const filter: any = {};
    if (req.activeWorkspaceId) {
      filter.organizationId = req.activeWorkspaceId;
    }

    const { search, lowStockOnly, nearExpiryOnly } = req.query;

    if (search) {
      filter.$or = [
        { medicineName: new RegExp(search as string, 'i') },
        { genericName: new RegExp(search as string, 'i') },
        { brand: new RegExp(search as string, 'i') },
      ];
    }

    let items = await PharmacyInventoryItem.find(filter)
      .populate('organizationId', 'name address phone')
      .sort({ medicineName: 1 });

    const now = new Date();
    const sixtyDaysLater = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    const enriched = items.map((item) => {
      const obj: any = item.toObject();
      const exp = new Date(item.expiryDate);
      obj.isLowStock = item.quantity <= item.lowStockThreshold;
      obj.isNearExpiry = exp <= sixtyDaysLater && exp >= now;
      obj.isExpired = exp < now;
      return obj;
    });

    let finalItems = enriched;
    if (lowStockOnly === 'true') {
      finalItems = finalItems.filter((i) => i.isLowStock);
    }
    if (nearExpiryOnly === 'true') {
      finalItems = finalItems.filter((i) => i.isNearExpiry || i.isExpired);
    }

    res.json({
      success: true,
      count: finalItems.length,
      alerts: {
        lowStockCount: enriched.filter((i) => i.isLowStock).length,
        nearExpiryCount: enriched.filter((i) => i.isNearExpiry).length,
        expiredCount: enriched.filter((i) => i.isExpired).length,
      },
      data: finalItems,
    });
  } catch (err: any) {
    logger.error('Failed to list inventory items', { error: err?.message });
    sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
  }
});

// POST /api/v1/inventory - Add item
router.post(
  '/',
  authenticate,
  requireRole('medical_store_owner', 'pharmacist'),
  validateBody(createItemSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const itemData = req.body;
      const organizationId = req.activeWorkspaceId;

      if (!organizationId) {
        sendError(res, 400, ErrorCode.VALIDATION_FAILED, 'Please switch to an active medical store workspace.');
        return;
      }

      const item = await PharmacyInventoryItem.create({
        ...itemData,
        organizationId,
        lastUpdatedBy: req.user!._id,
        isDemo: true,
      });

      await logAuditEvent({
        actorId: req.user!._id as mongoose.Types.ObjectId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'INVENTORY_ADD',
        targetType: 'PharmacyInventoryItem',
        targetId: item._id.toString(),
        organizationId,
        details: { medicineName: item.medicineName, batch: item.batchNumber, qty: item.quantity },
      });

      res.status(201).json({
        success: true,
        message: 'Medicine batch added to inventory.',
        data: item,
      });
    } catch (err: any) {
      logger.error('Failed to add inventory item', { error: err?.message });
      sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
    }
  }
);

// PUT /api/v1/inventory/:id - Update quantity
router.put(
  '/:id',
  authenticate,
  requireRole('medical_store_owner', 'pharmacist'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { quantity, price, lowStockThreshold } = req.body;
      const item = await PharmacyInventoryItem.findById(req.params.id);

      if (!item) {
        sendError(res, 404, ErrorCode.NOT_FOUND, 'Inventory item not found.');
        return;
      }

      if (quantity !== undefined) item.quantity = quantity;
      if (price !== undefined) item.price = price;
      if (lowStockThreshold !== undefined) item.lowStockThreshold = lowStockThreshold;
      item.lastUpdatedBy = req.user!._id as mongoose.Types.ObjectId;

      await item.save();

      res.json({
        success: true,
        message: 'Inventory updated successfully.',
        data: item,
      });
    } catch (err: any) {
      logger.error('Failed to update inventory item', { error: err?.message });
      sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
    }
  }
);

export default router;
