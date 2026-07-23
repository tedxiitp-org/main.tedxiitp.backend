import mongoose, { Schema, model } from "mongoose";
import type { IUser } from "./interface/index.js";

const UserSchema = new Schema<IUser>({
    username: { type: String, required: true, unique: true },
    createdAt: { type: Date, default: Date.now }
});

export const getUserModel = () => mongoose.models.User || model<IUser>("User", UserSchema);
