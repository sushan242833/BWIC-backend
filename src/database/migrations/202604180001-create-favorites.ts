import { Migration } from "./types";

const TABLE_NAME = "favorites";
const UNIQUE_CONSTRAINT_NAME = "favorites_user_id_property_id_unique";

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
      propertyId: {
        type: dataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "properties",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
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

    await queryInterface.addConstraint(TABLE_NAME, {
      fields: ["userId", "propertyId"],
      type: "unique",
      name: UNIQUE_CONSTRAINT_NAME,
    });
  },

  async down({ queryInterface }) {
    await queryInterface.dropTable(TABLE_NAME);
  },
};

export = migration;
