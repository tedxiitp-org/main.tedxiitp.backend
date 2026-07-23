import { Router } from "express";
import { GamesController } from "./games.controller.js";

export const gamesRoutes = Router();
const gamesController = new GamesController();

gamesRoutes.get("/", gamesController.listGames);
gamesRoutes.post("/", gamesController.createGame);
gamesRoutes.post("/:gameId/submit-stats", gamesController.submitStats);
gamesRoutes.get("/:gameId/stats/:userId", gamesController.getUserStats);
