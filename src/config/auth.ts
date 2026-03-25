import env from "@config/env";

const daysToMilliseconds = (days: number) => days * 24 * 60 * 60 * 1000;

export const authConfig = {
  tokenTtl: env.auth.tokenTtl || "7d",
  cookieName: "bwic_auth",
  cookieMaxAgeMs: daysToMilliseconds(7),
  rememberCookieMaxAgeMs: daysToMilliseconds(30),
  bcryptSaltRounds: 12,
  passwordReset: {
    expiryMinutes: 20,
    resendCooldownSeconds: 60,
    maxAttemptsPerWindow: 5,
    attemptsWindowMinutes: 15,
  },
} as const;

export default authConfig;
