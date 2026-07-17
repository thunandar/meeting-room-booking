import { Router } from 'express';
import { requireActor } from '../middleware/authenticate.js';
import { ApiError } from '../errors.js';
import { canViewSummary } from '../domain/permissions.js';
import { getUsageSummary } from '../services/summary-service.js';

export const summaryRouter = Router();

summaryRouter.get('/', async (req, res) => {
  const actor = requireActor(req);
  if (!canViewSummary(actor)) {
    throw ApiError.forbidden('Only owners and admins can view the usage summary.');
  }
  const summary = await getUsageSummary();
  res.json({ summary });
});
