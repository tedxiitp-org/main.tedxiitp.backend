import { Router } from "express";
import { LeaderboardController } from "./leaderboard.controller.js";

export const leaderboardRoutes = Router();
const leaderboardController = new LeaderboardController();

leaderboardRoutes.get("/global", leaderboardController.getGlobalLeaderboard);
leaderboardRoutes.get("/:gameId", leaderboardController.getGameLeaderboard);
