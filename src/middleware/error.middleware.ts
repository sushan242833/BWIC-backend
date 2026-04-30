import { NextFunction, Request, Response } from "express";
import multer from "multer";
import {
  DatabaseError,
  ForeignKeyConstraintError,
  UniqueConstraintError,
  ValidationError as SequelizeValidationError,
} from "sequelize";

export interface ApiErrorDetail {
  path: string;
  message: string;
}

const DEFAULT_SERVER_ERROR_MESSAGE =
  "Something went wrong. Please try again later.";

export class AppError extends Error {
  statusCode: number;
  details: ApiErrorDetail[];

  constructor(
    message: string,
    statusCode = 500,
    details: ApiErrorDetail[] = [],
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

const buildValidationFailure = (
  details: ApiErrorDetail[],
  statusCode = 400,
): AppError => new AppError("Validation failed", statusCode, details);

const normalizeSequelizeValidationError = (
  error: SequelizeValidationError | UniqueConstraintError,
): AppError => {
  const details = error.errors.map((issue) => ({
    path: issue.path || "field",
    message: issue.message,
  }));

  if (error instanceof UniqueConstraintError) {
    return buildValidationFailure(details, 409);
  }

  return buildValidationFailure(details);
};

const normalizeUploadError = (error: unknown): AppError | null => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return buildValidationFailure([
        {
          path: "images",
          message: "Each uploaded image must be within the allowed size limit.",
        },
      ]);
    }

    if (error.code === "LIMIT_FILE_COUNT") {
      return buildValidationFailure([
        {
          path: "images",
          message: "Too many images were uploaded.",
        },
      ]);
    }

    return buildValidationFailure([
      {
        path: "images",
        message: "The uploaded files could not be processed.",
      },
    ]);
  }

  if (
    error instanceof Error &&
    error.message.toLowerCase().includes("file format not supported")
  ) {
    return buildValidationFailure([
      {
        path: "images",
        message: "Only JPG and PNG images are supported.",
      },
    ]);
  }

  return null;
};

const normalizeError = (error: unknown): AppError => {
  if (error instanceof AppError) {
    return error;
  }

  const uploadError = normalizeUploadError(error);
  if (uploadError) {
    return uploadError;
  }

  if (error instanceof SequelizeValidationError) {
    return normalizeSequelizeValidationError(error);
  }

  if (error instanceof UniqueConstraintError) {
    return normalizeSequelizeValidationError(error);
  }

  if (error instanceof ForeignKeyConstraintError) {
    return buildValidationFailure([
      {
        path: "reference",
        message: "A related record could not be found.",
      },
    ]);
  }

  if (error instanceof SyntaxError && "body" in error) {
    return buildValidationFailure([
      {
        path: "body",
        message: "Invalid JSON payload.",
      },
    ]);
  }

  if (
    error instanceof Error &&
    error.message.toLowerCase().includes("cors origin not allowed")
  ) {
    return new AppError("Origin not allowed", 403);
  }

  if (error instanceof DatabaseError) {
    return new AppError(DEFAULT_SERVER_ERROR_MESSAGE, 500);
  }

  return new AppError(DEFAULT_SERVER_ERROR_MESSAGE, 500);
};

export const notFoundHandler = (
  _req: Request,
  _res: Response,
  next: NextFunction,
) => {
  next(new AppError("Route not found", 404));
};

export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const appError = normalizeError(error);

  if (appError.statusCode >= 500) {
    console.error("Unhandled error:", error);
  }

  res.status(appError.statusCode).json({
    success: false,
    message:
      appError.statusCode >= 500
        ? DEFAULT_SERVER_ERROR_MESSAGE
        : appError.message,
    errors: appError.details,
  });
};
