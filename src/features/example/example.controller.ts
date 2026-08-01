import type { Request, Response } from "express";
import type { Model } from "mongoose";
import type { IExample } from "./interface/index.js";
import { getExampleModel } from "./example.models.js";

export class ExampleController {
    private exampleModel: Model<IExample>;
    constructor(){
        this.exampleModel = getExampleModel();
    }
    async getExample(req: Request, res: Response) {
        try {
            const { name } = req.body;
            // in same we can create update delete and get the item
            const exampleCall = await this.exampleModel.create({name: name});
            res.status(200).json({
                message: "This is an example response from ExampleController",
                data: exampleCall
            });
        } catch (error) {
            res.status(500).json({ error: "Internal Server Error" });
        }
    }
}
