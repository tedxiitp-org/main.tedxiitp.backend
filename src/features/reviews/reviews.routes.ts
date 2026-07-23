import { Router } from "express";
import { ReviewsController } from "./reviews.controller.js";

export const reviewsRoutes = Router();
const reviewsController = new ReviewsController();

reviewsRoutes.post("/", reviewsController.createReview);
reviewsRoutes.get("/", reviewsController.getReviews);
reviewsRoutes.delete("/:id", reviewsController.deleteReview);
