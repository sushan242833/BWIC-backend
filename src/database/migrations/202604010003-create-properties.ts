import { Migration } from "./types";

const TABLE_NAME = "properties";

const migration: Migration = {
  async up({ queryInterface, dataTypes }) {
    await queryInterface.createTable(TABLE_NAME, {
      id: {
        type: dataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      title: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      categoryId: {
        type: dataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "categories",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      location: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      latitude: {
        type: dataTypes.DOUBLE,
        allowNull: true,
      },
      longitude: {
        type: dataTypes.DOUBLE,
        allowNull: true,
      },
      price: {
        type: dataTypes.DOUBLE,
        allowNull: false,
      },
      roi: {
        type: dataTypes.DOUBLE,
        allowNull: false,
      },
      status: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      area: {
        type: dataTypes.DOUBLE,
        allowNull: false,
      },
      areaNepali: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      distanceFromHighway: {
        type: dataTypes.INTEGER,
        allowNull: true,
      },
      images: {
        type: dataTypes.JSON,
        allowNull: false,
        defaultValue: [],
      },
      description: {
        type: dataTypes.TEXT,
        allowNull: false,
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
