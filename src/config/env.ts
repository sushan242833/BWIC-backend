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
  if (normalized === "lax" || normalized === "strict" || normalized === "none") {
    return normalized;
  }

  return fallback;
};

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: toNumber(process.env.PORT, 4000),
  frontendOrigin: process.env.FRONTEND_ORIGIN || "*",
  appBaseUrl:
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
