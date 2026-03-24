import "dotenv/config";

const toNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const toPositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const toSameSite = (
  value: string | undefined,
  fallback: "lax" | "strict" | "none",
): "lax" | "strict" | "none" => {
  const normalized = value?.trim().toLowerCase();
  if (
    normalized === "lax" ||
    normalized === "strict" ||
    normalized === "none"
  ) {
    return normalized;
  }

  return fallback;
};

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: toNumber(process.env.PORT, 4000),
  frontendOrigin:
    process.env.FRONTEND_ORIGIN || process.env.FRONTEND_URL || "*",
  frontendUrl:
    process.env.FRONTEND_URL ||
    process.env.FRONTEND_ORIGIN ||
    "http://localhost:3000",
  appBaseUrl:
    process.env.BACKEND_URL ||
    process.env.APP_BASE_URL ||
    `http://localhost:${toNumber(process.env.PORT, 4000)}`,
  db: {
    dialect: "postgres" as const,
    host: process.env.DB_HOST || "localhost",
    port: toNumber(process.env.DB_PORT, 5432),
    database: process.env.DB_NAME || "blue_whale_investment_db",
    username: process.env.DB_USER || "",
    password: process.env.DB_PASSWORD || "",
    logging: toBoolean(process.env.DB_LOGGING, true),
  },
  uploads: {
    dir: process.env.UPLOAD_DIR || "src/public/uploads",
    maxFileSizeBytes: toNumber(process.env.MAX_FILE_SIZE_MB, 5) * 1024 * 1024,
  },
  mail: {
    host: process.env.SMTP_HOST || "",
    port: toNumber(process.env.SMTP_PORT, 587),
    secure:
      process.env.SMTP_SECURE === undefined
        ? toNumber(process.env.SMTP_PORT, 587) === 465
        : toBoolean(process.env.SMTP_SECURE, false),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.MAIL_FROM || process.env.FROM_EMAIL || "",
    notifyEmail: process.env.NOTIFY_EMAIL || "",
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || "",
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
    cookieName: process.env.AUTH_COOKIE_NAME || "bwic_auth",
    cookieSameSite: toSameSite(process.env.AUTH_COOKIE_SAME_SITE, "lax"),
    cookieSecure:
      process.env.AUTH_COOKIE_SECURE === undefined
        ? process.env.NODE_ENV === "production"
        : toBoolean(process.env.AUTH_COOKIE_SECURE, false),
    cookieDomain: process.env.AUTH_COOKIE_DOMAIN || "",
    cookieMaxAgeMs:
      toPositiveInt(process.env.AUTH_COOKIE_MAX_AGE_DAYS, 7) *
      24 *
      60 *
      60 *
      1000,
    rememberCookieMaxAgeMs:
      toPositiveInt(process.env.AUTH_COOKIE_REMEMBER_ME_DAYS, 30) *
      24 *
      60 *
      60 *
      1000,
    bcryptSaltRounds: toPositiveInt(process.env.BCRYPT_SALT_ROUNDS, 12),
    passwordReset: {
      expiryMinutes: toPositiveInt(process.env.RESET_TOKEN_EXPIRY_MINUTES, 20),
      resendCooldownSeconds: toPositiveInt(
        process.env.PASSWORD_RESET_RESEND_COOLDOWN_SECONDS,
        60,
      ),
      maxAttemptsPerWindow: toPositiveInt(
        process.env.FORGOT_PASSWORD_MAX_ATTEMPTS,
        5,
      ),
      attemptsWindowMinutes: toPositiveInt(
        process.env.FORGOT_PASSWORD_WINDOW_MINUTES,
        15,
      ),
    },
    initialAdmin: {
      fullName: process.env.INITIAL_ADMIN_FULL_NAME || "",
      email: process.env.INITIAL_ADMIN_EMAIL || "",
      password: process.env.INITIAL_ADMIN_PASSWORD || "",
    },
  },
};

if (!env.auth.jwtSecret.trim()) {
  throw new Error("JWT_SECRET is required");
}

export default env;
