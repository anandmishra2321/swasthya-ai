import { Router, Response } from 'express';
import { z } from 'zod';
import { MedicalRecord, MedicalRecordType } from '../models/MedicalRecord';
import { PatientProfile } from '../models/PatientProfile';
import { User } from '../models/User';
import { authenticate, AuthRequest } from '../middlewares/auth';
import { requireRole } from '../middlewares/rbac';
import { validateBody } from '../middlewares/validate';
import { AIService } from '../services/aiService';
import { logAuditEvent } from '../services/auditService';
import {
  canAccessPatientClinicalData,
  canAuthorClinicalNotes,
} from '../services/accessControlService';
import { sendError, ErrorCode, sendNotConfigured } from '../utils/response';
import { createPdfBuffer } from '../utils/pdf';
import { logger } from '../utils/logger';
import { rateLimit } from '../middlewares/rateLimit';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { env } from '../config/env';
import mongoose from 'mongoose';

const storageDir = path.resolve(env.STORAGE_DIR || 'uploads');
if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });

const router = Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, storageDir),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// POST /api/v1/records/upload - Upload a document/report file and create a record
router.post(
  '/upload',
  authenticate,
  upload.single('file'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { patientId, type, title } = req.body;
      const targetPatientId = user.role === 'patient' ? user._id.toString() : patientId;

      if (!targetPatientId || !title) {
        sendError(res, 400, ErrorCode.VALIDATION_FAILED, 'patientId and title are required.');
        return;
      }

      // Access check for clinicians
      if (user.role !== 'patient') {
        const decision = await canAccessPatientClinicalData(
          user._id as mongoose.Types.ObjectId,
          user.role,
          targetPatientId,
          { organizationId: req.activeWorkspaceId }
        );
        if (!decision.allowed) {
          sendError(res, 403, ErrorCode.FORBIDDEN, 'Access denied.');
          return;
        }
      }

      const file = (req as any).file;
      const record = await MedicalRecord.create({
        patientId: targetPatientId,
        doctorId: user.role === 'patient' ? undefined : user._id,
        organizationId: req.activeWorkspaceId,
        type: (type as MedicalRecordType) || 'lab_report',
        title,
        recordDate: new Date(),
        fileUrl: file ? `/uploads/${file.filename}` : undefined,
        fileName: file?.originalname,
        fileMimeType: file?.mimetype,
        isDemo: false,
      });

      res.status(201).json({ success: true, data: record });
    } catch (err: any) {
      logger.error('File upload failed', { error: err?.message });
      sendError(res, 500, ErrorCode.INTERNAL, 'Upload failed.');
    }
  }
);
const draftLimiter = rateLimit({ name: 'clinical-draft:ip', windowMs: 60 * 1000, max: 10 });

const createRecordSchema = z.object({
  patientId: z.string(),
  type: z.enum(['visit_note', 'lab_report', 'discharge_summary', 'imaging', 'prescription_doc']),
  title: z.string().min(2),
  recordDate: z.string().optional(),
  clinicalNotes: z
    .object({
      symptoms: z.string().optional(),
      examination: z.string().optional(),
      diagnosis: z.string().optional(),
      plan: z.string().optional(),
      followUpDate: z.string().optional(),
    })
    .optional(),
  aiDraftSummary: z.string().optional(),
  aiApprovedByDoctor: z.boolean().default(false),
  fileUrl: z.string().optional(),
  fileName: z.string().optional(),
});

// GET /api/v1/records - Access-controlled record fetching
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { patientId } = req.query;
    const filter: any = {};

    if (user.role === 'patient') {
      // Patient can only see their own records
      filter.patientId = user._id;
    } else if (patientId) {
      // Clinician viewing a specific patient: a role alone is never enough,
      // an explicit care relationship must exist.
      const decision = await canAccessPatientClinicalData(
        user._id as mongoose.Types.ObjectId,
        user.role,
        patientId as string,
        { organizationId: req.activeWorkspaceId }
      );

      if (!decision.allowed) {
        await logAuditEvent({
          actorId: user._id as mongoose.Types.ObjectId,
          actorEmail: user.email,
          actorRole: user.role,
          action: 'MEDICAL_RECORD_ACCESS_DENIED',
          targetType: 'User',
          targetId: String(patientId),
          organizationId: (req.activeWorkspaceId as mongoose.Types.ObjectId) || undefined,
          details: { reason: decision.reason, detail: decision.detail },
        });
        sendError(
          res,
          403,
          ErrorCode.FORBIDDEN,
          'Access denied: no care relationship, appointment or consent grant links you to this patient.'
        );
        return;
      }

      filter.patientId = patientId;
    } else {
      // Doctor viewing records created by them
      filter.doctorId = user._id;
    }

    const records = await MedicalRecord.find(filter)
      .populate('patientId', 'name email phone')
      .populate('doctorId', 'name email role')
      .populate('organizationId', 'name type')
      .sort({ recordDate: -1 });

    res.json({
      success: true,
      count: records.length,
      data: records,
    });
  } catch (err: any) {
    logger.error('Failed to list medical records', { error: err?.message });
    sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
  }
});

// POST /api/v1/records - Create consultation visit note or report
router.post('/', authenticate, validateBody(createRecordSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { patientId, type, title, recordDate, clinicalNotes, aiDraftSummary, aiApprovedByDoctor, fileUrl, fileName } = req.body;

    const patient = await User.findById(patientId);
    if (!patient) {
      sendError(res, 404, ErrorCode.NOT_FOUND, 'Patient not found.');
      return;
    }

    // A record may only be authored for another patient by a role that is
    // allowed to write clinical documentation and that holds a relationship
    // to that patient. Patients may still file documents against their own chart.
    const isSelf = String(patientId) === String(req.user!._id);
    if (!isSelf) {
      if (!canAuthorClinicalNotes(req.user!.role)) {
        sendError(
          res,
          403,
          ErrorCode.FORBIDDEN,
          'Access denied: your role cannot author clinical documentation for another patient.'
        );
        return;
      }

      const decision = await canAccessPatientClinicalData(
        req.user!._id as mongoose.Types.ObjectId,
        req.user!.role,
        patientId,
        { organizationId: req.activeWorkspaceId }
      );

      if (!decision.allowed) {
        await logAuditEvent({
          actorId: req.user!._id as mongoose.Types.ObjectId,
          actorEmail: req.user!.email,
          actorRole: req.user!.role,
          action: 'MEDICAL_RECORD_ACCESS_DENIED',
          targetType: 'User',
          targetId: String(patientId),
          organizationId: (req.activeWorkspaceId as mongoose.Types.ObjectId) || undefined,
          details: { reason: decision.reason, detail: decision.detail, attempted: 'create' },
        });
        sendError(
          res,
          403,
          ErrorCode.FORBIDDEN,
          'Access denied: no care relationship, appointment or consent grant links you to this patient.'
        );
        return;
      }
    }

    const record = await MedicalRecord.create({
      patientId,
      doctorId: req.user!._id,
      organizationId: req.activeWorkspaceId,
      type: type as MedicalRecordType,
      title,
      recordDate: recordDate ? new Date(recordDate) : new Date(),
      clinicalNotes,
      aiDraftSummary,
      aiApprovedByDoctor,
      fileUrl,
      fileName,
      isDemo: true,
    });

    await logAuditEvent({
      actorId: req.user!._id as mongoose.Types.ObjectId,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'MEDICAL_RECORD_CREATE',
      targetType: 'MedicalRecord',
      targetId: record._id.toString(),
      details: { patientId, type, title },
    });

    res.status(201).json({
      success: true,
      message: 'Medical record created successfully.',
      data: record,
    });
  } catch (err: any) {
    logger.error('Failed to create medical record', { error: err?.message });
    sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
  }
});

// POST /api/v1/records/ai-draft - Generate AI summary draft for consultation note
const clinicalDraftSchema = z.object({
  symptoms: z.string().max(2000).optional(),
  examination: z.string().max(2000).optional(),
  diagnosis: z.string().max(2000).optional(),
  plan: z.string().max(2000).optional(),
}).strict();

router.post(
  '/ai-draft',
  authenticate,
  requireRole('hospital_doctor', 'private_doctor', 'homeopathy_doctor'),
  draftLimiter,
  validateBody(clinicalDraftSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!AIService.isAvailable()) {
      sendNotConfigured(res, 'Clinical draft generation', 'No live AI provider adapter is implemented for this deployment.');
      return;
    }
    try {
      const { symptoms, examination, diagnosis, plan } = req.body;
      const draft = await AIService.generateClinicalDraftSummary({ symptoms, examination, diagnosis, plan });

      res.json({
        success: true,
        draft,
        isMock: true,
        disclaimer: 'This development-only template is not AI-generated or clinical advice. A licensed clinician must review and replace it before use.',
      });
    } catch (err: any) {
      logger.error('Failed to generate AI clinical draft', { error: err?.message });
      sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
    }
  }
);

// GET /api/v1/records/:id/pdf - Download medical record as PDF
router.get('/:id/pdf', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const record = await MedicalRecord.findById(req.params.id).populate('patientId','name email').populate('doctorId','name email role');
    if (!record) { sendError(res, 404, ErrorCode.NOT_FOUND, 'Medical record not found.'); return; }
    const isPatient = req.user!.role === 'patient';
    if (isPatient && String(record.patientId?._id || record.patientId) !== String(req.user!._id)) { sendError(res, 403, ErrorCode.FORBIDDEN, 'Access denied.'); return; }
    const lines: string[] = []
    lines.push(`Type: ${record.type}`);
    lines.push(`Title: ${record.title}`);
    lines.push(`Date: ${record.recordDate}`);
    lines.push(`Patient: ${(record.patientId as any)?.name || ''}`);
    if (record.doctorId) lines.push(`Doctor: ${(record.doctorId as any)?.name || ''}`);
    if (record.fileUrl) lines.push(`File: ${record.fileUrl}`);
    if (record.clinicalNotes) {
      lines.push('');
      lines.push('Clinical Notes:');
      if (record.clinicalNotes.symptoms) lines.push(`Symptoms: ${record.clinicalNotes.symptoms}`);
      if (record.clinicalNotes.examination) lines.push(`Examination: ${record.clinicalNotes.examination}`);
      if (record.clinicalNotes.diagnosis) lines.push(`Diagnosis: ${record.clinicalNotes.diagnosis}`);
      if (record.clinicalNotes.plan) lines.push(`Plan: ${record.clinicalNotes.plan}`);
    }
    if (record.aiDraftSummary) { lines.push(''); lines.push(`AI Summary: ${record.aiDraftSummary}`); }
    const buffer = await createPdfBuffer(`Medical Record - ${record.title}`, lines);
    res.setHeader('Content-Type','application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="medical-record-${record._id}.pdf"`);
    res.send(buffer);
  } catch (err: any) {
    logger.error('Medical record PDF export failed', { error: err?.message });
    sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
  }
});

export default router;
