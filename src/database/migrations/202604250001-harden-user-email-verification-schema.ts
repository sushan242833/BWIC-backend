import { Migration } from "./types";

const TABLE_NAME = "users";
const LEGACY_ATTEMPTS_COLUMN = "otpAttempts";
const ATTEMPTS_COLUMN = "emailVerificationOtpAttempts";

const hasColumn = (
  table: Record<string, unknown>,
  columnName: string,
): boolean => Object.prototype.hasOwnProperty.call(table, columnName);

const migration: Migration = {
  async up({ queryInterface, dataTypes, sequelize }) {
    const table = await queryInterface.describeTable(TABLE_NAME);

    if (!hasColumn(table, "isEmailVerified")) {
      await queryInterface.addColumn(TABLE_NAME, "isEmailVerified", {
        type: dataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });

      await sequelize.query(
        `UPDATE "${TABLE_NAME}" SET "isEmailVerified" = TRUE WHERE "isEmailVerified" IS NULL OR "isEmailVerified" = FALSE`,
      );
    } else {
      await queryInterface.changeColumn(TABLE_NAME, "isEmailVerified", {
        type: dataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    if (!hasColumn(table, "emailVerificationOtp")) {
      await queryInterface.addColumn(TABLE_NAME, "emailVerificationOtp", {
        type: dataTypes.STRING(64),
        allowNull: true,
      });
    } else {
      await queryInterface.changeColumn(TABLE_NAME, "emailVerificationOtp", {
        type: dataTypes.STRING(64),
        allowNull: true,
      });
    }

    if (!hasColumn(table, "emailVerificationOtpExpiresAt")) {
      await queryInterface.addColumn(TABLE_NAME, "emailVerificationOtpExpiresAt", {
        type: dataTypes.DATE,
        allowNull: true,
      });
    } else {
      await queryInterface.changeColumn(TABLE_NAME, "emailVerificationOtpExpiresAt", {
        type: dataTypes.DATE,
        allowNull: true,
      });
    }

    const hasLegacyAttempts = hasColumn(table, LEGACY_ATTEMPTS_COLUMN);
    const hasAttemptsColumn = hasColumn(table, ATTEMPTS_COLUMN);

    if (hasLegacyAttempts && !hasAttemptsColumn) {
      await queryInterface.renameColumn(
        TABLE_NAME,
        LEGACY_ATTEMPTS_COLUMN,
        ATTEMPTS_COLUMN,
      );
    }

    if (!hasLegacyAttempts && !hasAttemptsColumn) {
      await queryInterface.addColumn(TABLE_NAME, ATTEMPTS_COLUMN, {
        type: dataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
    } else {
      await queryInterface.changeColumn(TABLE_NAME, ATTEMPTS_COLUMN, {
        type: dataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
    }

    await sequelize.query(
      `UPDATE "${TABLE_NAME}" SET "${ATTEMPTS_COLUMN}" = 0 WHERE "${ATTEMPTS_COLUMN}" IS NULL`,
    );
  },

  async down() {
    // This migration reconciles legacy schemas in place and is intentionally non-destructive.
  },
};

export = migration;
