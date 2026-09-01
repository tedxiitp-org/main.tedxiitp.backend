import express from 'express';
import { addItemHandler, clearCartHandler, getCartHandler, removeItemHandler, updateItemHandler } from './cart.controller.js';

const router = express.Router();

router.get("/:userId", getCartHandler);
router.get("/", getCartHandler);
router.post("/add", addItemHandler);
router.patch("/update", updateItemHandler);
router.delete("/clear", clearCartHandler);
router.delete("/remove/:productId", removeItemHandler);

export default router;
