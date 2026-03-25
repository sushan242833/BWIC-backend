import { Migration } from "./types";

const migration: Migration = {
  async up({ queryInterface }) {
    const propertiesTable = await queryInterface.describeTable("properties");

    if (propertiesTable.priceNpr) {
      await queryInterface.removeColumn("properties", "priceNpr");
    }

    if (propertiesTable.roiPercent) {
      await queryInterface.removeColumn("properties", "roiPercent");
    }

    if (propertiesTable.areaSqft) {
      await queryInterface.removeColumn("properties", "areaSqft");
    }
  },

  async down({ queryInterface, dataTypes }) {
    const propertiesTable = await queryInterface.describeTable("properties");

    if (!propertiesTable.priceNpr) {
      await queryInterface.addColumn("properties", "priceNpr", {
        type: dataTypes.INTEGER,
        allowNull: true,
      });
    }

    if (!propertiesTable.roiPercent) {
      await queryInterface.addColumn("properties", "roiPercent", {
        type: dataTypes.FLOAT,
        allowNull: true,
      });
    }

    if (!propertiesTable.areaSqft) {
      await queryInterface.addColumn("properties", "areaSqft", {
        type: dataTypes.FLOAT,
        allowNull: true,
      });
    }
  },
};

export = migration;
