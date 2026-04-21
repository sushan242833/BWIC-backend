import { Migration } from "./types";

const TABLE_NAME = "users";

const migration: Migration = {
  async up({ queryInterface, dataTypes, sequelize }) {
    await queryInterface.addColumn(TABLE_NAME, "isEmailVerified", {
      type: dataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn(TABLE_NAME, "emailVerificationOtp", {
      type: dataTypes.STRING(64),
      allowNull: true,
    });

    await queryInterface.addColumn(TABLE_NAME, "emailVerificationOtpExpiresAt", {
      type: dataTypes.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn(TABLE_NAME, "emailVerificationOtpAttempts", {
      type: dataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    await sequelize.query(
      `UPDATE "${TABLE_NAME}" SET "isEmailVerified" = TRUE, "emailVerificationOtpAttempts" = 0`,
    );
  },

  async down({ queryInterface }) {
    await queryInterface.removeColumn(TABLE_NAME, "emailVerificationOtpAttempts");
    await queryInterface.removeColumn(TABLE_NAME, "emailVerificationOtpExpiresAt");
    await queryInterface.removeColumn(TABLE_NAME, "emailVerificationOtp");
    await queryInterface.removeColumn(TABLE_NAME, "isEmailVerified");
  },
};

export = migration;
