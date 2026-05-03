import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import type { Request, Response } from "express";
import authConfig from "@config/auth";
import sequelize from "@config/config";
import AuthController from "@controller/auth.controller";
import authService from "@services/auth.service";
import { USER_ROLE, User } from "@models/user.model";
import * as emailModule from "@utils/email";
import * as emailVerificationModule from "@utils/email-verification";
import * as passwordModule from "@utils/password";
import * as requestRateLimitModule from "@utils/request-rate-limit";
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

const createTransactionStub = () => {
  patchMethod(sequelize, "transaction", async (callback: (transaction: {
    LOCK: { UPDATE: string };
  }) => Promise<unknown>) =>
    callback({
      LOCK: {
        UPDATE: "UPDATE",
      },
    }));
};

afterEach(() => {
  while (restorers.length > 0) {
    restorers.pop()?.();
  }
});

test("register stores a hashed OTP with expiry and sends the email", async () => {
  const expiresAt = new Date("2026-04-21T12:10:00.000Z");
  let createdPayload: unknown;
  let sentEmail: unknown;

  createTransactionStub();
  patchMethod(User, "findOne", async () => null);
  patchMethod(passwordModule, "hashPassword", async () => "hashed-password");
  patchMethod(emailVerificationModule, "createEmailVerificationOtp", () => ({
    otp: "482913",
    otpHash: "hashed-otp",
    expiresAt,
  }));
  patchMethod(User, "create", async (payload: unknown) => {
    createdPayload = payload;

    return {
      fullName: "Alice Johnson",
      email: "alice@example.com",
    } as User;
  });
  patchMethod(emailModule, "sendEmail", async (payload: unknown) => {
    sentEmail = payload;
  });

  const response = await authService.register({
    fullName: " Alice Johnson ",
    email: " ALICE@example.com ",
    password: "StrongPassword123!",
    rememberMe: true,
  });

  assert.equal(response.email, "alice@example.com");
  assert.deepEqual(createdPayload, {
    fullName: "Alice Johnson",
    email: "alice@example.com",
    passwordHash: "hashed-password",
    role: USER_ROLE.USER,
    isActive: true,
    isEmailVerified: false,
    emailVerificationOtp: "hashed-otp",
    emailVerificationOtpExpiresAt: expiresAt,
    otpAttempts: 0,
  });
  assert.equal((sentEmail as { to: string }).to, "alice@example.com");
  assert.equal(
    (sentEmail as { subject: string }).subject,
    "Verify your account",
  );
  assert.match((sentEmail as { text: string }).text, /482913/);
  assert.match((sentEmail as { html: string }).html, /482913/);
});

test("register rejects an existing email address", async () => {
  patchMethod(User, "findOne", async () => ({
    id: 4,
    isEmailVerified: true,
  }));

  await assert.rejects(
    authService.register({
      fullName: "Alice Johnson",
      email: "alice@example.com",
      password: "StrongPassword123!",
    }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 409);
      assert.equal(
        error.message,
        "Unable to create an account with this email. Please sign in or use a different email address.",
      );
      return true;
    },
  );
});

test("verify email marks the user as verified and clears OTP state", async () => {
  let saveCalls = 0;
  const user = {
    email: "verified@example.com",
    isEmailVerified: false,
    emailVerificationOtp: "expected-hash",
    emailVerificationOtpExpiresAt: new Date("2099-01-01T00:00:00.000Z"),
    otpAttempts: 2,
    async save() {
      saveCalls += 1;
      return this;
    },
  } as unknown as User;

  createTransactionStub();
  patchMethod(User, "findOne", async () => user);
  patchMethod(
    emailVerificationModule,
    "hashEmailVerificationOtp",
    () => "expected-hash",
  );

  await authService.verifyEmail({
    email: "verified@example.com",
    otp: "482913",
  });

  assert.equal(user.isEmailVerified, true);
  assert.equal(user.emailVerificationOtp, null);
  assert.equal(user.emailVerificationOtpExpiresAt, null);
  assert.equal(user.otpAttempts, 0);
  assert.equal(saveCalls, 1);
});

test("expired OTP is rejected and cleared", async () => {
  let saveCalls = 0;
  const user = {
    email: "expired@example.com",
    isEmailVerified: false,
    emailVerificationOtp: "expired-hash",
    emailVerificationOtpExpiresAt: new Date("2020-01-01T00:00:00.000Z"),
    otpAttempts: 1,
    async save() {
      saveCalls += 1;
      return this;
    },
  } as unknown as User;

  createTransactionStub();
  patchMethod(User, "findOne", async () => user);

  await assert.rejects(
    authService.verifyEmail({
      email: "expired@example.com",
      otp: "123456",
    }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 400);
      assert.equal(
        error.message,
        "Invalid or expired verification code. Please request a new one and try again.",
      );
      return true;
    },
  );

  assert.equal(user.emailVerificationOtp, null);
  assert.equal(user.emailVerificationOtpExpiresAt, null);
  assert.equal(user.otpAttempts, 0);
  assert.equal(saveCalls, 1);
});

test("invalid OTP is rejected without exposing technical details", async () => {
  let saveCalls = 0;
  const user = {
    email: "invalid-otp@example.com",
    isEmailVerified: false,
    emailVerificationOtp: "expected-hash",
    emailVerificationOtpExpiresAt: new Date("2099-01-01T00:00:00.000Z"),
    otpAttempts: 0,
    async save() {
      saveCalls += 1;
      return this;
    },
  } as unknown as User;

  createTransactionStub();
  patchMethod(User, "findOne", async () => user);
  patchMethod(
    emailVerificationModule,
    "hashEmailVerificationOtp",
    () => "wrong-hash",
  );

  await assert.rejects(
    authService.verifyEmail({
      email: "invalid-otp@example.com",
      otp: "111111",
    }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 400);
      assert.equal(
        error.message,
        "Invalid or expired verification code. Please request a new one and try again.",
      );
      assert.deepEqual(error.details, []);
      return true;
    },
  );

  assert.equal(user.otpAttempts, 1);
  assert.equal(saveCalls, 1);
});

test("resend OTP overwrites the old code and resets attempts", async () => {
  const expiresAt = new Date("2026-04-21T12:15:00.000Z");
  let sentEmail: unknown;
  let saveCalls = 0;
  const user = {
    fullName: "Resend Target",
    email: "resend@example.com",
    isEmailVerified: false,
    emailVerificationOtp: "old-hash",
    emailVerificationOtpExpiresAt: new Date("2026-04-21T12:05:00.000Z"),
    otpAttempts: 4,
    async save() {
      saveCalls += 1;
      return this;
    },
  } as unknown as User;

  createTransactionStub();
  patchMethod(requestRateLimitModule, "assertRateLimit", async () => {});
  patchMethod(User, "findOne", async () => user);
  patchMethod(emailVerificationModule, "createEmailVerificationOtp", () => ({
    otp: "135790",
    otpHash: "new-hash",
    expiresAt,
  }));
  patchMethod(emailModule, "sendEmail", async (payload: unknown) => {
    sentEmail = payload;
  });

  const response = await authService.resendOtp(
    { email: "resend@example.com" },
    "127.0.0.20",
  );

  assert.equal(response.email, "resend@example.com");
  assert.equal(
    response.resendCooldownSeconds,
    authConfig.emailVerification.resendCooldownSeconds,
  );
  assert.equal(user.emailVerificationOtp, "new-hash");
  assert.equal(user.emailVerificationOtpExpiresAt, expiresAt);
  assert.equal(user.otpAttempts, 0);
  assert.equal(saveCalls, 1);
  assert.equal((sentEmail as { to: string }).to, "resend@example.com");
  assert.match((sentEmail as { text: string }).text, /135790/);
});

test("login returns a generic auth failure until the email is verified", async () => {
  let nextError: unknown;

  patchMethod(requestRateLimitModule, "assertRateLimit", async () => {});
  patchMethod(requestRateLimitModule, "clearRateLimit", async () => {});
  patchMethod(User, "findOne", async () => ({
    id: 99,
    email: "blocked@example.com",
    passwordHash: "stored-hash",
    role: USER_ROLE.USER,
    isActive: true,
    isEmailVerified: false,
  }));
  patchMethod(passwordModule, "comparePassword", async () => true);

  await AuthController.login(
    {
      ip: "127.0.0.20",
      body: {
        email: "blocked@example.com",
        password: "StrongPassword123!",
      },
    } as Request,
    {} as Response,
    (error?: unknown) => {
      nextError = error;
    },
  );

  assert.ok(nextError instanceof AppError);
  assert.equal((nextError as AppError).statusCode, 401);
  assert.equal(
    (nextError as AppError).message,
    "Invalid email or password",
  );
});

test("login rejects admins on the user portal", async () => {
  let nextError: unknown;

  patchMethod(requestRateLimitModule, "assertRateLimit", async () => {});
  patchMethod(requestRateLimitModule, "clearRateLimit", async () => {});
  patchMethod(User, "findOne", async () => ({
    id: 7,
    email: "admin@example.com",
    passwordHash: "stored-hash",
    role: USER_ROLE.ADMIN,
    isActive: true,
    isEmailVerified: true,
  }));
  patchMethod(passwordModule, "comparePassword", async () => true);

  await AuthController.login(
    {
      ip: "127.0.0.21",
      body: {
        email: "admin@example.com",
        password: "StrongPassword123!",
        scope: USER_ROLE.USER,
      },
    } as Request,
    {} as Response,
    (error?: unknown) => {
      nextError = error;
    },
  );

  assert.ok(nextError instanceof AppError);
  assert.equal((nextError as AppError).statusCode, 401);
  assert.equal(
    (nextError as AppError).message,
    "Invalid email or password",
  );
});
