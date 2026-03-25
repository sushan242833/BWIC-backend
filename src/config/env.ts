import "dotenv/config";
import { z } from "zod";

const NODE_ENVS = ["development", "test", "production"] as const;
const COOKIE_SAME_SITE_VALUES = ["lax", "strict", "none"] as const;
const BOOLEAN_TRUE_VALUES = ["true", "1", "yes", "on"];
const BOOLEAN_FALSE_VALUES = ["false", "0", "no", "off"];

const trimToUndefined = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const optionalStringSchema = z.preprocess(
  trimToUndefined,
  z.string().optional(),
);

const optionalEmailSchema = (name: string) =>
  z.preprocess(
    trimToUndefined,
    z.string().email(`${name} must be a valid email address`).optional(),
  );

const optionalUrlSchema = (name: string) =>
  z.preprocess(
    trimToUndefined,
    z.string().url(`${name} must be a valid URL`).optional(),
  );

const positiveIntSchema = (name: string, fallback?: number) =>
  z.preprocess(
    (value) => {
      const normalized = trimToUndefined(value);
      return normalized === undefined ? fallback : normalized;
    },
    z.coerce
      .number()
      .int(`${name} must be an integer`)
      .gt(0, `${name} must be greater than 0`),
  );

const booleanSchema = (name: string) =>
  z.preprocess(
    (value) => {
      const normalized = trimToUndefined(value)?.toLowerCase();

      if (normalized === undefined) {
        return undefined;
      }

      if (BOOLEAN_TRUE_VALUES.includes(normalized)) {
        return true;
      }

      if (BOOLEAN_FALSE_VALUES.includes(normalized)) {
        return false;
      }

      return normalized;
    },
    z.boolean(`${name} must be a boolean value`).optional(),
  );

const sameSiteSchema = z.preprocess((value) => {
  const normalized = trimToUndefined(value)?.toLowerCase();
  return normalized === undefined ? undefined : normalized;
}, z.enum(COOKIE_SAME_SITE_VALUES).optional());

const originSchema = z.string().superRefine((value, ctx) => {
  if (value === "*") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "Wildcard origins are not allowed. Use explicit origins when credentials are enabled.",
    });
    return;
  }

  try {
    new URL(value);
  } catch {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Each configured origin must be a valid absolute URL.",
    });
  }
});

const originListSchema = z.preprocess((value) => {
  const normalized = trimToUndefined(value);
  if (!normalized) {
    return undefined;
  }

  return normalized
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}, z.array(originSchema).optional());

const rawEnvSchema = z
  .object({
    NODE_ENV: z.enum(NODE_ENVS).default("development"),
    PORT: positiveIntSchema("PORT", 4000),
    APP_BASE_URL: optionalUrlSchema("APP_BASE_URL"),
    FRONTEND_URL: optionalUrlSchema("FRONTEND_URL"),
    CORS_ALLOWED_ORIGINS: originListSchema,
    FRONTEND_ORIGIN: originListSchema,
    DB_HOST: z.preprocess(trimToUndefined, z.string().default("localhost")),
    DB_PORT: positiveIntSchema("DB_PORT", 5432),
    DB_NAME: z.preprocess(
      trimToUndefined,
      z.string().default("blue_whale_investment_db"),
    ),
    DB_USER: optionalStringSchema,
    DB_PASSWORD: optionalStringSchema,
    DB_LOGGING: booleanSchema("DB_LOGGING"),
    SMTP_HOST: optionalStringSchema,
    SMTP_PORT: positiveIntSchema("SMTP_PORT", 587).optional(),
    SMTP_SECURE: booleanSchema("SMTP_SECURE"),
    SMTP_USER: optionalStringSchema,
    SMTP_PASS: optionalStringSchema,
    MAIL_FROM: optionalStringSchema,
    FROM_EMAIL: optionalStringSchema,
    NOTIFY_EMAIL: optionalEmailSchema("NOTIFY_EMAIL"),
    JWT_SECRET: optionalStringSchema,
    AUTH_TOKEN_TTL: optionalStringSchema,
    JWT_EXPIRES_IN: optionalStringSchema,
    AUTH_COOKIE_DOMAIN: optionalStringSchema,
    AUTH_COOKIE_SECURE: booleanSchema("AUTH_COOKIE_SECURE"),
    AUTH_COOKIE_SAME_SITE: sameSiteSchema,
    INITIAL_ADMIN_FULL_NAME: optionalStringSchema,
    INITIAL_ADMIN_EMAIL: optionalEmailSchema("INITIAL_ADMIN_EMAIL"),
    INITIAL_ADMIN_PASSWORD: optionalStringSchema,
    UPLOAD_DIR: optionalStringSchema,
    GEOCODING_BASE_URL: optionalUrlSchema("GEOCODING_BASE_URL"),
  })
  .superRefine((env, ctx) => {
    if (
      env.AUTH_TOKEN_TTL &&
      env.JWT_EXPIRES_IN &&
      env.AUTH_TOKEN_TTL !== env.JWT_EXPIRES_IN
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["AUTH_TOKEN_TTL"],
        message:
          "AUTH_TOKEN_TTL and JWT_EXPIRES_IN conflict. Use AUTH_TOKEN_TTL only.",
      });
    }

    const hasMailFrom = Boolean(env.MAIL_FROM || env.FROM_EMAIL);
    const hasMailConfig =
      Boolean(env.SMTP_HOST) &&
      Boolean(env.SMTP_USER) &&
      Boolean(env.SMTP_PASS) &&
      hasMailFrom;

    if (env.NOTIFY_EMAIL && !hasMailConfig) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["NOTIFY_EMAIL"],
        message:
          "NOTIFY_EMAIL requires SMTP_HOST, SMTP_USER, SMTP_PASS, and MAIL_FROM to be configured.",
      });
    }

    if (
      env.AUTH_COOKIE_SAME_SITE === "none" &&
      env.AUTH_COOKIE_SECURE !== true &&
      env.NODE_ENV !== "production"
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["AUTH_COOKIE_SAME_SITE"],
        message:
          "AUTH_COOKIE_SAME_SITE=none requires AUTH_COOKIE_SECURE=true outside production.",
      });
    }

    if (env.NODE_ENV !== "production") {
      return;
    }

    if (!env.JWT_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["JWT_SECRET"],
        message: "JWT_SECRET is required in production.",
      });
    }

    if (!env.FRONTEND_URL && !env.FRONTEND_ORIGIN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["FRONTEND_URL"],
        message:
          "FRONTEND_URL is required in production so reset links and default CORS can be configured safely.",
      });
    }

    if (
      !env.CORS_ALLOWED_ORIGINS &&
      !env.FRONTEND_ORIGIN &&
      !env.FRONTEND_URL
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["CORS_ALLOWED_ORIGINS"],
        message:
          "Configure CORS_ALLOWED_ORIGINS or FRONTEND_URL in production. Credentialed CORS cannot fall back to a wildcard origin.",
      });
    }

    if (!env.DB_USER) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["DB_USER"],
        message: "DB_USER is required in production.",
      });
    }

    if (!env.DB_PASSWORD) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["DB_PASSWORD"],
        message: "DB_PASSWORD is required in production.",
      });
    }

    if (!hasMailConfig) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SMTP_HOST"],
        message:
          "SMTP_HOST, SMTP_USER, SMTP_PASS, and MAIL_FROM are required in production.",
      });
    }

    if (env.AUTH_COOKIE_SECURE === false) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["AUTH_COOKIE_SECURE"],
        message: "AUTH_COOKIE_SECURE cannot be false in production.",
      });
    }
  });

const runtimeEnvSchema = z.object({
  nodeEnv: z.enum(NODE_ENVS),
  isDevelopment: z.boolean(),
  isTest: z.boolean(),
  isProduction: z.boolean(),
  port: z.number().int().gt(0),
  appBaseUrl: z.string().url(),
  frontendUrl: z.string().url(),
  cors: z.object({
    allowedOrigins: z.array(z.string()).min(1),
  }),
  db: z.object({
    dialect: z.literal("postgres"),
    host: z.string().min(1),
    port: z.number().int().gt(0),
    database: z.string().min(1),
    username: z.string().min(1),
    password: z.string(),
    logging: z.boolean(),
  }),
  uploads: z.object({
    directory: z.string().min(1),
  }),
  geocoding: z.object({
    baseUrl: z.string().url(),
  }),
  mail: z.object({
    host: z.string().optional(),
    port: z.number().int().gt(0),
    secure: z.boolean(),
    user: z.string().optional(),
    pass: z.string().optional(),
    from: z.string().optional(),
    notifyEmail: z.string().email().optional(),
    isConfigured: z.boolean(),
  }),
  auth: z.object({
    jwtSecret: z.string().min(1, "JWT_SECRET is required"),
    tokenTtl: z.string().optional(),
    cookieSameSite: z.enum(COOKIE_SAME_SITE_VALUES),
    cookieSecure: z.boolean(),
    cookieDomain: z.string().optional(),
    initialAdmin: z.object({
      fullName: z.string().optional(),
      email: z.string().email().optional(),
      password: z.string().optional(),
    }),
  }),
});

const formatZodIssues = (error: z.ZodError): string =>
  error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "env";
      return `- ${path}: ${issue.message}`;
    })
    .join("\n");

const parseWithSchema = <T>(schema: z.ZodSchema<T>, input: unknown): T => {
  const result = schema.safeParse(input);

  if (result.success) {
    return result.data;
  }

  throw new Error(
    `Invalid environment configuration:\n${formatZodIssues(result.error)}`,
  );
};

const normalizeOrigin = (value: string): string => new URL(value).origin;

const emitDeprecatedEnvWarnings = () => {
  const deprecatedEnvMap = [
    { legacy: "JWT_EXPIRES_IN", replacement: "AUTH_TOKEN_TTL" },
    { legacy: "FROM_EMAIL", replacement: "MAIL_FROM" },
    { legacy: "FRONTEND_ORIGIN", replacement: "CORS_ALLOWED_ORIGINS" },
  ] as const;

  deprecatedEnvMap.forEach(({ legacy, replacement }) => {
    if (
      trimToUndefined(process.env[legacy]) &&
      process.env.NODE_ENV !== "test"
    ) {
      console.warn(
        `[env] ${legacy} is deprecated. Use ${replacement} instead.`,
      );
    }
  });
};

const rawEnv = parseWithSchema(rawEnvSchema, process.env);

const frontendUrl =
  rawEnv.FRONTEND_URL || rawEnv.FRONTEND_ORIGIN?.[0] || "http://localhost:3000";

const corsAllowedOrigins = (
  rawEnv.CORS_ALLOWED_ORIGINS ||
  rawEnv.FRONTEND_ORIGIN || [frontendUrl]
).map(normalizeOrigin);

const smtpPort = rawEnv.SMTP_PORT ?? 587;
const cookieSecure =
  rawEnv.AUTH_COOKIE_SECURE ?? rawEnv.NODE_ENV === "production";
const mailFrom = rawEnv.MAIL_FROM || rawEnv.FROM_EMAIL;

const runtimeEnv = parseWithSchema(runtimeEnvSchema, {
  nodeEnv: rawEnv.NODE_ENV,
  isDevelopment: rawEnv.NODE_ENV === "development",
  isTest: rawEnv.NODE_ENV === "test",
  isProduction: rawEnv.NODE_ENV === "production",
  port: rawEnv.PORT,
  appBaseUrl: rawEnv.APP_BASE_URL || `http://localhost:${rawEnv.PORT}`,
  frontendUrl,
  cors: {
    allowedOrigins: corsAllowedOrigins,
  },
  db: {
    dialect: "postgres" as const,
    host: rawEnv.DB_HOST,
    port: rawEnv.DB_PORT,
    database: rawEnv.DB_NAME,
    username: rawEnv.DB_USER || "mac",
    password: rawEnv.DB_PASSWORD || "",
    logging: rawEnv.DB_LOGGING ?? rawEnv.NODE_ENV !== "production",
  },
  uploads: {
    directory: rawEnv.UPLOAD_DIR || "storage/uploads",
  },
  geocoding: {
    baseUrl: rawEnv.GEOCODING_BASE_URL || "https://nominatim.openstreetmap.org",
  },
  mail: {
    host: rawEnv.SMTP_HOST,
    port: smtpPort,
    secure: rawEnv.SMTP_SECURE ?? smtpPort === 465,
    user: rawEnv.SMTP_USER,
    pass: rawEnv.SMTP_PASS,
    from: mailFrom,
    notifyEmail: rawEnv.NOTIFY_EMAIL,
    isConfigured: Boolean(
      rawEnv.SMTP_HOST && rawEnv.SMTP_USER && rawEnv.SMTP_PASS && mailFrom,
    ),
  },
  auth: {
    jwtSecret: rawEnv.JWT_SECRET || "",
    tokenTtl: rawEnv.AUTH_TOKEN_TTL || rawEnv.JWT_EXPIRES_IN,
    cookieSameSite: rawEnv.AUTH_COOKIE_SAME_SITE || "lax",
    cookieSecure,
    cookieDomain: rawEnv.AUTH_COOKIE_DOMAIN,
    initialAdmin: {
      fullName: rawEnv.INITIAL_ADMIN_FULL_NAME,
      email: rawEnv.INITIAL_ADMIN_EMAIL,
      password: rawEnv.INITIAL_ADMIN_PASSWORD,
    },
  },
});

emitDeprecatedEnvWarnings();

export const env = runtimeEnv;

export type Env = typeof env;

export default env;
