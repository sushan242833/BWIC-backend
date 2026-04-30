import sequelize from "@config/config";

const AUTH_USER_REQUIRED_COLUMNS = [
  "isActive",
  "isEmailVerified",
  "emailVerificationOtp",
  "emailVerificationOtpExpiresAt",
  "emailVerificationOtpAttempts",
] as const;

const formatColumnList = (columns: readonly string[]): string =>
  columns.map((column) => `"${column}"`).join(", ");

export const assertAuthUserSchema = async (): Promise<void> => {
  const queryInterface = sequelize.getQueryInterface();
  const table = await queryInterface.describeTable("users");
  const missingColumns = AUTH_USER_REQUIRED_COLUMNS.filter(
    (columnName) =>
      !Object.prototype.hasOwnProperty.call(table, columnName),
  );

  if (missingColumns.length === 0) {
    return;
  }

  throw new Error(
    `Database schema mismatch detected in the "users" table. Missing columns: ${formatColumnList(
      missingColumns,
    )}. Run "npm run db:migrate" before starting the server.`,
  );
};
