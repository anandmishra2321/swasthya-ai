import http from 'http';
import { createApp } from './app';
import { connectDB } from './config/db';
import { env, assertEnvOrReport } from './config/env';
import { seedIfEmpty } from './seed/seed';
import { logger } from './utils/logger';
import { initRateLimitRedis } from './middlewares/rateLimit';
import { startAppointmentReminders } from './services/reminderService';
import { initSocketServer } from './services/socketService';

async function bootstrap() {
  try {
    console.log('--- Initializing Swasthya AI Backend API ---');

    // Fail fast on fatal misconfiguration in production; report everything else.
    assertEnvOrReport(logger);

    await connectDB();

    await initRateLimitRedis();

    if (env.SEED_ON_START) {
      const seeded = await seedIfEmpty();
      if (seeded) {
        console.log('[Swasthya AI] Empty database detected — demo dataset loaded.');
      }
    }

    const app = createApp();

    // Wrap Express in an HTTP server so Socket.IO can share the same port
    const httpServer = http.createServer(app);

    // Initialize Socket.IO real-time layer
    initSocketServer(httpServer);

    startAppointmentReminders();

    httpServer.listen(env.PORT, () => {
      console.log(`[Swasthya AI] Server running successfully on http://localhost:${env.PORT}`);
      console.log(`[Swasthya AI] REST API endpoints available under http://localhost:${env.PORT}/api/v1`);
      console.log(`[Swasthya AI] Health check: http://localhost:${env.PORT}/api/health`);
      console.log(`[Swasthya AI] API reference: http://localhost:${env.PORT}/api/docs`);
      console.log(`[Swasthya AI] Socket.IO real-time server active on ws://localhost:${env.PORT}`);
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n[Swasthya AI] Gracefully shutting down...');
      httpServer.close();
      process.exit(0);
    });
  } catch (err: any) {
    console.error('[Swasthya AI] Fatal startup failure:', err.message);
    process.exit(1);
  }
}

bootstrap();
