import mongoose, { Schema, model } from "mongoose";
import type { IExample } from "./interface/index.js";

const ExampleModelSchema = new Schema<IExample>({
    name: { type: String, required: true }
});

export const getExampleModel = () => mongoose.models.Example || model<IExample>("Example", ExampleModelSchema);
