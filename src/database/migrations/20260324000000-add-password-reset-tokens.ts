import { Migration } from "./types";

const migration: Migration = {
  async up({ queryInterface, dataTypes }) {
    await queryInterface.createTable("password_reset_tokens", {
      id: {
        type: dataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
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
      },
      updatedAt: {
        type: dataTypes.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex("password_reset_tokens", ["userId"], {
      name: "password_reset_tokens_user_id_idx",
    });

    await queryInterface.addIndex(
      "password_reset_tokens",
      ["userId", "usedAt", "expiresAt"],
      {
        name: "password_reset_tokens_user_status_idx",
      },
    );
  },

  async down({ queryInterface }) {
    await queryInterface.dropTable("password_reset_tokens");
  },
};

export = migration;
