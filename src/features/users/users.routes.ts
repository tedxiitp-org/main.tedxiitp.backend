import { Router } from "express";
import { UsersController } from "./users.controller.js";

export const usersRoutes = Router();
const usersController = new UsersController();

usersRoutes.post("/identity", usersController.identity);
