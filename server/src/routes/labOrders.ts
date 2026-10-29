import { Router, Response } from 'express';
import { z } from 'zod';
import { LabOrder, SampleStatus } from '../models/LabOrder';
import { authenticate, AuthRequest } from '../middlewares/auth';
import { requireRole } from '../middlewares/rbac';
import { validateBody } from '../middlewares/validate';
import { logAuditEvent } from '../services/auditService';
import { canAccessLabOrder } from '../services/accessControlService';
import { sendError, ErrorCode } from '../utils/response';
import { emitToUser } from '../services/socketService';
import { createPdfBuffer } from '../utils/pdf';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

const router = Router();

const createLabOrderSchema = z.object({
  patientId: z.string().optional(),
  organizationId: z.string(),
  testName: z.string().min(2),
  category: z.string().default('General Pathology'),
});

const enterResultsSchema = z.object({
  results: z.array(
    z.object({
      parameter: z.string().min(1),
      value: z.string().min(1),
      unit: z.string(),
      referenceRange: z.string(),
      isAbnormal: z.boolean().default(false),
    })
  ),
  technicianNotes: z.string().optional(),
});

// GET /api/v1/lab-orders
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const filter: any = {};

    if (user.role === 'patient') {
      filter.patientId = user._id;
      // Fetch orders for this patient
      const orders = await LabOrder.find(filter)
        .populate('organizationId', 'name address phone')
        .sort({ createdAt: -1 });

      // CRITICAL SECURITY RULE: If not released, mask the results so patient cannot view unapproved report data
      const sanitized = orders.map((order) => {
        const obj: any = order.toObject();
        if (!order.isReleasedToPatient) {
          obj.results = [];
          obj.aiExplanation = undefined;
          obj.reportStatusNotice = 'Results are currently undergoing lab quality verification and have not yet been released.';
        }
        return obj;
      });

      res.json({
        success: true,
        count: sanitized.length,
        data: sanitized,
      });
      return;
    }

    if (req.activeWorkspaceId) {
      filter.organizationId = req.activeWorkspaceId;
    }

    const orders = await LabOrder.find(filter)
      .populate('patientId', 'name email phone')
      .populate('organizationId', 'name address phone')
      .populate('releasedBy', 'name role')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (err: any) {
    logger.error('Failed to list lab orders', { error: err?.message });
    sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
  }
});

// GET /api/v1/lab-orders/:id - Single order detail
router.get('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const order = await LabOrder.findById(req.params.id)
      .populate('patientId', 'name email phone')
      .populate('organizationId', 'name address phone')
      .populate('releasedBy', 'name role');

    if (!order) {
      sendError(res, 404, ErrorCode.NOT_FOUND, 'Lab order not found.');
      return;
    }

    // Patient access check
    if (req.user!.role === 'patient') {
      if (order.patientId._id.toString() !== (req.user!._id as mongoose.Types.ObjectId).toString()) {
        sendError(res, 403, ErrorCode.FORBIDDEN, 'Access denied: You can only view your own lab orders.');
        return;
      }

      if (!order.isReleasedToPatient) {
        sendError(
          res,
          403,
          ErrorCode.FORBIDDEN,
          'Lab report access is withheld: This report has not yet been authorized or released by the laboratory.'
        );
        return;
      }
    } else {
      // Staff access is object-scoped: laboratory staff must belong to the
      // performing lab, clinicians must hold a relationship to the patient.
      const decision = await canAccessLabOrder(
        req.user!._id as mongoose.Types.ObjectId,
        req.user!.role,
        {
          patientId: (order.patientId as any)._id ?? order.patientId,
          organizationId: (order.organizationId as any)?._id ?? order.organizationId,
        }
      );

      if (!decision.allowed) {
        await logAuditEvent({
          actorId: req.user!._id as mongoose.Types.ObjectId,
          actorEmail: req.user!.email,
          actorRole: req.user!.role,
          action: 'LAB_ORDER_ACCESS_DENIED',
          targetType: 'LabOrder',
          targetId: order._id.toString(),
          organizationId: ((order.organizationId as any)?._id ?? order.organizationId) as mongoose.Types.ObjectId,
          details: { reason: decision.reason, detail: decision.detail },
        });
        sendError(res, 403, ErrorCode.FORBIDDEN, 'Access denied: you are not authorised to view this lab order.');
        return;
      }
    }

    res.json({
      success: true,
      data: order,
    });
  } catch (err: any) {
    logger.error('Failed to fetch lab order', { error: err?.message });
    sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
  }
});

// POST /api/v1/lab-orders - Book lab test
router.post('/', authenticate, validateBody(createLabOrderSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { patientId, organizationId, testName, category } = req.body;
    const targetPatientId = patientId || req.user!._id;
    const sampleId = `SMP-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const order = await LabOrder.create({
      patientId: targetPatientId,
      organizationId,
      testName,
      category,
      sampleId,
      sampleStatus: 'ordered',
      results: [],
      isReleasedToPatient: false,
      isDemo: true,
    });

    res.status(201).json({
      success: true,
      message: 'Lab test ordered successfully.',
      data: order,
    });
  } catch (err: any) {
    logger.error('Failed to create lab order', { error: err?.message });
    sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
  }
});

// PATCH /api/v1/lab-orders/:id/status - Update sample state
router.patch(
  '/:id/status',
  authenticate,
  requireRole('lab_admin', 'lab_tech'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { status } = req.body;
      const order = await LabOrder.findById(req.params.id);

      if (!order) {
        sendError(res, 404, ErrorCode.NOT_FOUND, 'Lab order not found.');
        return;
      }

      order.sampleStatus = status as SampleStatus;
      if (status === 'collected' && !order.collectionDate) {
        order.collectionDate = new Date().toISOString().split('T')[0];
      }

      await order.save();

      res.json({
        success: true,
        message: `Sample status updated to ${status}.`,
        data: order,
      });
    } catch (err: any) {
      logger.error('Failed to update lab order status', { error: err?.message });
      sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
    }
  }
);

// PATCH /api/v1/lab-orders/:id/results - Enter test results
router.patch(
  '/:id/results',
  authenticate,
  requireRole('lab_admin', 'lab_tech'),
  validateBody(enterResultsSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { results, technicianNotes } = req.body;
      const order = await LabOrder.findById(req.params.id);

      if (!order) {
        sendError(res, 404, ErrorCode.NOT_FOUND, 'Lab order not found.');
        return;
      }

      order.results = results;
      order.technicianNotes = technicianNotes;
      order.sampleStatus = 'completed';

      order.aiExplanation = undefined;

      await order.save();

      res.json({
        success: true,
        message: 'Test results entered and saved. No automated clinical interpretation was added.',
        data: order,
      });
    } catch (err: any) {
      logger.error('Failed to enter lab results', { error: err?.message });
      sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
    }
  }
);

// PATCH /api/v1/lab-orders/:id/release - Authorized release to patient
router.patch(
  '/:id/release',
  authenticate,
  requireRole('lab_admin', 'lab_tech'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const order = await LabOrder.findById(req.params.id);
      if (!order) {
        sendError(res, 404, ErrorCode.NOT_FOUND, 'Lab order not found.');
        return;
      }

      order.isReleasedToPatient = true;
      order.releasedAt = new Date();
      order.releasedBy = req.user!._id as mongoose.Types.ObjectId;
      await order.save();

      emitToUser(String(order.patientId), 'lab:result:released', { orderId: order._id });

      await logAuditEvent({
        actorId: req.user!._id as mongoose.Types.ObjectId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'LAB_REPORT_RELEASE',
        targetType: 'LabOrder',
        targetId: order._id.toString(),
        organizationId: order.organizationId as mongoose.Types.ObjectId,
        details: { sampleId: order.sampleId, testName: order.testName },
      });

      res.json({
        success: true,
        message: 'Lab report successfully released to patient.',
        data: order,
      });
    } catch (err: any) {
      logger.error('Failed to release lab report', { error: err?.message });
      sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
    }
  }
);

// GET /api/v1/lab-orders/:id/pdf - Download lab report as PDF
router.get('/:id/pdf', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const order = await LabOrder.findById(req.params.id).populate('patientId', 'name email');
    if (!order) {
      sendError(res, 404, ErrorCode.NOT_FOUND, 'Lab order not found.');
      return;
    }
    const isPatient = req.user!.role === 'patient';
    if (isPatient && !order.isReleasedToPatient) {
      sendError(res, 403, ErrorCode.FORBIDDEN, 'Report not released to patient yet.');
      return;
    }
    const lines: string[] = [];
    lines.push(`Test: ${order.testName}`);
    lines.push(`Category: ${order.category}`);
    lines.push(`Patient: ${(order.patientId as any)?.name || ''}`);
    lines.push(`Status: ${order.sampleStatus}`);
    lines.push(`Released: ${order.isReleasedToPatient ? 'Yes' : 'No'}`);
    lines.push('');
    if (order.isReleasedToPatient && order.results?.length) {
      lines.push('Results:');
      for (const r of order.results) {
        lines.push(`- ${r.parameter}: ${r.value} ${r.unit || ''} (Ref: ${r.referenceRange || 'N/A'}) ${r.isAbnormal ? '[ABNORMAL]' : ''}`);
      }
    } else {
      lines.push('Results are pending lab verification and release.');
    }
    if (order.aiExplanation) {
      lines.push('');
      lines.push('AI Explanation:');
      lines.push(order.aiExplanation);
    }
    const buffer = await createPdfBuffer(`Lab Report - ${order.testName}`, lines);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="lab-report-${order._id}.pdf"`);
    res.send(buffer);
  } catch (err: any) {
    logger.error('Lab PDF export failed', { error: err?.message });
    sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
  }
});

export default router;
