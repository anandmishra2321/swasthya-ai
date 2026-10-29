import { Router, Response } from 'express';
import { AuditLog } from '../models/AuditLog';
import { authenticate, AuthRequest } from '../middlewares/auth';
import { requireRole } from '../middlewares/rbac';
import { sendError, ErrorCode } from '../utils/response';
import { createPdfBuffer } from '../utils/pdf';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/v1/audit-logs - Restricted to hospital admin, platform super admin
router.get(
  '/',
  authenticate,
  requireRole('hospital_admin', 'platform_super_admin'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const filter: any = {};
      if (req.user!.role !== 'platform_super_admin' && req.activeWorkspaceId) {
        filter.organizationId = req.activeWorkspaceId;
      }

      const { action, limit } = req.query;
      if (action) {
        filter.action = action;
      }

      const maxLimit = limit ? Math.min(parseInt(limit as string, 10), 100) : 50;
      const logs = await AuditLog.find(filter)
        .populate('actorId', 'name email role')
        .populate('organizationId', 'name type')
        .sort({ createdAt: -1 })
        .limit(maxLimit);

      res.json({
        success: true,
        count: logs.length,
        data: logs,
      });
    } catch (err: any) {
      logger.error('Failed to fetch audit logs', { error: err?.message });
      sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
    }
  }
);

// GET /api/v1/audit-logs/export - CSV export for admins
router.get(
  '/export',
  authenticate,
  requireRole('hospital_admin', 'platform_super_admin'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const filter: any = {};
      if (req.user!.role !== 'platform_super_admin' && req.activeWorkspaceId) {
        filter.organizationId = req.activeWorkspaceId;
      }
      const { action } = req.query;
      if (action) filter.action = action;

      const logs = await AuditLog.find(filter)
        .populate('actorId', 'name email role')
        .populate('organizationId', 'name type')
        .sort({ createdAt: -1 })
        .limit(1000);

      const header = 'createdAt,action,actorName,actorEmail,actorRole,organization,ipAddress\n';
      const rows = logs.map((l: any) => {
        const actor = l.actorId || {};
        const org = l.organizationId || {};
        const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        return [
          l.createdAt?.toISOString?.() ?? l.createdAt,
          l.action,
          actor.name,
          actor.email,
          actor.role,
          org.name,
          l.ipAddress,
        ].map(escape).join(',');
      }).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
      res.send(header + rows);
    } catch (err: any) {
      logger.error('Failed to export audit logs', { error: err?.message });
      sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
    }
  }
);
// GET /api/v1/audit-logs/export/pdf
router.get('/export/pdf',
  authenticate,
  requireRole('hospital_admin', 'platform_super_admin'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const filter: any = {};
      if (req.user!.role !== 'platform_super_admin' && req.activeWorkspaceId) filter.organizationId = req.activeWorkspaceId;
      const logs = await AuditLog.find(filter).populate('actorId','name email role').sort({ createdAt: -1 }).limit(200);
      const lines = logs.map((l: any) => `${l.createdAt?.toISOString?.() || l.createdAt} | ${l.action} | ${l.actorId?.name || ''} | ${l.actorId?.email || ''} | ${l.ipAddress || ''}`);
      const buffer = await createPdfBuffer('Audit Log Export', lines);
      res.setHeader('Content-Type','application/pdf');
      res.setHeader('Content-Disposition','attachment; filename="audit-logs.pdf"');
      res.send(buffer);
    } catch (err:any) {
      logger.error('Audit PDF export failed', { error: err?.message });
      sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
    }
  }
);

export default router;
