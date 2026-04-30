import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";
import { errorHandler } from "../middleware/error.middleware";

const createResponseMock = () => {
  let statusCode = 200;
  let body: unknown;

  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: unknown) {
      body = payload;
      return this;
    },
  };

  return {
    response: response as unknown as Response,
    snapshot: () => ({
      statusCode,
      body,
    }),
  };
};

test("raw database mismatch errors are not exposed to clients", () => {
  const { response, snapshot } = createResponseMock();
  const originalConsoleError = console.error;
  console.error = () => undefined;

  try {
    errorHandler(
      new Error('column "isEmailVerified" does not exist'),
      {} as Request,
      response,
      () => undefined,
    );
  } finally {
    console.error = originalConsoleError;
  }

  assert.deepEqual(snapshot(), {
    statusCode: 500,
    body: {
      success: false,
      message: "Something went wrong. Please try again later.",
      errors: [],
    },
  });
});
