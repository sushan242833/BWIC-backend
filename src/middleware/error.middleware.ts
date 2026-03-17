import { NextFunction, Request, Response } from "express";

export class AppError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(message: string, statusCode = 500, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
};

export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const appError =
    error instanceof AppError
      ? error
      : new AppError(
          error instanceof Error ? error.message : "Internal server error",
          500,
        );

  if (appError.statusCode >= 500) {
    console.error("Unhandled error:", error);
  }

  const response: Record<string, unknown> = {
    success: false,
    message: appError.message,
  };

  if (appError.details !== undefined) {
    response.errors = appError.details;
  }

  res.status(appError.statusCode).json(response);
};
