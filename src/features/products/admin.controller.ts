import express from 'express';
import { ProductModel } from "./product.model.js";
import { sendError, sendSuccess } from "../../scripts/controllerHelpers.js";

export async function createProduct(req: express.Request, res: express.Response) {
    const body = req.body;
    if (body.name === undefined || body.price === undefined || body.slug === undefined || body.type === undefined) {
        return sendError(res, 400, "Missing required fields");
    }
    try {
        const price = Number(body.price);
        const stock = Number(body.stock ?? 0);

        if (!Number.isFinite(price) || price < 0 || !Number.isFinite(stock) || stock < 0) {
            throw new Error("Price or Stock needs to be non-negative");
        }
        const product = await ProductModel.create({
          ...body,
          price,
          stock,
          sizes: typeof body.sizes === "string" ? body.sizes.split(",") : body.sizes,
          images: typeof body.images === "string" ? body.images.split(",") : body.images,
        });
        return sendSuccess(res, 201, "Product created successfully", product);
    }
    catch (err: unknown) {
        if (err instanceof Error) {
            return sendError(res, 500, err.message);
        }
        return sendError(res, 500, "Unknown Error");
    }    
}

export async function updateProduct(req: express.Request, res: express.Response) {
    const id = req.params.id;
    const body = req.body;
    if (!body || !id) {
        return sendError(res, 400, "No update request provided");
    }
    try {
        const updatePayload = {
          ...body,
          ...(body.price !== undefined ? { price: Number(body.price) } : {}),
          ...(body.stock !== undefined ? { stock: Number(body.stock) } : {}),
          sizes: typeof body.sizes === "string" ? body.sizes.split(",") : body.sizes,
          images: typeof body.images === "string" ? body.images.split(",") : body.images,
        };

        if ((updatePayload.price !== undefined && (!Number.isFinite(updatePayload.price) || updatePayload.price < 0)) || (updatePayload.stock !== undefined && (!Number.isFinite(updatePayload.stock) || updatePayload.stock < 0))) {
            throw new Error("Price or Stock needs to be non-negative");
        }
        const product = await ProductModel.findOneAndUpdate(
          { slug: id },
          updatePayload,
          { new: true, runValidators: true },
        );

        if (!product) {
          return sendError(res, 404, "Product not found");
        }

        return sendSuccess(res, 200, "Product updated successfully", product);
    }
    catch (err: unknown) {
        if (err instanceof Error) {
            return sendError(res, 500, err.message);
        }
        return sendError(res, 500, "Unknown Error");
    }
}

export async function deleteProduct(req: express.Request, res: express.Response) {
    const id = req.params.id;
    if (!id) {
        return sendError(res, 400, "No Product Id Given");
    }
    try {
        const result = await ProductModel.deleteOne({ slug: id });
        if (result.deletedCount === 0) {
            return sendError(res, 404, "Product not found");
        }

        return sendSuccess(res, 200, "Product deleted successfully", { deletedCount: result.deletedCount });
    }
    catch (err: unknown) {
        if (err instanceof Error) {
            return sendError(res, 500, err.message);
        }
        return sendError(res, 500, "Unknown Deletion Error");
    }
}
