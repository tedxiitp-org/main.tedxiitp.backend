import { Router } from 'express';
import { getNotes, createNote, likeNote, unlikeNote, deleteNote } from './controllers/index.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { AdminRole } from '../../types/index.js';

const router = Router();

router.route('/')
    .get(getNotes)
    .post(createNote);

router.route('/:id')
    .delete(authenticate, authorize(AdminRole.SuperAdmin, AdminRole.Admin), deleteNote);

router.route('/:id/like')
    .patch(likeNote);

router.route('/:id/unlike')
    .patch(unlikeNote);

export default router;
