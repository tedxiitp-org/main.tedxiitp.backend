import express from "express";
import { CartModel } from "./cart.model.js";
import { ProductModel } from "../products/product.model.js";
import { parseObjectId, sendError, sendSuccess } from "../../scripts/controllerHelpers.js";

export async function getCartHandler(
  req: express.Request,
  res: express.Response,
) {
  const userId = req.params.userId ?? req.query.userId ?? req.body?.userId;
  const oid = parseObjectId(userId);

  if (!oid) {
    return sendError(res, 400, "Invalid or missing User ID");
  }

  try {
    const cart = await CartModel.findOne({ userId: oid });

    if (!cart) {
      return sendError(res, 404, "Cart not found");
    }

    if (cart.status !== "PENDING") {
      await CartModel.deleteOne({ userId: oid });
      return res.status(409).json({
        success: false,
        message: "Cart is not pending and was removed",
        data: null,
      });
    }

    if (cart.items.length > 0) {
      const productIds = cart.items.map((item) => item.productId);
      const products = await ProductModel.find({ _id: { $in: productIds } }).select(
        "_id price",
      );

      const priceByProductId = new Map(
        products.map((product) => [product._id.toString(), product.price]),
      );

      let subtotal = 0;

      for (const item of cart.items) {
        const currentPrice = priceByProductId.get(item.productId.toString());

        if (typeof currentPrice === "number") {
          item.priceAtPurchase = currentPrice;
        }

        subtotal += item.quantity * item.priceAtPurchase;
      }

      cart.subtotal = subtotal;
      cart.total = subtotal;
      await cart.save();
    }

    return sendSuccess(res, 200, "Cart fetched successfully", cart);
  } catch (err: unknown) {
    if (err instanceof Error) {
      return sendError(res, 500, err.message);
    }
    return sendError(res, 500, "Unknown Error");
  }
}

export async function addItemHandler(
  req: express.Request,
  res: express.Response,
) {
  const body = req.body;
  if (!body.userId || !body.productId || !body.quantity || !body.productType) {
    return sendError(res, 400, "Missing required data to add in cart");
  }

  try {
    if (body.productType === "MERCH") {
      if (!body.selectedSize) {
        return sendError(res, 400, "Missing size for merch product");
      }
    }
    const product = await ProductModel.findOne({ slug: body.productId });
    if (!product) {
      return sendError(res, 404, "Product not found");
    }

    const quantity = Number(body.quantity);
    if (!Number.isFinite(quantity) || quantity < 1) {
      return sendError(res, 400, "Invalid quantity");
    }

    if (product.stock < quantity && !product.isUnlimitedStock) {
      return sendError(res, 400, "Product out of stock");
    }

    const cartItem = {
      productId: product._id,
      quantity,
      productType: product.type,
      priceAtPurchase: product.price,
      selectedSize: body.selectedSize,
    };

    const oid = parseObjectId(body.userId);
    if (!oid) {
      return sendError(res, 400, "Invalid User ID");
    }

    const cart = await CartModel.findOne({ userId: oid });

    if (!cart) {
      const newCart = await CartModel.create({
        userId: oid,
        items: [cartItem],
        subtotal: product.price * quantity,
        total: product.price * quantity,
      });

      return sendSuccess(res, 201, "Cart created successfully", newCart);
    }

    cart.items.push(cartItem);
    cart.subtotal += product.price * quantity;
    cart.total += product.price * quantity;

    await cart.save();
    return sendSuccess(res, 200, "Item added to cart successfully", cart);
  } catch (err: unknown) {
    if (err instanceof Error) {
      return sendError(res, 500, err.message);
    }
    return sendError(res, 500, "Unknown Error");
  }
}

export async function updateItemHandler(
  req: express.Request,
  res: express.Response,
) {
  const body = req.body;
  if (!body.userId || !body.productId || !body.quantity) {
    return sendError(res, 400, "Incomplete data provided");
  }

  const oid = parseObjectId(body.userId);
  if (!oid) {
    return sendError(res, 400, "Invalid User ID");
  }
  try {
    const cart = await CartModel.findOne({
      userId: oid,
    });
    if (!cart)
      return sendError(res, 404, "Cart not found for user");
    const prod = await ProductModel.findOne({ slug: body.productId });
    if (!prod) {
      return sendError(res, 404, "Product not found");
    }

    const qty = Number(body.quantity);
    if (!Number.isFinite(qty) || qty < 1) {
      return sendError(res, 400, "Invalid quantity");
    }

    const targetItem = cart.items.find((item) =>
      item.productId.equals(prod._id),
    );
    if (!targetItem) {
      return sendError(res, 404, "Item not found in cart");
    }

    targetItem.quantity = qty;
    cart.subtotal = cart.items.reduce(
      (sum, item) => sum + item.quantity * item.priceAtPurchase,
      0,
    );
    cart.total = cart.subtotal;

    await cart.save();
    return sendSuccess(res, 200, "Cart item updated successfully", cart);
  } catch (err: unknown) {
    if (err instanceof Error) {
      return sendError(res, 400, err.message);
    }
    return sendError(res, 500, "Unknown Error");
  }
}

export async function clearCartHandler(
  req: express.Request,
  res: express.Response,
) {
  const userId = req.body.userId;

  if (!userId) {
    return sendError(res, 400, "No User ID given");
  }

  const oid = parseObjectId(userId);
  if (!oid) {
    return sendError(res, 400, "Invalid User ID");
  }

  try {
    const result = await CartModel.deleteOne({ userId: oid });
    return sendSuccess(res, 200, "Cart cleared successfully", {
      deletedCount: result.deletedCount,
    });
  } catch (err: unknown) {
    if (err instanceof Error) {
      return sendError(res, 500, err.message);
    }
    return sendError(res, 500, "Unknown Deletion Error");
  }
}

export async function removeItemHandler(
  req: express.Request,
  res: express.Response,
) {
  try {
    const productId = req.params.productId;
    const userId = req.body.userId;

    if (!userId) {
      return sendError(res, 400, "No User ID given");
    }
    if (!productId) {
      return sendError(res, 400, "No Product ID given");
    }

    const oid = parseObjectId(userId);
    if (!oid) {
      return sendError(res, 400, "Invalid User ID");
    }

    const cart = await CartModel.findOne({ userId: oid });
    if (!cart) return sendError(res, 404, "Cart not found for user");

    const prod = await ProductModel.findOne({ slug: productId });
    if (!prod) return sendError(res, 404, "Product not available");

    const newItems = cart.items.filter((item) => !item.productId.equals(prod._id));

    cart.items = newItems;
    cart.subtotal = cart.items.reduce(
      (sum, item) => sum + item.quantity * item.priceAtPurchase,
      0,
    );
    cart.total = cart.subtotal;
    await cart.save();
    return sendSuccess(res, 200, "Cart item removed successfully", cart);

  } catch (err: unknown) {
    if (err instanceof Error) {
      return sendError(res, 500, err.message);
    }
    return sendError(res, 500, "Unknown Deletion Error");
  }
}
