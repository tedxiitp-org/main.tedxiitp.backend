import { Router } from 'express';
import { getMemories, createMemory, likeMemory, unlikeMemory, deleteMemory } from './controllers/index.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { AdminRole } from '../../types/index.js';

const router = Router();

router.route('/')
    .get(getMemories)
    .post(createMemory);

router.route('/:id')
    .delete(authenticate, authorize(AdminRole.SuperAdmin, AdminRole.Admin), deleteMemory);

router.route('/:id/like')
    .patch(likeMemory);

router.route('/:id/unlike')
    .patch(unlikeMemory);

export default router;
