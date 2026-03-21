import { cast, col, Op, Order, WhereOptions, where } from "sequelize";

export const propertySortValues = [
  "price_asc",
  "price_desc",
  "roi_desc",
  "newest",
] as const;

export type PropertySortValue = (typeof propertySortValues)[number];

export interface PropertyFilterQuery {
  location?: string;
  categoryId?: number;
  minPrice?: number;
  maxPrice?: number;
  minRoi?: number;
  minArea?: number;
  maxDistanceFromHighway?: number;
  status?: string;
  sort?: PropertySortValue;
  page?: number;
  limit?: number;
}

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
  const andConditions = [];

  if (filters.location) {
    whereClause.location = { [Op.iLike]: `%${filters.location}%` };
  }

  if (filters.categoryId !== undefined) {
    whereClause.categoryId = filters.categoryId;
  }

  if (filters.minPrice !== undefined) {
    andConditions.push(
      where(cast(col("price"), "DOUBLE PRECISION"), {
        [Op.gte]: filters.minPrice,
      }),
    );
  }

  if (filters.maxPrice !== undefined) {
    andConditions.push(
      where(cast(col("price"), "DOUBLE PRECISION"), {
        [Op.lte]: filters.maxPrice,
      }),
    );
  }

  if (filters.minRoi !== undefined) {
    andConditions.push(
      where(cast(col("roi"), "DOUBLE PRECISION"), {
        [Op.gte]: filters.minRoi,
      }),
    );
  }

  if (filters.minArea !== undefined) {
    andConditions.push(
      where(cast(col("area"), "DOUBLE PRECISION"), {
        [Op.gte]: filters.minArea,
      }),
    );
  }

  if (filters.maxDistanceFromHighway !== undefined) {
    whereClause.distanceFromHighway = {
      ...(whereClause.distanceFromHighway as object),
      [Op.lte]: filters.maxDistanceFromHighway,
    };
  }

  if (filters.status) {
    whereClause.status = { [Op.iLike]: filters.status };
  }

  if (andConditions.length > 0) {
    return {
      ...whereClause,
      [Op.and]: andConditions,
    };
  }

  return whereClause;
};

const propertyOrderMap: Record<PropertySortValue, Order> = {
  price_asc: [[cast(col("price"), "DOUBLE PRECISION"), "ASC"]],
  price_desc: [[cast(col("price"), "DOUBLE PRECISION"), "DESC"]],
  roi_desc: [[cast(col("roi"), "DOUBLE PRECISION"), "DESC"]],
  newest: [["createdAt", "DESC"]],
};

export const resolvePropertyOrder = (
  sort: PropertySortValue = "newest",
): Order => propertyOrderMap[sort] || propertyOrderMap.newest;

export const normalizePropertyPagination = ({
  page,
  limit,
}: Pick<PropertyFilterQuery, "page" | "limit">) => {
  const pageValue = Math.max(1, Math.trunc(page || 1));
  const limitValue = Math.min(50, Math.max(1, Math.trunc(limit || 9)));

  return {
    page: pageValue,
    limit: limitValue,
    offset: (pageValue - 1) * limitValue,
  };
};
