import { Router, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { env } from '../config/env';
import { authenticate, AuthRequest } from '../middlewares/auth';
import {
  WearableConnection,
  HealthMetricSample,
  HealthDailySummary,
  SyncJob,
  HealthMetricType,
} from '../models';
import { sendError, ErrorCode } from '../utils/response';
import { logger } from '../utils/logger';

const router = Router();

// Validation Schemas
const bleIngestSchema = z.object({
  bpm: z.number().min(30).max(250),
  rrIntervals: z.array(z.number()).optional(),
  sensorContact: z.boolean().optional(),
  energyExpended: z.number().optional(),
  deviceName: z.string().optional().default('BLE Heart Rate Sensor'),
  measuredAt: z.string().datetime().optional(),
});

const companionSyncSchema = z.object({
  platform: z.enum(['health_connect', 'apple_health', 'fitbit']),
  deviceName: z.string().optional(),
  samples: z.array(
    z.object({
      metric: z.enum([
        'heart_rate',
        'resting_heart_rate',
        'steps',
        'sleep_duration',
        'spo2',
        'respiratory_rate',
        'temperature',
      ]),
      value: z.number(),
      unit: z.string(),
      measuredAt: z.string().datetime(),
      quality: z.string().optional(),
    })
  ).min(1).max(500),
});

const disconnectSchema = z.object({
  platform: z.enum(['web_bluetooth_ble', 'fitbit', 'health_connect', 'apple_health']),
  purgeData: z.boolean().optional().default(false),
});

// Helper to update daily summary
async function updateDailySummary(
  userId: any,
  platform: string,
  metric: HealthMetricType,
  value: number,
  measuredAt: Date
) {
  const dateStr = measuredAt.toISOString().split('T')[0];
  let summary = await HealthDailySummary.findOne({ userId, date: dateStr });

  if (!summary) {
    summary = new HealthDailySummary({
      userId,
      date: dateStr,
      platform,
      totalSteps: 0,
      sleepMinutes: 0,
    });
  }

  if (metric === 'heart_rate') {
    if (!summary.minHeartRate || value < summary.minHeartRate) summary.minHeartRate = value;
    if (!summary.maxHeartRate || value > summary.maxHeartRate) summary.maxHeartRate = value;
    // Running avg
    summary.avgHeartRate = summary.avgHeartRate
      ? Math.round((summary.avgHeartRate + value) / 2)
      : Math.round(value);
  } else if (metric === 'resting_heart_rate') {
    summary.restingHeartRate = Math.round(value);
  } else if (metric === 'steps') {
    summary.totalSteps = (summary.totalSteps || 0) + Math.round(value);
  } else if (metric === 'sleep_duration') {
    summary.sleepMinutes = (summary.sleepMinutes || 0) + Math.round(value);
  } else if (metric === 'spo2') {
    summary.avgSpo2 = Math.round(value * 10) / 10;
  }

  summary.lastUpdatedAt = new Date();
  await summary.save();
}

// GET /api/v1/wearables/status - Connection and platform capability status
router.get('/status', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id;

    const connections = await WearableConnection.find({ userId });
    const connectionMap: Record<string, any> = {};

    for (const conn of connections) {
      const isStale = conn.lastSyncAt
        ? Date.now() - new Date(conn.lastSyncAt).getTime() > 6 * 3600 * 1000
        : true;

      connectionMap[conn.platform] = {
        status: conn.status,
        deviceName: conn.deviceName,
        lastSyncAt: conn.lastSyncAt,
        isStale,
        syncStatus: conn.syncStatus,
        companionPairingToken: conn.companionPairingToken,
      };
    }

    // Platform system configurations
    const platformConfig = {
      fitbit: {
        configured: Boolean(env.FITBIT_CLIENT_ID && env.FITBIT_CLIENT_SECRET),
        authUrlConfigured: Boolean(env.FITBIT_CLIENT_ID),
        supportedMetrics: ['heart_rate', 'steps', 'sleep_duration', 'spo2', 'respiratory_rate'],
      },
      webBluetooth: {
        configured: true,
        serviceGatt: '0x180D (Heart Rate SIG Standard)',
        supportedMetrics: ['heart_rate'],
      },
      healthConnect: {
        configured: true,
        method: 'Android Companion Ingestion API Contract',
        supportedMetrics: ['heart_rate', 'steps', 'sleep_duration', 'spo2'],
      },
      appleHealth: {
        configured: true,
        method: 'iOS HealthKit Companion Ingestion API Contract',
        supportedMetrics: ['heart_rate', 'steps', 'sleep_duration', 'spo2'],
      },
    };

    res.json({
      success: true,
      connections: connectionMap,
      platformConfig,
    });
  } catch (err: any) {
    logger.error('Wearables status retrieval error', { error: err?.message });
    sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
  }
});

// POST /api/v1/wearables/ble-ingest - Ingest real-time Web Bluetooth GATT Heart Rate reading
router.post('/ble-ingest', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id;
    const parseResult = bleIngestSchema.safeParse(req.body);

    if (!parseResult.success) {
      sendError(res, 400, ErrorCode.VALIDATION_FAILED, 'Invalid BLE sensor data format', parseResult.error.format());
      return;
    }

    const { bpm, rrIntervals, sensorContact, energyExpended, deviceName, measuredAt } =
      parseResult.data;
    const measurementDate = measuredAt ? new Date(measuredAt) : new Date();

    // Upsert or activate WearableConnection
    let connection = await WearableConnection.findOne({
      userId,
      platform: 'web_bluetooth_ble',
    });

    if (!connection) {
      connection = new WearableConnection({
        userId,
        platform: 'web_bluetooth_ble',
        status: 'connected',
        deviceName,
        scopes: ['heart_rate_gatt'],
        syncStatus: 'success',
      });
    } else {
      connection.status = 'connected';
      connection.deviceName = deviceName;
      connection.lastSyncAt = new Date();
      connection.syncStatus = 'success';
      connection.syncError = undefined;
    }
    await connection.save();

    // Store raw immutable sample
    const sample = new HealthMetricSample({
      userId,
      connectionId: connection._id,
      platform: 'web_bluetooth_ble',
      metric: 'heart_rate',
      value: bpm,
      unit: 'bpm',
      measuredAt: measurementDate,
      receivedAt: new Date(),
      quality: sensorContact === false ? 'low_contact' : 'valid',
      sourceDeviceId: deviceName,
      metadata: {
        rrIntervals: rrIntervals || [],
        energyExpended,
      },
    });

    try {
      await sample.save();
    } catch (saveErr: any) {
      // Deduplicate identical timestamp collision
      if (saveErr.code !== 11000) throw saveErr;
    }

    // Update Daily Aggregation
    await updateDailySummary(userId, 'web_bluetooth_ble', 'heart_rate', bpm, measurementDate);

    res.json({
      success: true,
      data: {
        sampleId: sample._id,
        bpm,
        measuredAt: measurementDate.toISOString(),
        receivedAt: sample.receivedAt.toISOString(),
        quality: sample.quality,
      },
    });
  } catch (err: any) {
    logger.error('BLE ingest error', { error: err?.message });
    sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
  }
});

// POST /api/v1/wearables/companion-token - Generate companion pairing token
router.post(
  '/companion-token',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!._id;
      const platform = req.body.platform || 'health_connect';

      let connection = await WearableConnection.findOne({ userId, platform });
      const pairingToken = crypto.randomBytes(24).toString('hex');

      if (!connection) {
        connection = new WearableConnection({
          userId,
          platform,
          status: 'disconnected',
          companionPairingToken: pairingToken,
          scopes: ['read_vitals', 'read_activity'],
        });
      } else {
        connection.companionPairingToken = pairingToken;
      }

      await connection.save();

      res.json({
        success: true,
        pairingToken,
        instructions:
          'Pass this pairing token in the Authorization header (Bearer <token>) or x-companion-token header to /api/v1/wearables/sync from the companion app.',
      });
    } catch (err: any) {
      logger.error('Companion token generation error', { error: err?.message });
      sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
    }
  }
);

// POST /api/v1/wearables/sync - Companion app or vendor batch data ingestion
router.post('/sync', async (req: any, res: Response): Promise<void> => {
  try {
    // Authenticate by either user JWT or companion pairing token
    let userId: any;
    const companionToken = req.headers['x-companion-token'] || req.body.pairingToken;

    if (companionToken) {
      const conn = await WearableConnection.findOne({ companionPairingToken: companionToken });
      if (!conn) {
        sendError(res, 401, ErrorCode.UNAUTHENTICATED, 'Invalid or expired companion pairing token');
        return;
      }
      userId = conn.userId;
    } else {
      // Check standard authorization
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        sendError(res, 401, ErrorCode.UNAUTHENTICATED, 'Authentication required');
        return;
      }
      // Delegate to standard authenticate
      await new Promise<void>((resolve, reject) => {
        authenticate(req, res, () => resolve());
      });
      if (res.headersSent) return;
      userId = req.user?._id;
    }

    const parseResult = companionSyncSchema.safeParse(req.body);
    if (!parseResult.success) {
      sendError(res, 400, ErrorCode.VALIDATION_FAILED, 'Invalid sync payload', parseResult.error.format());
      return;
    }

    const { platform, deviceName, samples } = parseResult.data;

    let connection = await WearableConnection.findOne({ userId, platform });
    if (!connection) {
      connection = new WearableConnection({
        userId,
        platform,
        status: 'connected',
        deviceName: deviceName || platform,
        lastSyncAt: new Date(),
        syncStatus: 'syncing',
      });
    } else {
      connection.status = 'connected';
      if (deviceName) connection.deviceName = deviceName;
      connection.lastSyncAt = new Date();
      connection.syncStatus = 'syncing';
    }
    await connection.save();

    let ingestedCount = 0;
    for (const sample of samples) {
      const mDate = new Date(sample.measuredAt);
      try {
        await HealthMetricSample.create({
          userId,
          connectionId: connection._id,
          platform,
          metric: sample.metric,
          value: sample.value,
          unit: sample.unit,
          measuredAt: mDate,
          receivedAt: new Date(),
          quality: sample.quality || 'valid',
          sourceDeviceId: deviceName || platform,
        });
        ingestedCount++;

        await updateDailySummary(userId, platform, sample.metric as HealthMetricType, sample.value, mDate);
      } catch (err: any) {
        // Skip duplicate unique compound key collisions
        if (err.code !== 11000) logger.error('Sample ingestion error:', { error: err?.message });
      }
    }

    connection.syncStatus = 'success';
    await connection.save();

    await SyncJob.create({
      connectionId: connection._id,
      userId,
      platform,
      status: 'completed',
      metricsSynced: ingestedCount,
      startedAt: new Date(),
      completedAt: new Date(),
    });

    res.json({
      success: true,
      syncedCount: ingestedCount,
      platform,
      lastSyncAt: connection.lastSyncAt,
    });
  } catch (err: any) {
    logger.error('Companion sync error', { error: err?.message });
    sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
  }
});

// POST /api/v1/wearables/disconnect - Disconnect platform and optionally revoke/delete data
router.post(
  '/disconnect',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!._id;
      const parseResult = disconnectSchema.safeParse(req.body);
      if (!parseResult.success) {
        sendError(res, 400, ErrorCode.VALIDATION_FAILED, 'Invalid platform selection');
        return;
      }

      const { platform, purgeData } = parseResult.data;

      const connection = await WearableConnection.findOne({ userId, platform });
      if (!connection) {
        sendError(res, 404, ErrorCode.NOT_FOUND, 'No active connection found for platform');
        return;
      }

      connection.status = 'revoked';
      connection.syncStatus = 'idle';
      connection.accessToken = undefined;
      connection.refreshToken = undefined;
      await connection.save();

      if (purgeData) {
        await HealthMetricSample.deleteMany({ userId, platform });
        await HealthDailySummary.deleteMany({ userId, platform });
      }

      res.json({
        success: true,
        message: `Successfully disconnected ${platform}.${purgeData ? ' Associated health metrics purged.' : ''}`,
      });
    } catch (err: any) {
      logger.error('Wearables disconnect error', { error: err?.message });
      sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
    }
  }
);

// GET /api/v1/wearables/fitbit/authorize - Real Fitbit OAuth2 entry point
router.get(
  '/fitbit/authorize',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!env.FITBIT_CLIENT_ID || !env.FITBIT_CLIENT_SECRET) {
        sendError(res, 400, ErrorCode.INTEGRATION_NOT_CONFIGURED, 'Fitbit integration is Not Configured', {
          hint: 'Missing FITBIT_CLIENT_ID / FITBIT_CLIENT_SECRET in server environment. Please configure Fitbit developer credentials to initiate live authorization.',
        });
        return;
      }

      const state = crypto.randomBytes(16).toString('hex');
      const scopes = ['heartrate', 'activity', 'sleep', 'respiratory_rate', 'oxygen_saturation'];

      const fitbitUrl = `https://www.fitbit.com/oauth2/authorize?response_type=code&client_id=${
        env.FITBIT_CLIENT_ID
      }&redirect_uri=${encodeURIComponent(
        env.FITBIT_REDIRECT_URI
      )}&scope=${encodeURIComponent(scopes.join(' '))}&state=${state}`;

      res.json({
        success: true,
        authorizationUrl: fitbitUrl,
        state,
      });
    } catch (err: any) {
      logger.error('Fitbit authorization URL generation error', { error: err?.message });
      sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
    }
  }
);

// GET /api/v1/wearables/metrics - Retrieve real ingested metrics history
router.get('/metrics', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id;
    const { metric, limit = 50 } = req.query;

    const filter: any = { userId };
    if (metric) filter.metric = metric;

    const samples = await HealthMetricSample.find(filter)
      .sort({ measuredAt: -1 })
      .limit(Math.min(parseInt(limit as string, 10) || 50, 200))
      .lean();

    res.json({
      success: true,
      count: samples.length,
      data: samples,
    });
  } catch (err: any) {
    logger.error('Wearables metrics retrieval error', { error: err?.message });
    sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
  }
});

// GET /api/v1/wearables/summary - Daily aggregate summary
router.get('/summary', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id;
    const todayStr = new Date().toISOString().split('T')[0];

    const todaySummary = await HealthDailySummary.findOne({ userId, date: todayStr }).lean();
    const latestSamples = await HealthMetricSample.find({ userId })
      .sort({ measuredAt: -1 })
      .limit(10)
      .lean();

    res.json({
      success: true,
      summary: todaySummary || null,
      recentSamples: latestSamples,
    });
  } catch (err: any) {
    logger.error('Wearables summary retrieval error', { error: err?.message });
    sendError(res, 500, ErrorCode.INTERNAL, 'Internal server error.');
  }
});

export default router;
