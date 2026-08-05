import type { Types } from "mongoose";

export interface IReview {
    userId: Types.ObjectId;
    gameId: Types.ObjectId;
    text: string;
    rating: number; // 1 to 5
    createdAt: Date;
}
