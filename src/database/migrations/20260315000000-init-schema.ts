import { Migration } from "./types";

const migration: Migration = {
  async up({ queryInterface, dataTypes }) {
    await queryInterface.createTable("categories", {
      id: {
        type: dataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: dataTypes.STRING,
        allowNull: false,
        unique: true,
      },
    });

    await queryInterface.createTable("properties", {
      id: {
        type: dataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
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
      },
      updatedAt: {
        type: dataTypes.DATE,
        allowNull: false,
      },
    });

    await queryInterface.createTable("contact_messages", {
      id: {
        type: dataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
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
      },
      updatedAt: {
        type: dataTypes.DATE,
        allowNull: false,
      },
    });
  },

  async down({ queryInterface }) {
    await queryInterface.dropTable("contact_messages");
    await queryInterface.dropTable("properties");
    await queryInterface.dropTable("categories");
  },
};

export = migration;
