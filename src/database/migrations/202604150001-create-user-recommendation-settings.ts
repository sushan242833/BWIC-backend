import { Migration } from "./types";

const TABLE_NAME = "user_recommendation_settings";

const migration: Migration = {
  async up({ queryInterface, dataTypes }) {
    await queryInterface.createTable(TABLE_NAME, {
      userId: {
        type: dataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      locationWeight: {
        type: dataTypes.DOUBLE,
        allowNull: false,
      },
      priceWeight: {
        type: dataTypes.DOUBLE,
        allowNull: false,
      },
      areaWeight: {
        type: dataTypes.DOUBLE,
        allowNull: false,
      },
      roiWeight: {
        type: dataTypes.DOUBLE,
        allowNull: false,
      },
      highwayAccessWeight: {
        type: dataTypes.DOUBLE,
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
