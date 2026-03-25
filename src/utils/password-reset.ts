import crypto from "crypto";
import authConfig from "@config/auth";
import env from "@config/env";

const RESET_TOKEN_BYTES = 32;

export const FORGOT_PASSWORD_SUCCESS_MESSAGE =
  "If an account exists, a password reset link has been sent.";

export const INVALID_RESET_TOKEN_MESSAGE =
  "This password reset link is invalid or has expired.";

export const hashResetToken = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex");

export const generatePasswordResetToken = () => {
  const rawToken = crypto.randomBytes(RESET_TOKEN_BYTES).toString("hex");

  return {
    rawToken,
    tokenHash: hashResetToken(rawToken),
    expiresAt: new Date(
      Date.now() + authConfig.passwordReset.expiryMinutes * 60 * 1000,
    ),
  };
};

export const buildPasswordResetLink = (rawToken: string): string => {
  const resetUrl = new URL("/reset-password", env.frontendUrl);
  resetUrl.searchParams.set("token", rawToken);
  return resetUrl.toString();
};
