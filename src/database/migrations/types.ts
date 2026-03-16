import { DataTypes, QueryInterface, Sequelize } from "sequelize";

export type MigrationContext = {
  queryInterface: QueryInterface;
  sequelize: Sequelize;
  dataTypes: typeof DataTypes;
};

export type Migration = {
  up: (context: MigrationContext) => Promise<void>;
  down: (context: MigrationContext) => Promise<void>;
};
