import { Schema, model, models } from "mongoose";
import type { IExample } from "./interface/index.js";

const ExampleModelSchema = new Schema<IExample>({
    name: { type: String, required: true }
});

export const getExampleModel = () => models.Example || model<IExample>("Example", ExampleModelSchema);
