import { Migration } from "./types";

const TABLE_NAME = "categories";

const migration: Migration = {
  async up({ queryInterface, dataTypes }) {
    await queryInterface.createTable(TABLE_NAME, {
      id: {
        type: dataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: dataTypes.STRING,
        allowNull: false,
        unique: true,
      },
    });
  },

  async down({ queryInterface }) {
    await queryInterface.dropTable(TABLE_NAME);
  },
};

export = migration;
