import mongoose, { Schema, model } from "mongoose";
import type { IReview } from "./interface/index.js";

const ReviewSchema = new Schema<IReview>({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    createdAt: { type: Date, default: Date.now }
});

export const getReviewModel = () => mongoose.models.Review || model<IReview>("Review", ReviewSchema);
