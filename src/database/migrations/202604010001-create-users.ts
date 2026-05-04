import { Migration } from "./types";

const TABLE_NAME = "users";
const USER_ROLES = ["ADMIN", "USER"] as const;
const USER_ROLE_DEFAULT = USER_ROLES[1];
const USER_ROLE_ENUM_NAME = "enum_users_role";

const migration: Migration = {
  async up({ queryInterface, dataTypes }) {
    await queryInterface.createTable(TABLE_NAME, {
      id: {
        type: dataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      fullName: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: dataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      passwordHash: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      tokenVersion: {
        type: dataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      role: {
        type: dataTypes.ENUM(...USER_ROLES),
        allowNull: false,
        defaultValue: USER_ROLE_DEFAULT,
      },
      isActive: {
        type: dataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      isEmailVerified: {
        type: dataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      emailVerificationOtp: {
        type: dataTypes.STRING(64),
        allowNull: true,
      },
      emailVerificationOtpExpiresAt: {
        type: dataTypes.DATE,
        allowNull: true,
      },
      emailVerificationOtpAttempts: {
        type: dataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      createdAt: {
        type: dataTypes.DATE,
        allowNull: false,
        defaultValue: dataTypes.NOW,
      },
      updatedAt: {
        type: dataTypes.DATE,
        allowNull: false,
        defaultValue: dataTypes.NOW,
      },
    });
  },

  async down({ queryInterface, sequelize }) {
    await queryInterface.dropTable(TABLE_NAME);
    await sequelize.query(`DROP TYPE IF EXISTS "${USER_ROLE_ENUM_NAME}";`);
  },
};

export = migration;
