import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import type { Request, Response } from "express";
import CategoryController from "@controller/category.controller";
import { Category } from "@models/category.model";
import { Property } from "@models/properties.model";
import { AppError } from "../middleware/error.middleware";

const restorers: Array<() => void> = [];

const patchMethod = (
  target: object,
  methodName: string,
  replacement: unknown,
) => {
  const mutableTarget = target as Record<string, unknown>;
  const original = mutableTarget[methodName];
  mutableTarget[methodName] = replacement;
  restorers.push(() => {
    mutableTarget[methodName] = original;
  });
};

afterEach(() => {
  while (restorers.length > 0) {
    restorers.pop()?.();
  }
});

test("delete rejects categories that still have properties", async () => {
  let nextError: unknown;

  patchMethod(Category, "findByPk", async () => ({
    id: 4,
  }));
  patchMethod(Property, "count", async () => 3);

  await CategoryController.delete(
    {
      params: { id: "4" },
    } as unknown as Request,
    {} as Response,
    (error?: unknown) => {
      nextError = error;
    },
  );

  assert.ok(nextError instanceof AppError);
  assert.equal((nextError as AppError).statusCode, 409);
  assert.equal(
    (nextError as AppError).message,
    "This category cannot be deleted while properties are still assigned to it.",
  );
});
