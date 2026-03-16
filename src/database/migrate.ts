import fs from "fs";
import path from "path";
import { DataTypes, QueryTypes } from "sequelize";
import sequelize from "@config/config";
import { Migration } from "./migrations/types";

const MIGRATIONS_TABLE = "SequelizeMeta";

const ensureMigrationsTable = async (): Promise<void> => {
  await sequelize.getQueryInterface().createTable(MIGRATIONS_TABLE, {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,
    },
  });
};

const getAppliedMigrations = async (): Promise<Set<string>> => {
  try {
    const rows = await sequelize.query<{ name: string }>(
      `SELECT name FROM "${MIGRATIONS_TABLE}"`,
      { type: QueryTypes.SELECT },
    );

    return new Set(rows.map((row) => row.name));
  } catch (_error: unknown) {
    await ensureMigrationsTable();
    return new Set();
  }
};

const getMigrationFiles = (): string[] => {
  const migrationsDir = path.resolve(__dirname, "migrations");

  return fs
    .readdirSync(migrationsDir)
    .filter((fileName) => /^\d+.*\.(ts|js)$/.test(fileName))
    .sort();
};

const loadMigration = (fileName: string): Migration => {
  const migrationPath = path.resolve(__dirname, "migrations", fileName);
  const loadedModule = require(migrationPath) as
    | Migration
    | { default?: Migration };

  if ("up" in loadedModule && "down" in loadedModule) {
    return loadedModule;
  }

  if (loadedModule.default) {
    return loadedModule.default;
  }

  throw new Error(`Invalid migration module: ${fileName}`);
};

const run = async (): Promise<void> => {
  await sequelize.authenticate();

  const queryInterface = sequelize.getQueryInterface();
  const appliedMigrations = await getAppliedMigrations();
  const migrationFiles = getMigrationFiles();

  for (const fileName of migrationFiles) {
    if (appliedMigrations.has(fileName)) {
      continue;
    }

    const migration = loadMigration(fileName);
    console.log(`Running migration: ${fileName}`);
    await migration.up({
      queryInterface,
      sequelize,
      dataTypes: DataTypes,
    });
    await queryInterface.bulkInsert(MIGRATIONS_TABLE, [{ name: fileName }]);
  }

  console.log("Database migrations are up to date.");
};

run()
  .catch((error: unknown) => {
    console.error("Migration failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
