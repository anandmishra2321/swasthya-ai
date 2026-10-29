import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { searchHealthcareProviders, geocodeLocation } from '../services/healthcareDiscoveryService';
import { sendError, ErrorCode } from '../utils/response';
import { logger } from '../utils/logger';

const router = Router();

const searchQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).default(24.5362), // Default Rewa, MP
  lng: z.coerce.number().min(-180).max(180).default(81.3037),
  radiusKm: z.coerce.number().min(1).max(100).default(10),
  types: z.string().optional(),
  search: z.string().optional(),
});

// GET /api/v1/healthcare/search
router.get('/search', async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = searchQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      sendError(res, 400, ErrorCode.VALIDATION_FAILED, 'Invalid query parameters', parseResult.error.format());
      return;
    }

    const { lat, lng, radiusKm, types, search } = parseResult.data;
    const typeList = types ? types.split(',').map((t) => t.trim().toLowerCase()) : [];

    const data = await searchHealthcareProviders({
      lat,
      lng,
      radiusKm,
      types: typeList,
      search: search || '',
    });

    res.json({
      success: true,
      count: data.results.length,
      metadata: data.metadata,
      data: data.results,
    });
  } catch (err: any) {
    logger.error('Healthcare search error:', { error: err?.message });
    sendError(res, 500, ErrorCode.INTERNAL, 'Failed to search nearby healthcare providers');
  }
});

// GET /api/v1/healthcare/geocode
router.get('/geocode', async (req: Request, res: Response): Promise<void> => {
  try {
    const q = (req.query.q as string) || '';
    const results = await geocodeLocation(q);

    res.json({
      success: true,
      count: results.length,
      data: results,
    });
  } catch (err: any) {
    logger.error('Geocode error:', { error: err?.message });
    sendError(res, 500, ErrorCode.INTERNAL, 'Failed to geocode location');
  }
});

export default router;
