import express from 'express';
import { createProduct, deleteProduct, updateProduct } from './admin.controller.js';

const router = express.Router();

router.post("/", createProduct);
router.patch("/:id", updateProduct);
router.delete("/:id", deleteProduct);

export default router;
