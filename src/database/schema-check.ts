import sequelize from "@config/config";

const AUTH_USER_REQUIRED_COLUMNS = [
  "isActive",
  "isEmailVerified",
  "emailVerificationOtp",
  "emailVerificationOtpExpiresAt",
  "emailVerificationOtpAttempts",
  "tokenVersion",
] as const;

const AUTH_RATE_LIMIT_TABLE = "auth_rate_limits";
const AUTH_RATE_LIMIT_REQUIRED_COLUMNS = [
  "key",
  "count",
  "resetAt",
] as const;

const formatColumnList = (columns: readonly string[]): string =>
  columns.map((column) => `"${column}"`).join(", ");

const describeTableOrNull = async (tableName: string) => {
  try {
    return await sequelize.getQueryInterface().describeTable(tableName);
  } catch {
    return null;
  }
};

export const assertAuthUserSchema = async (): Promise<void> => {
  const queryInterface = sequelize.getQueryInterface();
  const table = await queryInterface.describeTable("users");
  const missingColumns = AUTH_USER_REQUIRED_COLUMNS.filter(
    (columnName) =>
      !Object.prototype.hasOwnProperty.call(table, columnName),
  );

  if (missingColumns.length === 0) {
    const rateLimitTable = await describeTableOrNull(AUTH_RATE_LIMIT_TABLE);

    if (!rateLimitTable) {
      throw new Error(
        `Database schema mismatch detected. Missing "${AUTH_RATE_LIMIT_TABLE}" table. Run "npm run db:migrate" before starting the server.`,
      );
    }

    const missingRateLimitColumns = AUTH_RATE_LIMIT_REQUIRED_COLUMNS.filter(
      (columnName) =>
        !Object.prototype.hasOwnProperty.call(rateLimitTable, columnName),
    );

    if (missingRateLimitColumns.length > 0) {
      throw new Error(
        `Database schema mismatch detected in the "${AUTH_RATE_LIMIT_TABLE}" table. Missing columns: ${formatColumnList(
          missingRateLimitColumns,
        )}. Run "npm run db:migrate" before starting the server.`,
      );
    }

    return;
  }

  throw new Error(
    `Database schema mismatch detected in the "users" table. Missing columns: ${formatColumnList(
      missingColumns,
    )}. Run "npm run db:migrate" before starting the server.`,
  );
};
