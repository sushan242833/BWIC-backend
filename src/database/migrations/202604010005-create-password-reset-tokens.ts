import { Migration } from "./types";

const TABLE_NAME = "password_reset_tokens";

const migration: Migration = {
  async up({ queryInterface, dataTypes }) {
    await queryInterface.createTable(TABLE_NAME, {
      id: {
        type: dataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: dataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      tokenHash: {
        type: dataTypes.STRING(128),
        allowNull: false,
        unique: true,
      },
      expiresAt: {
        type: dataTypes.DATE,
        allowNull: false,
      },
      usedAt: {
        type: dataTypes.DATE,
        allowNull: true,
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

  async down({ queryInterface }) {
    await queryInterface.dropTable(TABLE_NAME);
  },
};

export = migration;
