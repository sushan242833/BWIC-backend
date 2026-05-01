import { NextFunction, Request, Response } from "express";
import env from "@config/env";
import { AppError } from "./error.middleware";

const normalizeOrigin = (value: string | undefined): string | null => {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

const resolveRequestOrigin = (req: Request): string | null =>
  normalizeOrigin(req.get("origin") ?? undefined) ||
  normalizeOrigin(req.get("referer") ?? undefined);

export const requireTrustedOrigin = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  if (env.isTest) {
    return next();
  }

  const requestOrigin = resolveRequestOrigin(req);

  if (
    !requestOrigin ||
    !env.cors.allowedOrigins.includes(requestOrigin)
  ) {
    return next(new AppError("CSRF validation failed", 403));
  }

  next();
};
