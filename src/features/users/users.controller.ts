import type { Request, Response } from "express";
import type { Model } from "mongoose";
import type { IUser } from "./interface/index.js";
import { getUserModel } from "./users.models.js";

export class UsersController {
    private userModel: Model<IUser>;
    constructor(){
        this.userModel = getUserModel();
    }
    
    // Register or get existing user by username
    identity = async (req: Request, res: Response): Promise<void> => {
        try {
            const { username } = req.body;
            
            if (!username) {
                res.status(400).json({ error: "Username is required" });
                return;
            }

            let user = await this.userModel.findOne({ username });
            
            if (user) {
                res.status(200).json({
                    message: "Identity retrieved successfully",
                    userId: user._id,
                    username: user.username
                });
                return;
            }
            
            user = await this.userModel.create({ username });
            
            res.status(200).json({
                message: "Identity retrieved successfully",
                userId: user._id,
                username: user.username
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    }
}
