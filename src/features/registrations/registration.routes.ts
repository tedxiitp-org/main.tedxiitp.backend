import { Router } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth.middleware.js';
import {
  approveRegistration,
  autoSync,
  bulkApprove,
  getRegistration,
  getRegistrationStats,
  getSyncState,
  importRows,
  listRegistrations,
  purgeRemovedRegistrations,
  rejectRegistration,
  sheetWebhook,
  syncSheet,
  updateRegistration,
} from './registration.controller.js';

const router = Router();

router.post('/hook', sheetWebhook);

router.use(requireAuth, requireAdmin);

router.get('/', listRegistrations);
router.get('/stats', getRegistrationStats);
router.get('/sync-state', getSyncState);
router.post('/sync', syncSheet);
router.post('/auto-sync', autoSync);
router.post('/import', importRows);
router.post('/bulk-approve', bulkApprove);
router.post('/purge-removed', purgeRemovedRegistrations);
router.get('/:id', getRegistration);
router.patch('/:id', updateRegistration);
router.post('/:id/approve', approveRegistration);
router.post('/:id/reject', rejectRegistration);

export default router;
