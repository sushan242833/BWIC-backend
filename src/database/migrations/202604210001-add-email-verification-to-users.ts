import { Migration } from "./types";

const TABLE_NAME = "users";

const hasColumn = (
  table: Record<string, unknown>,
  columnName: string,
): boolean => Object.prototype.hasOwnProperty.call(table, columnName);

const migration: Migration = {
  async up({ queryInterface, dataTypes, sequelize }) {
    const table = await queryInterface.describeTable(TABLE_NAME);
    const addedAssignments: string[] = [];

    if (!hasColumn(table, "isEmailVerified")) {
      await queryInterface.addColumn(TABLE_NAME, "isEmailVerified", {
        type: dataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
      addedAssignments.push('"isEmailVerified" = TRUE');
    }

    if (!hasColumn(table, "emailVerificationOtp")) {
      await queryInterface.addColumn(TABLE_NAME, "emailVerificationOtp", {
        type: dataTypes.STRING(64),
        allowNull: true,
      });
    }

    if (!hasColumn(table, "emailVerificationOtpExpiresAt")) {
      await queryInterface.addColumn(
        TABLE_NAME,
        "emailVerificationOtpExpiresAt",
        {
          type: dataTypes.DATE,
          allowNull: true,
        },
      );
    }

    if (!hasColumn(table, "emailVerificationOtpAttempts")) {
      await queryInterface.addColumn(
        TABLE_NAME,
        "emailVerificationOtpAttempts",
        {
          type: dataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
      );
      addedAssignments.push('"emailVerificationOtpAttempts" = 0');
    }

    if (addedAssignments.length > 0) {
      await sequelize.query(
        `UPDATE "${TABLE_NAME}" SET ${addedAssignments.join(", ")}`,
      );
    }
  },

  async down({ queryInterface }) {
    const table = await queryInterface.describeTable(TABLE_NAME);

    if (hasColumn(table, "emailVerificationOtpAttempts")) {
      await queryInterface.removeColumn(
        TABLE_NAME,
        "emailVerificationOtpAttempts",
      );
    }
    if (hasColumn(table, "emailVerificationOtpExpiresAt")) {
      await queryInterface.removeColumn(
        TABLE_NAME,
        "emailVerificationOtpExpiresAt",
      );
    }
    if (hasColumn(table, "emailVerificationOtp")) {
      await queryInterface.removeColumn(TABLE_NAME, "emailVerificationOtp");
    }
    if (hasColumn(table, "isEmailVerified")) {
      await queryInterface.removeColumn(TABLE_NAME, "isEmailVerified");
    }
  },
};

export = migration;
