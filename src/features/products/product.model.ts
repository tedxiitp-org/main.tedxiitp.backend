import { Schema, model, Types } from "mongoose";

export interface IProduct {
  _id?: Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  type: "MERCH" | "TICKET";
  price: number;
  currency: string;
  stock: number;
  isUnlimitedStock: boolean;
  images: string[];
  sizes?: string[];
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
    },
    description: {
      type: String,
    },
    type: {
      type: String,
      enum: ["MERCH", "TICKET"],
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "INR",
    },
    stock: {
      type: Number,
      default: 0,
    },
    isUnlimitedStock: {
      type: Boolean,
      default: false,
    },
    images: {
      type: [String],
      default: [],
    },
    sizes: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export const ProductModel = model<IProduct>("Product", ProductSchema);
