import { Op, Order, WhereOptions } from "sequelize";

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
  const where: WhereOptions = {};

  if (filters.location) {
    where.location = { [Op.iLike]: `%${filters.location}%` };
  }

  if (filters.categoryId !== undefined) {
    where.categoryId = filters.categoryId;
  }

  if (filters.minPrice !== undefined) {
    where.priceNpr = {
      ...(where.priceNpr as object),
      [Op.gte]: filters.minPrice,
    };
  }

  if (filters.maxPrice !== undefined) {
    where.priceNpr = {
      ...(where.priceNpr as object),
      [Op.lte]: filters.maxPrice,
    };
  }

  if (filters.minRoi !== undefined) {
    where.roiPercent = {
      ...(where.roiPercent as object),
      [Op.gte]: filters.minRoi,
    };
  }

  if (filters.minArea !== undefined) {
    where.areaSqft = {
      ...(where.areaSqft as object),
      [Op.gte]: filters.minArea,
    };
  }

  if (filters.maxDistanceFromHighway !== undefined) {
    where.distanceFromHighway = {
      ...(where.distanceFromHighway as object),
      [Op.lte]: filters.maxDistanceFromHighway,
    };
  }

  if (filters.status) {
    where.status = { [Op.iLike]: filters.status };
  }

  return where;
};

const propertyOrderMap: Record<PropertySortValue, Order> = {
  price_asc: [["priceNpr", "ASC"]],
  price_desc: [["priceNpr", "DESC"]],
  roi_desc: [["roiPercent", "DESC"]],
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
