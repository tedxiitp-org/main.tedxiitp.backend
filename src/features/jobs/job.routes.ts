import { Router } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth.middleware.js';
import {
  cancelTicketJob,
  previewTicketBatch,
  pumpActiveJob,
  createTicketJob,
  getJob,
  listJobs,
  pumpTicketJob,
  retryJobFailures,
} from './job.controller.js';

const router = Router();

router.post('/pump-active', pumpActiveJob);

router.use(requireAuth, requireAdmin);

router.get('/', listJobs);
router.get('/preview', previewTicketBatch);
router.post('/', createTicketJob);
router.get('/:id', getJob);
router.post('/:id/pump', pumpTicketJob);
router.post('/:id/retry-failed', retryJobFailures);
router.post('/:id/cancel', cancelTicketJob);

export default router;
