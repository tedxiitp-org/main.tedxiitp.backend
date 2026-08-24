import mongoose, { Schema, model } from "mongoose";
import type { IGame, IGameStats } from "./interface/index.js";

const GameSchema = new Schema<IGame>({
    name: { type: String, required: true },
    type: { type: String, enum: ['A', 'B'], required: true },
    description: { type: String },
    maxRawScore: { type: Number },
    createdAt: { type: Date, default: Date.now }
});

const GameStatsSchema = new Schema<IGameStats>({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    gameId: { type: Schema.Types.ObjectId, ref: 'Game', required: true },
    rawScore: { type: Number },
    timeTaken: { type: Number },
    finalScore: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now }
});

export const getGameModel = () => mongoose.models.Game || model<IGame>("Game", GameSchema);
export const getGameStatsModel = () => mongoose.models.GameStats || model<IGameStats>("GameStats", GameStatsSchema);
