import type { Types } from "mongoose";

export interface IGame {
    name: string;
    type: 'A' | 'B';
    description?: string;
    maxRawScore?: number;
    createdAt: Date;
}

export interface IGameStats {
    userId: Types.ObjectId;
    gameId: Types.ObjectId;
    rawScore?: number; // for type A
    timeTaken?: number; // for type B (in seconds)
    finalScore: number; // calculated standardized score
    createdAt: Date;
}
