import { Router } from "express";
import { ExampleController } from "./example.controller.js";

export const exampleRoutes = Router();

const exampleController = new ExampleController();

exampleRoutes.get("/", exampleController.getExample);
