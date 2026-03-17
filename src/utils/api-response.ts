import { Response } from "express";

type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

type SuccessResponseOptions<T> = {
  statusCode?: number;
  message: string;
  data?: T;
  pagination?: PaginationMeta;
};

export const sendSuccess = <T>(
  res: Response,
  { statusCode = 200, message, data, pagination }: SuccessResponseOptions<T>,
) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data: data ?? null,
    ...(pagination ? { pagination } : {}),
  });
};

export type { PaginationMeta };
