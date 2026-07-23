import type { Request, Response } from "express";
import type { Model } from "mongoose";
import type { IReview } from "./interface/index.js";
import { getReviewModel } from "./reviews.models.js";

export class ReviewsController {
    private reviewModel: Model<IReview>;
    
    constructor(){
        this.reviewModel = getReviewModel();
    }
    
    // POST /reviews
    createReview = async (req: Request, res: Response): Promise<void> => {
        try {
            const { userId, text, rating } = req.body;
            
            if (!userId || !text || rating === undefined) {
                res.status(400).json({ error: "userId, text, and rating are required" });
                return;
            }

            if (rating < 1 || rating > 5) {
                res.status(400).json({ error: "rating must be between 1 and 5" });
                return;
            }

            const review = await this.reviewModel.create({ userId, text, rating });
            res.status(201).json({ message: "Review created successfully", data: review });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    }

    // GET /reviews
    getReviews = async (req: Request, res: Response): Promise<void> => {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const skip = (page - 1) * limit;

            const reviews = await this.reviewModel
                .find({})
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate("userId", "username") // Assumes User model exists
                .exec();

            const total = await this.reviewModel.countDocuments();

            res.status(200).json({
                data: reviews,
                meta: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit)
                }
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    }

    // DELETE /reviews/:id
    deleteReview = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const { userId } = req.body; // In real app, might come from headers or auth middleware
            
            if (!userId) {
                res.status(400).json({ error: "userId is required in the body to delete a review" });
                return;
            }

            const review = await this.reviewModel.findById(id);
            if (!review) {
                res.status(404).json({ error: "Review not found" });
                return;
            }

            if (review.userId.toString() !== userId) {
                res.status(403).json({ error: "You are not authorized to delete this review" });
                return;
            }

            await this.reviewModel.findByIdAndDelete(id);
            res.status(200).json({ message: "Review deleted successfully" });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    }
}
