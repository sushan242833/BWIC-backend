import { Migration } from "./types";

const TABLE_NAME = "contact_messages";

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
      },
      email: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      phone: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      investmentRange: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      propertyType: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      message: {
        type: dataTypes.TEXT,
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
