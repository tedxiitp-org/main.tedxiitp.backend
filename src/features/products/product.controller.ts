import express from 'express';
import { ProductModel } from './product.model.js';
import { sendError, sendSuccess } from "../../scripts/controllerHelpers.js";

export async function getAllProducts(req: express.Request, res: express.Response) {
    try {
        const products = await ProductModel.find({});
        return sendSuccess(res, 200, "Products fetched successfully", products);
    }
    catch (err: unknown) {
        if (err instanceof Error) {
            return sendError(res, 500, err.message);    
        }
        return sendError(res, 500, "Unknown Error");
    }
}

export async function getProductById(req: express.Request, res: express.Response) {
    const id = req.params.id;
    if (!id) {
        return sendError(res, 400, "No Id Provided");
    }
    try {
        const product = await ProductModel.findOne({ slug: id });
        if (!product) {
            return sendError(res, 404, "Product not found");
        }
        return sendSuccess(res, 200, "Product fetched successfully", product);
    }
    catch (err: unknown) {
        if (err instanceof Error) {
            return sendError(res, 500, err.message);    
        }
        return sendError(res, 500, "Unknown Error");
    }
}
