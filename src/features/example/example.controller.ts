import type { Request, Response } from "express";

export class ExampleController {
    async getExample(req: Request, res: Response) {
        try {
            res.status(200).json({
                message: "This is an example response from ExampleController"
            });
        } catch (error) {
            res.status(500).json({ error: "Internal Server Error" });
        }
    }
}
