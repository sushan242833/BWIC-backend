import { Migration } from "./types";
import { USER_ROLES } from "@models/user.model";
import { seedInitialAdminUser } from "@utils/admin-seed";

const migration: Migration = {
  async up({ queryInterface, dataTypes, sequelize }) {
    await queryInterface.createTable("users", {
      id: {
        type: dataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
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
      role: {
        type: dataTypes.ENUM(...USER_ROLES),
        allowNull: false,
        defaultValue: "USER",
      },
      isActive: {
        type: dataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      createdAt: {
        type: dataTypes.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: dataTypes.DATE,
        allowNull: false,
      },
    });

    await seedInitialAdminUser({ queryInterface, sequelize });
  },

  async down({ queryInterface, sequelize }) {
    await queryInterface.dropTable("users");
    await sequelize.query('DROP TYPE IF EXISTS "enum_users_role";');
  },
};

export = migration;
