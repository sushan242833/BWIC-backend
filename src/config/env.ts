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
};

export default env;
