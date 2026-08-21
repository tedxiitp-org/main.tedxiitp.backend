import type { Request, Response } from "express";
import type { Model } from "mongoose";
import { getGameStatsModel } from "../games/games.models.js";
import type { IGameStats } from "../games/interface/index.js";

export class LeaderboardController {
    private gameStatsModel: Model<IGameStats>;
    
    constructor(){
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
                                    id: "$_id",
                                    playerName: "$user.username",
                                    score: "$cumulativeScore"
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
            
            // Note: because we need to convert string gameId to ObjectId for aggregation if using pure native mongo,
            // mongoose handles this automatically in find() but in aggregate it might need mongoose.Types.ObjectId.
            import("mongoose").then(mongoose => {
                const gameObjectId = new mongoose.Types.ObjectId(gameId as string);
                
                const pipeline = [
                    {
                        $match: { gameId: gameObjectId }
                    },
                    {
                        $lookup: {
                            from: "users",
                            localField: "userId",
                            foreignField: "_id",
                            as: "user"
                        }
                    },
                    {
                        $unwind: "$user"
                    },
                    {
                        $project: {
                            _id: 0,
                            userId: 1,
                            username: "$user.username",
                            finalScore: 1,
                            rawScore: 1,
                            timeTaken: 1
                        }
                    },
                    {
                        $sort: { finalScore: -1 as const }
                    },
                    {
                        $limit: limit
                    }
                ];

                return this.gameStatsModel.aggregate(pipeline);
            }).then(leaderboard => {
                res.status(200).json({ data: leaderboard });
            }).catch(error => {
                console.error(error);
                res.status(500).json({ error: "Internal Server Error" });
            });
            
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    }
}
