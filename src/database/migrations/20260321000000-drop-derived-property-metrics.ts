import { Migration } from "./types";

const migration: Migration = {
  async up({ queryInterface }) {
    await queryInterface.removeColumn("properties", "priceNpr");
    await queryInterface.removeColumn("properties", "roiPercent");
    await queryInterface.removeColumn("properties", "areaSqft");
  },

  async down({ queryInterface, dataTypes }) {
    await queryInterface.addColumn("properties", "priceNpr", {
      type: dataTypes.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn("properties", "roiPercent", {
      type: dataTypes.FLOAT,
      allowNull: true,
    });
    await queryInterface.addColumn("properties", "areaSqft", {
      type: dataTypes.FLOAT,
      allowNull: true,
    });
  },
};

export = migration;
