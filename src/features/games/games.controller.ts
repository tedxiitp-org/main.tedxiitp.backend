import type { Request, Response } from "express";
import type { Model } from "mongoose";
import type { IGame, IGameStats } from "./interface/index.js";
import { getGameModel, getGameStatsModel } from "./games.models.js";
import { getUserModel } from "../users/users.models.js";

export class GamesController {
    private gameModel: Model<IGame>;
    private gameStatsModel: Model<IGameStats>;
    private userModel: any;
    
    constructor(){
        this.gameModel = getGameModel();
        this.gameStatsModel = getGameStatsModel();
        this.userModel = getUserModel();
    }
    
    // GET /games
    listGames = async (req: Request, res: Response): Promise<void> => {
        try {
            const games = await this.gameModel.find({});
            res.status(200).json({ data: games });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    }

    // POST /games (For testing/admin: Create a new game)
    createGame = async (req: Request, res: Response): Promise<void> => {
        try {
            const { name, type, description } = req.body;
            
            if (!name || !type) {
                res.status(400).json({ error: "name and type ('A' or 'B') are required" });
                return;
            }

            const game = await this.gameModel.create({ name, type, description });
            res.status(201).json({ message: "Game created successfully", data: game });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    }

    // POST /games/:gameId/submit-stats
    submitStats = async (req: Request, res: Response): Promise<void> => {
        try {
            const { gameId } = req.params;
            const { userId, rawScore, timeTaken } = req.body;

            if (!userId) {
                res.status(400).json({ error: "userId is required" });
                return;
            }

            let game: any = null;
            try {
                game = await this.gameModel.findById(gameId);
            } catch (err) {
                // Ignore CastError
            }
            if (!game) {
                game = await this.gameModel.findOne({ name: gameId });
            }
            if (!game && (gameId === "snake" || gameId === "snakes" || gameId === "brick-breaker")) {
                game = await this.gameModel.findOneAndUpdate(
                    { name: gameId === "brick-breaker" ? "brick-breaker" : "snake" },
                    {
                        name: gameId === "brick-breaker" ? "brick-breaker" : "snake",
                        type: "A",
                        description: gameId === "brick-breaker" ? "TEDx Brick Breaker" : "TEDx Snake",
                        maxRawScore: 1000,
                    },
                    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
                );
            }
            if (!game) {
                res.status(404).json({ error: "Game not found" });
                return;
            }
            const resolvedGameId = game._id;

            const user = await this.userModel.findById(userId);
            if (!user) {
                res.status(404).json({ error: "User not found" });
                return;
            }

            let finalScore = 0;

            if (game.type === 'A') {
                if (rawScore === undefined) {
                    res.status(400).json({ error: "rawScore is required for Game Type A" });
                    return;
                }
                const rawNum = Number(rawScore);
                const maxRawScore = game.maxRawScore || 1000;
                finalScore = Math.round((rawNum / maxRawScore) * 1000);
                
                // Track highest score for Type A
                const existingStats = await this.gameStatsModel.findOne({ userId: userId as string, gameId: resolvedGameId as string });
                if (existingStats) {
                    if (finalScore > existingStats.finalScore) {
                        await this.gameStatsModel.updateOne({ _id: (existingStats as any)._id }, { finalScore, rawScore });
                        const updatedStats = await this.gameStatsModel.findOne({ userId: userId as string, gameId: resolvedGameId as string });
                        res.status(200).json({ message: "New high score achieved!", data: updatedStats });
                        return;
                    } else {
                        res.status(200).json({ message: "Score submitted, but not a new high score.", data: existingStats });
                        return;
                    }
                }
            } else if (game.type === 'B') {
                if (timeTaken === undefined) {
                    res.status(400).json({ error: "timeTaken is required for Game Type B" });
                    return;
                }
                // Time-to-Score conversion logic: normalized to 1000 points.
                // maxRawScore represents maximum expected time (e.g., 100s)
                const timeNum = Number(timeTaken);
                const maxExpectedTime = game.maxRawScore || 100;
                finalScore = Math.max(0, Math.round((1 - (timeNum / maxExpectedTime)) * 1000));

                // Track fastest time (highest score) for Type B
                const existingStats = await this.gameStatsModel.findOne({ userId: userId as string, gameId: resolvedGameId as string });
                if (existingStats) {
                    if (finalScore > existingStats.finalScore) {
                        await this.gameStatsModel.updateOne({ _id: (existingStats as any)._id }, { finalScore, timeTaken });
                        const updatedStats = await this.gameStatsModel.findOne({ userId: userId as string, gameId: resolvedGameId as string });
                        res.status(200).json({ message: "New best time achieved!", data: updatedStats });
                        return;
                    } else {
                        res.status(200).json({ message: "Time submitted, but not a new best time.", data: existingStats });
                        return;
                    }
                }
            }

            const newStats = await this.gameStatsModel.create({
                userId: userId as string,
                gameId: resolvedGameId as string,
                rawScore,
                timeTaken,
                finalScore
            });

            res.status(201).json({ message: "Stats submitted successfully", data: newStats });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    }

    // GET /games/:gameId/stats/:userId
    getUserStats = async (req: Request, res: Response): Promise<void> => {
        try {
            const { gameId, userId } = req.params;
            let game: any = null;
            try {
                game = await this.gameModel.findById(gameId);
            } catch (err) {
                // Ignore CastError
            }
            if (!game) {
                game = await this.gameModel.findOne({ name: gameId });
            }
            if (!game) {
                res.status(404).json({ error: "Game not found" });
                return;
            }
            const resolvedGameId = game._id;
            
            const stats = await this.gameStatsModel.findOne({ gameId: resolvedGameId as string, userId: userId as string });

            
            if (!stats) {
                res.status(404).json({ error: "Stats not found for this user and game" });
                return;
            }

            res.status(200).json({ data: stats });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    }
}
