import { Router } from 'express';
import { generateTicket } from '../controller/qr.controller.js';
import { validateScan } from '../controller/qr.controller.js';
import { loginAdmin, logoutAdmin } from '../controller/auth.controller.js';

import {
  getStats,
  handleRevoke,
  handleRevokeBulk,
  getVolunteerStats,
  generateTicketsBulk,
  getAttendees,
  exportAttendees,
} from '../controller/qr.controller.js';
import {
  createVolunteer,
  listVolunteers,
  deleteVolunteer,
} from '../controller/volunteer.controller.js';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';

const router = Router();

// Admin Only Routes
router.get('/admin/attendance', requireAuth, requireAdmin, getStats);
router.get('/admin/attendees', requireAuth, requireAdmin, getAttendees);
router.get('/admin/attendees/export', requireAuth, requireAdmin, exportAttendees);
router.get('/admin/scan-stats', requireAuth, requireAdmin, getVolunteerStats);
router.patch('/admin/ticket/revoke', requireAuth, requireAdmin, handleRevoke);
router.patch('/admin/ticket/revoke-bulk', requireAuth, requireAdmin, handleRevokeBulk);

// Admin: volunteer management
router.get('/admin/volunteers', requireAuth, requireAdmin, listVolunteers);
router.post('/admin/volunteers', requireAuth, requireAdmin, createVolunteer);
router.delete('/admin/volunteers/:id', requireAuth, requireAdmin, deleteVolunteer);

// Endpoint: POST /api/qr/generate
router.post('/generate', requireAuth, requireAdmin, generateTicket);
router.post('/generate-bulk', requireAuth, requireAdmin, generateTicketsBulk);

// Volunteer Route: Requires login, but NO admin check
router.post('/validate', requireAuth, validateScan);

// Auth Routes (mapped to /api/qr/auth/*)
router.post('/auth/login', loginAdmin);
router.post('/auth/logout', logoutAdmin);

export default router;