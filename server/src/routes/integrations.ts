import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middlewares/auth';
import { sendOk } from '../utils/response';
import { getIntegrationsReport } from '../config/integrations';

const router = Router();

/**
 * GET /api/v1/integrations
 *
 * Reports exactly which optional integrations are live in this environment.
 * The UI must render "Not Configured" from this rather than implying that all
 * integrations are active.
 */
router.get('/', authenticate, (_req: AuthRequest, res: Response): void => {
  const integrations = getIntegrationsReport();
  const configured = [
    integrations.ai.configured ? 'ai' : null,
    integrations.email.configured ? 'email' : null,
    integrations.maps.configured ? 'maps' : null,
    integrations.wearables.webBluetooth.configured ? 'wearables.webBluetooth' : null,
  ].filter(Boolean);

  sendOk(res, { integrations }, { configured });
});

export default router;
