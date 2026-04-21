import { Migration } from "./types";

const TABLE_NAME = "users";

const hasColumn = (
  table: Record<string, unknown>,
  columnName: string,
): boolean => Object.prototype.hasOwnProperty.call(table, columnName);

const migration: Migration = {
  async up({ queryInterface, dataTypes, sequelize }) {
    const table = await queryInterface.describeTable(TABLE_NAME);
    let hasEmailVerified = hasColumn(table, "isEmailVerified");
    let hasEmailVerificationOtp = hasColumn(table, "emailVerificationOtp");
    let hasEmailVerificationOtpExpiresAt = hasColumn(
      table,
      "emailVerificationOtpExpiresAt",
    );
    const hasLegacyOtpAttempts = hasColumn(table, "otpAttempts");
    let hasEmailVerificationOtpAttempts = hasColumn(
      table,
      "emailVerificationOtpAttempts",
    );

    if (!hasEmailVerified) {
      await queryInterface.addColumn(TABLE_NAME, "isEmailVerified", {
        type: dataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });

      await sequelize.query(
        `UPDATE "${TABLE_NAME}" SET "isEmailVerified" = TRUE`,
      );

      hasEmailVerified = true;
    }

    if (!hasEmailVerificationOtp) {
      await queryInterface.addColumn(TABLE_NAME, "emailVerificationOtp", {
        type: dataTypes.STRING(64),
        allowNull: true,
      });

      hasEmailVerificationOtp = true;
    }

    if (!hasEmailVerificationOtpExpiresAt) {
      await queryInterface.addColumn(TABLE_NAME, "emailVerificationOtpExpiresAt", {
        type: dataTypes.DATE,
        allowNull: true,
      });

      hasEmailVerificationOtpExpiresAt = true;
    }

    if (hasLegacyOtpAttempts && !hasEmailVerificationOtpAttempts) {
      await queryInterface.renameColumn(
        TABLE_NAME,
        "otpAttempts",
        "emailVerificationOtpAttempts",
      );

      hasEmailVerificationOtpAttempts = true;
    }

    if (!hasEmailVerificationOtpAttempts) {
      await queryInterface.addColumn(TABLE_NAME, "emailVerificationOtpAttempts", {
        type: dataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
    }
  },

  async down({ queryInterface }) {
    const table = await queryInterface.describeTable(TABLE_NAME);

    if (hasColumn(table, "otpAttempts")) {
      await queryInterface.removeColumn(TABLE_NAME, "otpAttempts");
    }
  },
};

export = migration;
