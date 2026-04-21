import crypto from "node:crypto";
import authConfig from "@config/auth";
import env from "@config/env";

const OTP_RANGE_MAX = 1_000_000;

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const generateOtp = (): string =>
  crypto.randomInt(0, OTP_RANGE_MAX).toString().padStart(6, "0");

export const hashEmailVerificationOtp = (
  email: string,
  otp: string,
): string =>
  crypto
    .createHmac("sha256", env.auth.jwtSecret)
    .update(`${normalizeEmail(email)}:${otp}`)
    .digest("hex");

export const buildEmailVerificationExpiry = (now = new Date()): Date =>
  new Date(
    now.getTime() + authConfig.emailVerification.expiryMinutes * 60 * 1000,
  );

export const createEmailVerificationOtp = (email: string) => {
  const otp = generateOtp();

  return {
    otp,
    otpHash: hashEmailVerificationOtp(email, otp),
    expiresAt: buildEmailVerificationExpiry(),
  };
};
