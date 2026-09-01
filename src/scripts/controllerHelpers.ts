import express from "express";
import mongoose from "mongoose";

export function sendSuccess<T>(
  res: express.Response,
  statusCode: number,
  message: string,
  data?: T,
) {
  return res.status(statusCode).json({
    success: true,
    message,
    data: data ?? null,
  });
}

export function sendError(
  res: express.Response,
  statusCode: number,
  message: string,
) {
  return res.status(statusCode).json({ success: false, message, data: null });
}

export function parseObjectId(value: unknown) {
  if (typeof value !== "string" || !mongoose.Types.ObjectId.isValid(value)) {
    return null;
  }

  return new mongoose.Types.ObjectId(value);
}
