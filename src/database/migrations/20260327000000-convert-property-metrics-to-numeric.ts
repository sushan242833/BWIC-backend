import { Migration } from "./types";
import { QueryTypes } from "sequelize";

type InvalidMetricRow = {
  id: number;
  invalidPrice: boolean;
  invalidRoi: boolean;
  invalidArea: boolean;
};

const migration: Migration = {
  async up({ queryInterface, sequelize, dataTypes }) {
    const propertiesTable = await queryInterface.describeTable("properties");

    // Skip conversion if these columns are already numeric.
    const priceAlreadyNumeric =
      propertiesTable.price?.type?.toLowerCase().includes("double") ||
      propertiesTable.price?.type?.toLowerCase().includes("numeric");
    const roiAlreadyNumeric =
      propertiesTable.roi?.type?.toLowerCase().includes("double") ||
      propertiesTable.roi?.type?.toLowerCase().includes("numeric");
    const areaAlreadyNumeric =
      propertiesTable.area?.type?.toLowerCase().includes("double") ||
      propertiesTable.area?.type?.toLowerCase().includes("numeric");

    if (priceAlreadyNumeric && roiAlreadyNumeric && areaAlreadyNumeric) {
      return;
    }

    const invalidRows = await sequelize.query<InvalidMetricRow>(
      `
        SELECT
          id,
          CASE
            WHEN regexp_replace(COALESCE(price::text, ''), ',', '', 'g') ~ '^\\s*-?\\d+(\\.\\d+)?\\s*$' THEN FALSE
            ELSE TRUE
          END AS "invalidPrice",
          CASE
            WHEN regexp_replace(COALESCE(roi::text, ''), ',', '', 'g') ~ '^\\s*-?\\d+(\\.\\d+)?\\s*$' THEN FALSE
            ELSE TRUE
          END AS "invalidRoi",
          CASE
            WHEN regexp_replace(COALESCE(area::text, ''), ',', '', 'g') ~ '^\\s*-?\\d+(\\.\\d+)?\\s*$' THEN FALSE
            ELSE TRUE
          END AS "invalidArea"
        FROM properties
        WHERE
          NOT (regexp_replace(COALESCE(price::text, ''), ',', '', 'g') ~ '^\\s*-?\\d+(\\.\\d+)?\\s*$')
          OR NOT (regexp_replace(COALESCE(roi::text, ''), ',', '', 'g') ~ '^\\s*-?\\d+(\\.\\d+)?\\s*$')
          OR NOT (regexp_replace(COALESCE(area::text, ''), ',', '', 'g') ~ '^\\s*-?\\d+(\\.\\d+)?\\s*$')
      `,
      { type: QueryTypes.SELECT },
    );

    if (invalidRows.length > 0) {
      const firstFew = invalidRows
        .slice(0, 5)
        .map((row) => {
          const invalidFields = [
            row.invalidPrice ? "price" : null,
            row.invalidRoi ? "roi" : null,
            row.invalidArea ? "area" : null,
          ]
            .filter(Boolean)
            .join(", ");
          return `id=${row.id} (${invalidFields})`;
        })
        .join("; ");

      throw new Error(
        `Cannot convert properties.price/roi/area to numeric. Invalid rows: ${firstFew}`,
      );
    }

    await sequelize.query(`
      ALTER TABLE properties
      ALTER COLUMN price TYPE DOUBLE PRECISION
      USING regexp_replace(price::text, ',', '', 'g')::DOUBLE PRECISION,
      ALTER COLUMN roi TYPE DOUBLE PRECISION
      USING regexp_replace(roi::text, ',', '', 'g')::DOUBLE PRECISION,
      ALTER COLUMN area TYPE DOUBLE PRECISION
      USING regexp_replace(area::text, ',', '', 'g')::DOUBLE PRECISION
    `);

    await queryInterface.changeColumn("properties", "price", {
      type: dataTypes.DOUBLE,
      allowNull: false,
    });
    await queryInterface.changeColumn("properties", "roi", {
      type: dataTypes.DOUBLE,
      allowNull: false,
    });
    await queryInterface.changeColumn("properties", "area", {
      type: dataTypes.DOUBLE,
      allowNull: false,
    });
  },

  async down({ queryInterface, sequelize, dataTypes }) {
    await sequelize.query(`
      ALTER TABLE properties
      ALTER COLUMN price TYPE TEXT USING price::text,
      ALTER COLUMN roi TYPE TEXT USING roi::text,
      ALTER COLUMN area TYPE TEXT USING area::text
    `);

    await queryInterface.changeColumn("properties", "price", {
      type: dataTypes.STRING,
      allowNull: false,
    });
    await queryInterface.changeColumn("properties", "roi", {
      type: dataTypes.STRING,
      allowNull: false,
    });
    await queryInterface.changeColumn("properties", "area", {
      type: dataTypes.STRING,
      allowNull: false,
    });
  },
};

export = migration;
