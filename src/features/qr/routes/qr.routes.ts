import { Router } from 'express';
import {
  generateTicket,
  validateScan,
  getStats,
  getAttendees,
  exportAttendees,
  getVolunteerStats,
  handleRevoke,
  handleRevokeBulk,
  deliverUnsentTickets,
} from '../controller/qr.controller.js';
import {
  createVolunteer,
  listVolunteers,
  updateVolunteer,
  deleteVolunteer,
} from '../controller/volunteer.controller.js';
import { requireAuth, requireAdmin } from '../../../middleware/auth.middleware.js';

const router = Router();

router.get('/admin/attendance', requireAuth, requireAdmin, getStats);
router.get('/admin/attendees', requireAuth, requireAdmin, getAttendees);
router.get('/admin/attendees/export', requireAuth, requireAdmin, exportAttendees);
router.get('/admin/scan-stats', requireAuth, requireAdmin, getVolunteerStats);
router.patch('/admin/ticket/revoke', requireAuth, requireAdmin, handleRevoke);
router.patch('/admin/ticket/revoke-bulk', requireAuth, requireAdmin, handleRevokeBulk);

router.get('/admin/volunteers', requireAuth, requireAdmin, listVolunteers);
router.post('/admin/volunteers', requireAuth, requireAdmin, createVolunteer);
router.patch('/admin/volunteers/:id', requireAuth, requireAdmin, updateVolunteer);
router.delete('/admin/volunteers/:id', requireAuth, requireAdmin, deleteVolunteer);

router.post('/generate', requireAuth, requireAdmin, generateTicket);
router.post('/admin/tickets/deliver-unsent', requireAuth, requireAdmin, deliverUnsentTickets);

router.get('/me', requireAuth, (req, res) => {
  res.status(200).json({ success: true, data: req.principal });
});

router.post('/validate', requireAuth, validateScan);

export default router;
