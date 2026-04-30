import { NextFunction, Request, Response } from "express";
import { ZodError, ZodTypeAny } from "zod";
import { ApiErrorDetail, AppError } from "../middleware/error.middleware";

type RequestSchema = {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
};

const buildErrorResponse = (error: ZodError): ApiErrorDetail[] =>
  error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));

const replaceObjectValues = (
  target: Record<string, unknown>,
  source: Record<string, unknown>,
) => {
  Object.keys(target).forEach((key) => {
    delete target[key];
  });

  Object.assign(target, source);
};

export const validateRequest =
  (schema: RequestSchema) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schema.body) {
        req.body = schema.body.parse(req.body);
      }

      if (schema.params) {
        req.params = schema.params.parse(req.params) as Request["params"];
      }

      if (schema.query) {
        const parsedQuery = schema.query.parse(req.query) as Record<
          string,
          unknown
        >;
        replaceObjectValues(
          req.query as unknown as Record<string, unknown>,
          parsedQuery,
        );
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return next(new AppError("Validation failed", 400, buildErrorResponse(error)));
      }

      next(error);
    }
  };
