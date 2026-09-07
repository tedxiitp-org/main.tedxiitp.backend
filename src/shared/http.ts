import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { Types } from 'mongoose';
import type { ZodType } from 'zod';

export const asyncHandler =
  (handler: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };

export interface ParseFailure {
  ok: false;
  issues: string[];
}

export interface ParseSuccess<T> {
  ok: true;
  data: T;
}

export const parseWith = <T>(schema: ZodType<T>, input: unknown): ParseSuccess<T> | ParseFailure => {
  const result = schema.safeParse(input);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  return {
    ok: false,
    issues: result.error.issues.map((issue) => {
      const path = issue.path.join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    }),
  };
};

export const respondInvalid = (res: Response, issues: string[]): void => {
  res.status(400).json({ error: 'Invalid request', issues });
};

export const toObjectId = (value: string): Types.ObjectId | null =>
  Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : null;

export const paramString = (req: Request, key: string): string | null => {
  const value = req.params[key];
  return typeof value === 'string' ? value : null;
};

export const objectIdParam = (req: Request, key: string): Types.ObjectId | null => {
  const value = paramString(req, key);
  return value ? toObjectId(value) : null;
};
