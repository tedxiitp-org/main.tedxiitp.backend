import express from 'express';
import { getAllProducts, getProductById } from './product.controller.js';

const router = express.Router();

router.get('/', getAllProducts);
router.get('/:id', getProductById);

export default router;
