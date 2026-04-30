import {
  Op,
  Order,
  WhereOptions,
  cast,
  col,
  fn,
  where as sequelizeWhere,
} from "sequelize";
import sequelize from "@config/config";
import {
  normalizePropertyStatus,
  PROPERTY_DEFAULT_PAGE_SIZE,
  PROPERTY_MAX_PAGE_SIZE,
  PropertyStatus,
} from "@constants/property";
import { buildLocationSearchProfile } from "@utils/nlp/location-parser";

export const propertySortValues = [
  "random",
  "price_asc",
  "price_desc",
  "roi_desc",
  "newest",
] as const;

export type PropertySortValue = (typeof propertySortValues)[number];

export const propertySearchModeValues = ["smart", "plain"] as const;

export type PropertySearchMode = (typeof propertySearchModeValues)[number];

export interface PropertyFilterQuery {
  search?: string;
  searchMode?: PropertySearchMode;
  location?: string;
  categoryId?: number;
  minPrice?: number;
  maxPrice?: number;
  minRoi?: number;
  minArea?: number;
  maxDistanceFromHighway?: number;
  status?: PropertyStatus;
  sort?: PropertySortValue;
  page?: number;
  limit?: number;
}

export type RecommendationPropertyFilterQuery = Pick<
  PropertyFilterQuery,
  | "location"
  | "categoryId"
  | "maxPrice"
  | "minRoi"
  | "minArea"
  | "maxDistanceFromHighway"
  | "status"
>;

export const validatePropertyFilterCombinations = (
  value: PropertyFilterQuery,
  addIssue: (path: keyof PropertyFilterQuery, message: string) => void,
) => {
  if (
    value.minPrice !== undefined &&
    value.maxPrice !== undefined &&
    value.minPrice > value.maxPrice
  ) {
    addIssue("minPrice", "minPrice cannot be greater than maxPrice");
  }
};

export const buildPropertyWhere = (
  filters: PropertyFilterQuery,
): WhereOptions => {
  const whereClause: WhereOptions = {};
  const andConditions: WhereOptions[] = [];

  if (filters.location) {
    const locationWhere = buildPropertyLocationWhere(filters.location);
    if (locationWhere) {
      andConditions.push(locationWhere);
    }
  }

  if (filters.categoryId !== undefined) {
    whereClause.categoryId = filters.categoryId;
  }

  if (filters.minPrice !== undefined) {
    whereClause.price = {
      ...(whereClause.price as object),
      [Op.gte]: filters.minPrice,
    };
  }

  if (filters.maxPrice !== undefined) {
    whereClause.price = {
      ...(whereClause.price as object),
      [Op.lte]: filters.maxPrice,
    };
  }

  if (filters.minRoi !== undefined) {
    whereClause.roi = {
      ...(whereClause.roi as object),
      [Op.gte]: filters.minRoi,
    };
  }

  if (filters.minArea !== undefined) {
    whereClause.area = {
      ...(whereClause.area as object),
      [Op.gte]: filters.minArea,
    };
  }

  if (filters.maxDistanceFromHighway !== undefined) {
    whereClause.distanceFromHighway = {
      ...(whereClause.distanceFromHighway as object),
      [Op.lte]: filters.maxDistanceFromHighway,
    };
  }

  if (filters.status) {
    const normalizedStatus = normalizePropertyStatus(filters.status);
    if (normalizedStatus) {
      whereClause.status = normalizedStatus;
    }
  }

  const searchWhere = buildPropertySearchWhere(filters.search);
  if (searchWhere) {
    andConditions.push(searchWhere);
  }

  if (andConditions.length === 0) {
    return whereClause;
  }

  if (Object.keys(whereClause).length === 0 && andConditions.length === 1) {
    return andConditions[0];
  }

  return {
    [Op.and]: [whereClause, ...andConditions],
  };
};

export const buildRecommendationPropertyWhere = (
  filters: RecommendationPropertyFilterQuery,
): WhereOptions => {
  const baseWhere = buildPropertyWhere({
    ...filters,
    maxDistanceFromHighway:
      filters.maxDistanceFromHighway !== undefined
        ? Math.round(filters.maxDistanceFromHighway * 1000)
        : undefined,
    search: undefined,
    location: undefined,
  });
  const locationWhere = buildPropertyLocationWhere(filters.location);

  if (!locationWhere) {
    return baseWhere;
  }

  if (Object.keys(baseWhere).length === 0) {
    return locationWhere;
  }

  return {
    [Op.and]: [baseWhere, locationWhere],
  };
};

const propertyOrderMap: Record<Exclude<PropertySortValue, "random">, Order> = {
  price_asc: [["price", "ASC"]],
  price_desc: [["price", "DESC"]],
  roi_desc: [["roi", "DESC"]],
  newest: [["createdAt", "DESC"]],
};

const resolveRandomOrderFunctionName = () => {
  switch (sequelize.getDialect()) {
    case "mysql":
    case "mariadb":
      return "RAND";
    case "postgres":
    default:
      return "RANDOM";
  }
};

export const resolvePropertyOrder = (
  sort: PropertySortValue = "newest",
): Order => {
  if (sort === "random") {
    return [sequelize.fn(resolveRandomOrderFunctionName())];
  }

  return propertyOrderMap[sort] || propertyOrderMap.newest;
};

export const normalizePropertyPagination = ({
  page,
  limit,
}: Pick<PropertyFilterQuery, "page" | "limit">) => {
  const pageValue = Math.max(1, Math.trunc(page || 1));
  const limitValue = Math.min(
    PROPERTY_MAX_PAGE_SIZE,
    Math.max(1, Math.trunc(limit || PROPERTY_DEFAULT_PAGE_SIZE)),
  );

  return {
    page: pageValue,
    limit: limitValue,
    offset: (pageValue - 1) * limitValue,
  };
};

const RECOMMENDATION_LOCATION_FIELDS = [
  "location",
  "title",
  "description",
] as const;

const buildNormalizedLocationExpression = (fieldName: string) =>
  fn(
    "trim",
    fn(
      "regexp_replace",
      fn("lower", fn("coalesce", col(fieldName), "")),
      "[^a-z0-9]+",
      " ",
      "g",
    ),
  );

const buildPropertyLocationWhere = (
  location?: string,
): WhereOptions | undefined => {
  const profile = buildLocationSearchProfile(location);
  if (!profile) {
    return undefined;
  }

  const conditions: WhereOptions[] = [];

  for (const fieldName of RECOMMENDATION_LOCATION_FIELDS) {
    const normalizedField = buildNormalizedLocationExpression(fieldName);

    for (const variant of profile.normalizedAliases) {
      conditions.push(
        sequelizeWhere(normalizedField, {
          [Op.like]: `%${variant}%`,
        }),
      );
    }

    if (profile.significantTokens.length > 1) {
      conditions.push({
        [Op.and]: profile.significantTokens.map((token) =>
          sequelizeWhere(normalizedField, {
            [Op.like]: `%${token}%`,
          }),
        ),
      });
    }
  }

  return conditions.length > 0
    ? {
        [Op.or]: conditions,
      }
    : undefined;
};

const PROPERTY_TEXT_SEARCH_FIELDS = ["title", "location", "areaNepali"] as const;
const PROPERTY_NUMERIC_SEARCH_FIELDS = ["area"] as const;

const PROPERTY_MAIN_TABLE_ALIAS = "Property";

const normalizeSearchText = (value?: string): string =>
  (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const buildPropertySearchWhere = (
  search?: string,
): WhereOptions | undefined => {
  const normalizedSearch = normalizeSearchText(search);
  if (!normalizedSearch) {
    return undefined;
  }

  const searchTokens = normalizedSearch
    .split(" ")
    .filter((token) => token.length > 0);

  const phraseConditions: WhereOptions[] = PROPERTY_TEXT_SEARCH_FIELDS.map(
    (field) =>
      sequelizeWhere(buildNormalizedLocationExpression(field), {
        [Op.like]: `%${normalizedSearch}%`,
      }),
  );

  if (/^\d+(?:\.\d+)?$/.test(normalizedSearch)) {
    for (const field of PROPERTY_NUMERIC_SEARCH_FIELDS) {
      phraseConditions.push(
        sequelizeWhere(cast(col(`${PROPERTY_MAIN_TABLE_ALIAS}.${field}`), "text"), {
          [Op.like]: `%${normalizedSearch}%`,
        }),
      );
    }
  }

  const tokenConditions = searchTokens
    .filter((token) => token.length > 1)
    .map<WhereOptions>((token) => {
      const conditions: WhereOptions[] = PROPERTY_TEXT_SEARCH_FIELDS.map((field) =>
        sequelizeWhere(buildNormalizedLocationExpression(field), {
          [Op.like]: `%${token}%`,
        }),
      );

      if (/\d/.test(token)) {
        conditions.push(
          sequelizeWhere(cast(col(`${PROPERTY_MAIN_TABLE_ALIAS}.id`), "text"), {
            [Op.like]: `%${token}%`,
          }),
        );

        for (const field of PROPERTY_NUMERIC_SEARCH_FIELDS) {
          conditions.push(
            sequelizeWhere(
              cast(col(`${PROPERTY_MAIN_TABLE_ALIAS}.${field}`), "text"),
              {
                [Op.like]: `%${token}%`,
              },
            ),
          );
        }
      }

      return {
        [Op.or]: conditions,
      };
    });

  const disjunctions: WhereOptions[] = [];

  if (phraseConditions.length > 0) {
    disjunctions.push({
      [Op.or]: phraseConditions,
    });
  }

  if (tokenConditions.length > 1) {
    disjunctions.push({
      [Op.and]: tokenConditions,
    });
  } else if (tokenConditions.length === 1) {
    disjunctions.push(tokenConditions[0]);
  }

  if (/^\d+$/.test(normalizedSearch)) {
    disjunctions.push(
      sequelizeWhere(
        col(`${PROPERTY_MAIN_TABLE_ALIAS}.id`),
        Number.parseInt(normalizedSearch, 10),
      ),
    );
  }

  return disjunctions.length > 0
    ? {
        [Op.or]: disjunctions,
      }
    : undefined;
};
