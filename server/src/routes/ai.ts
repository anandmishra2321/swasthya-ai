import { Router, Response } from 'express';
import { z } from 'zod';
import { AIService } from '../services/aiService';
import { authenticate, AuthRequest } from '../middlewares/auth';
import { validateBody } from '../middlewares/validate';
import { sendError, ErrorCode, sendNotConfigured } from '../utils/response';
import { logger } from '../utils/logger';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import { rateLimit } from '../middlewares/rateLimit';

const router = Router();
const aiRequestLimiter = rateLimit({ name: 'ai-guidance:ip', windowMs: 60 * 1000, max: 20 });

const triageSchema = z.object({
  symptoms: z.string().min(2, 'Please describe your symptoms.').max(2000),
  language: z.enum(['en', 'hi']).default('en'),
});

const reportExplainSchema = z.object({
  reportText: z.string().max(10000).optional(),
  parameters: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        value: z.string().min(1).max(100),
        unit: z.string().max(30).optional(),
      })
    )
    .max(100)
    .default([]),
});

// POST /api/v1/ai/triage
router.post('/triage', aiRequestLimiter, validateBody(triageSchema), async (req: any, res: Response): Promise<void> => {
  if (!AIService.isAvailable()) {
    sendNotConfigured(res, 'AI guidance', 'No live AI provider adapter is implemented for this deployment.');
    return;
  }
  try {
    const { symptoms, language } = req.body;
    const result = await AIService.analyzeSymptoms(symptoms, language);

    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    logger.error('AI triage error', { error: err?.message });
    sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
  }
});

// POST /api/v1/ai/explain-report
router.post(
  '/explain-report',
  authenticate,
  aiRequestLimiter,
  validateBody(reportExplainSchema),
  async (req: any, res: Response): Promise<void> => {
    if (!AIService.isAvailable()) {
      sendNotConfigured(res, 'AI report explanation', 'No live AI provider adapter is implemented for this deployment.');
      return;
    }
    try {
      const { reportText, parameters } = req.body;
      const result = await AIService.explainLabReport(reportText || '', parameters);

      res.json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      logger.error('AI report explain error', { error: err?.message });
      sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
    }
  }
);

const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  language: z.enum(['en', 'hi']).default('en'),
});

const drugInteractionSchema = z.object({
  medicines: z.array(z.string().min(1).max(100)).min(1).max(20),
});

// POST /api/v1/ai/chat - General health assistant chatbot
router.post('/chat', aiRequestLimiter, validateBody(chatSchema), async (req: any, res: Response): Promise<void> => {
  try {
    const { message, language } = req.body;
    const reply = await AIService.chat(message, language);
    res.json({ success: true, data: { reply, isMock: !AIService.isAvailable() } });
  } catch (err: any) {
    logger.error('AI chat error', { error: err?.message });
    sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
  }
});

// POST /api/v1/ai/drug-interactions - Medication interaction checker
router.post('/drug-interactions', authenticate, aiRequestLimiter, validateBody(drugInteractionSchema), async (req: any, res: Response): Promise<void> => {
  try {
    const { medicines } = req.body;
    const result = await AIService.drugInteractionCheck(medicines);
    res.json({ success: true, data: { result } });
  } catch (err: any) {
    logger.error('AI drug interaction error', { error: err?.message });
    sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
  }
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// POST /api/v1/ai/explain-report-file - Upload a PDF lab report and get AI explanation
router.post(
  '/explain-report-file',
  authenticate,
  aiRequestLimiter,
  upload.single('file'),
  async (req: any, res: Response): Promise<void> => {
    try {
      const file = req.file;
      if (!file) {
        sendError(res, 400, ErrorCode.VALIDATION_FAILED, 'No file uploaded.');
        return;
      }
      let text = '';
      try {
        const parsed = await pdfParse(file.buffer);
        text = parsed.text || '';
      } catch {
        text = '';
      }
      const result = await AIService.explainLabReport(text, []);
      res.json({ success: true, data: { ...result, extractedText: text.slice(0, 2000) } });
    } catch (err: any) {
      logger.error('AI report file explain error', { error: err?.message });
      sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
    }
  }
);
export default router;
