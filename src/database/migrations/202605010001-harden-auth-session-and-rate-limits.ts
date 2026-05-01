import { Migration } from "./types";

const USERS_TABLE = "users";
const AUTH_RATE_LIMITS_TABLE = "auth_rate_limits";

const hasColumn = (
  table: Record<string, unknown>,
  columnName: string,
): boolean => Object.prototype.hasOwnProperty.call(table, columnName);

const migration: Migration = {
  async up({ queryInterface, dataTypes }) {
    const usersTable = await queryInterface.describeTable(USERS_TABLE);

    if (!hasColumn(usersTable, "tokenVersion")) {
      await queryInterface.addColumn(USERS_TABLE, "tokenVersion", {
        type: dataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
    } else {
      await queryInterface.changeColumn(USERS_TABLE, "tokenVersion", {
        type: dataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
    }

    try {
      await queryInterface.describeTable(AUTH_RATE_LIMITS_TABLE);
    } catch {
      await queryInterface.createTable(AUTH_RATE_LIMITS_TABLE, {
        key: {
          type: dataTypes.STRING(191),
          allowNull: false,
          primaryKey: true,
        },
        count: {
          type: dataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        resetAt: {
          type: dataTypes.DATE,
          allowNull: false,
        },
      });
      return;
    }

    const rateLimitTable = await queryInterface.describeTable(
      AUTH_RATE_LIMITS_TABLE,
    );

    if (!hasColumn(rateLimitTable, "count")) {
      await queryInterface.addColumn(AUTH_RATE_LIMITS_TABLE, "count", {
        type: dataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
    } else {
      await queryInterface.changeColumn(AUTH_RATE_LIMITS_TABLE, "count", {
        type: dataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
    }

    if (!hasColumn(rateLimitTable, "resetAt")) {
      await queryInterface.addColumn(AUTH_RATE_LIMITS_TABLE, "resetAt", {
        type: dataTypes.DATE,
        allowNull: false,
      });
    } else {
      await queryInterface.changeColumn(AUTH_RATE_LIMITS_TABLE, "resetAt", {
        type: dataTypes.DATE,
        allowNull: false,
      });
    }
  },

  async down({ queryInterface }) {
    const usersTable = await queryInterface.describeTable(USERS_TABLE);
    if (hasColumn(usersTable, "tokenVersion")) {
      await queryInterface.removeColumn(USERS_TABLE, "tokenVersion");
    }

    try {
      await queryInterface.dropTable(AUTH_RATE_LIMITS_TABLE);
    } catch {
      // Table may not exist in partially applied environments.
    }
  },
};

export = migration;
