import type { Request, Response } from "express";
import type { Model } from "mongoose";
import { getGameModel, getGameStatsModel } from "../games/games.models.js";
import type { IGame, IGameStats } from "../games/interface/index.js";

export class LeaderboardController {
    private gameModel: Model<IGame>;
    private gameStatsModel: Model<IGameStats>;
    
    constructor(){
        this.gameModel = getGameModel();
        this.gameStatsModel = getGameStatsModel();
    }

    // GET /leaderboard/global
    getGlobalLeaderboard = async (req: Request, res: Response): Promise<void> => {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const skip = (page - 1) * limit;
            
            const pipeline = [
                {
                    $group: {
                        _id: "$userId",
                        cumulativeScore: { $sum: "$finalScore" }
                    }
                },
                {
                    $facet: {
                        metadata: [ { $count: "total" } ],
                        data: [
                            { $sort: { cumulativeScore: -1 as const } },
                            { $skip: skip },
                            { $limit: limit },
                            {
                                $lookup: {
                                    from: "users",
                                    localField: "_id",
                                    foreignField: "_id",
                                    as: "user"
                                }
                            },
                            { $unwind: "$user" },
                            {
                                $project: {
                                    _id: 0,
                                    userId: "$_id",
                                    username: "$user.username",
                                    cumulativeScore: "$cumulativeScore"
                                }
                            }
                        ]
                    }
                }
            ];

            const result = await this.gameStatsModel.aggregate(pipeline);
            
            const totalRecords = result[0]?.metadata[0]?.total || 0;
            const totalPages = Math.ceil(totalRecords / limit) || 1;
            const leaderboard = result[0]?.data || [];

            res.status(200).json({ data: leaderboard, totalPages });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    }

    // GET /leaderboard/:gameId
    getGameLeaderboard = async (req: Request, res: Response): Promise<void> => {
        try {
            const { gameId } = req.params;
            const limit = parseInt(req.query.limit as string) || 10;
            let game: any = null;
            try {
                game = await this.gameModel.findById(gameId);
            } catch {
                // The endpoint also accepts a human-readable game name.
            }
            if (!game) game = await this.gameModel.findOne({ name: gameId });
            if (!game) {
                game = await this.gameModel.findOneAndUpdate(
                    { name: gameId },
                    {
                        name: gameId,
                        type: "A",
                        description: gameId === "brick-breaker" ? "TEDx Brick Breaker" : gameId === "snake" || gameId === "snakes" ? "TEDx Snake" : "TEDx 3D Maze Escape",
                        maxRawScore: 1000,
                    },
                    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
                );
            }
            if (!game) {
                res.status(404).json({ error: "Game not found" });
                return;
            }

            const leaderboard = await this.gameStatsModel.aggregate([
                { $match: { gameId: game._id } },
                {
                    $lookup: {
                        from: "users",
                        localField: "userId",
                        foreignField: "_id",
                        as: "user"
                    }
                },
                { $unwind: "$user" },
                {
                    $project: {
                        _id: 0,
                        userId: 1,
                        username: "$user.username",
                        cumulativeScore: "$finalScore",
                        rawScore: 1,
                        timeTaken: 1
                    }
                },
                { $sort: { cumulativeScore: -1 } },
                { $limit: limit }
            ]);

            res.status(200).json({ data: leaderboard });
            
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    }
}
