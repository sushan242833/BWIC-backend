import { Migration } from "./types";

const TABLE_NAME = "password_reset_tokens";
const USER_ID_INDEX_NAME = "password_reset_tokens_user_id_idx";
const USER_STATUS_INDEX_NAME = "password_reset_tokens_user_status_idx";

const tableExists = async (
  queryInterface: Parameters<Migration["up"]>[0]["queryInterface"],
): Promise<boolean> => {
  try {
    await queryInterface.describeTable(TABLE_NAME);
    return true;
  } catch {
    return false;
  }
};

const getIndexNames = async (
  queryInterface: Parameters<Migration["up"]>[0]["queryInterface"],
): Promise<Set<string>> => {
  const indexes = (await queryInterface.showIndex(TABLE_NAME)) as Array<{
    name?: string;
  }>;
  return new Set(
    indexes
      .map((index) => index.name)
      .filter((name): name is string => Boolean(name)),
  );
};

const migration: Migration = {
  async up({ queryInterface, dataTypes }) {
    if (!(await tableExists(queryInterface))) {
      await queryInterface.createTable(TABLE_NAME, {
        id: {
          type: dataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
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
        tokenHash: {
          type: dataTypes.STRING(128),
          allowNull: false,
          unique: true,
        },
        expiresAt: {
          type: dataTypes.DATE,
          allowNull: false,
        },
        usedAt: {
          type: dataTypes.DATE,
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
    }

    const indexNames = await getIndexNames(queryInterface);

    if (!indexNames.has(USER_ID_INDEX_NAME)) {
      await queryInterface.addIndex(TABLE_NAME, ["userId"], {
        name: USER_ID_INDEX_NAME,
      });
    }

    if (!indexNames.has(USER_STATUS_INDEX_NAME)) {
      await queryInterface.addIndex(TABLE_NAME, ["userId", "usedAt", "expiresAt"], {
        name: USER_STATUS_INDEX_NAME,
      });
    }
  },

  async down({ queryInterface }) {
    if (await tableExists(queryInterface)) {
      await queryInterface.dropTable(TABLE_NAME);
    }
  },
};

export = migration;
