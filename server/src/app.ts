import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import mongoose from 'mongoose';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { requestId } from './middlewares/requestId';
import { getIntegrationsReport } from './config/integrations';
import { openApiSpec, renderDocsHtml } from './docs/openapi';

// Route imports
import authRoutes from './routes/auth';
import meRoutes from './routes/me';
import integrationRoutes from './routes/integrations';
import organizationRoutes from './routes/organizations';
import doctorRoutes from './routes/doctors';
import appointmentRoutes from './routes/appointments';
import bedRoutes from './routes/beds';
import recordRoutes from './routes/records';
import prescriptionRoutes from './routes/prescriptions';
import inventoryRoutes from './routes/inventory';
import labOrderRoutes from './routes/labOrders';
import aiRoutes from './routes/ai';
import verificationRoutes from './routes/verification';
import supportRoutes from './routes/support';
import auditRoutes from './routes/audit';
import analyticsRoutes from './routes/analytics';
import healthcareRoutes from './routes/healthcare';
import wearablesRoutes from './routes/wearables';
import consentRoutes from './routes/consent';
import clinicianRoutes from './routes/clinician';
import notificationRoutes from './routes/notifications';
import referralRoutes from './routes/referrals';
import reminderRoutes from './routes/reminders';
import paymentRoutes from './routes/payments';

export function createApp(): Application {

  const app = express();

  // Correlation id first, so every log line and error envelope carries it.
  app.use(requestId);

  // Security and utilities
  app.use(helmet({
    crossOriginResourcePolicy: false,
  }));

  app.use(
    cors({
      origin: [env.FRONTEND_ORIGIN, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-workspace-id'],
      exposedHeaders: ['X-Request-Id', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'Retry-After'],
    })
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  if (env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  // Health / readiness, including truthful integration status.
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      app: 'Swasthya AI Platform API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      aiProvider: env.AI_PROVIDER,
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      requestId: res.locals.requestId,
      integrations: getIntegrationsReport(),
    });
  });

  // API documentation: machine-readable spec plus a readable browser.
  app.get('/api/v1/openapi.json', (_req: Request, res: Response) => {
    res.json(openApiSpec);
  });

  app.get('/api/docs', (_req: Request, res: Response) => {
    // Self-contained internal reference with inline script/style, so it opts out
    // of the global CSP for this route only.
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:"
    );
    res.type('html').send(renderDocsHtml());
  });

  // API v1 Routes
  const apiV1 = express.Router();
  apiV1.use('/auth', authRoutes);
  apiV1.use('/me', meRoutes);
  apiV1.use('/integrations', integrationRoutes);
  apiV1.use('/organizations', organizationRoutes);
  apiV1.use('/doctors', doctorRoutes);
  apiV1.use('/appointments', appointmentRoutes);
  apiV1.use('/beds', bedRoutes);
  apiV1.use('/records', recordRoutes);
  apiV1.use('/prescriptions', prescriptionRoutes);
  apiV1.use('/inventory', inventoryRoutes);
  apiV1.use('/lab-orders', labOrderRoutes);
  apiV1.use('/ai', aiRoutes);
  apiV1.use('/verification', verificationRoutes);
  apiV1.use('/support', supportRoutes);
  apiV1.use('/audit-logs', auditRoutes);
  apiV1.use('/analytics', analyticsRoutes);
  apiV1.use('/healthcare', healthcareRoutes);
  apiV1.use('/wearables', wearablesRoutes);
  apiV1.use('/consent', consentRoutes);
  apiV1.use('/clinician', clinicianRoutes);
  apiV1.use('/notifications', notificationRoutes);
  apiV1.use('/referrals', referralRoutes);
  apiV1.use('/reminders', reminderRoutes);
  apiV1.use('/payments', paymentRoutes);

  // Serve uploaded files
  app.use('/uploads', express.static(path.resolve(env.STORAGE_DIR || 'uploads')));

  // Root: redirect to frontend / docs
  app.get('/', (_req: Request, res: Response) => {
    res.redirect(env.FRONTEND_ORIGIN || 'http://localhost:5173');
  });

  app.use('/api/v1', apiV1);

  // Unmatched API paths get a machine-readable 404 rather than any HTML fallback.
  app.use('/api', notFoundHandler);

  // Centralized Error Handling
  app.use(errorHandler);

  return app;
}
