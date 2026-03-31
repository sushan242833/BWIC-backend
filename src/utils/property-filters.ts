import { Op, Order, WhereOptions } from "sequelize";
import {
  normalizePropertyStatus,
  PROPERTY_DEFAULT_PAGE_SIZE,
  PROPERTY_MAX_PAGE_SIZE,
  PropertyStatus,
} from "@constants/property";

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
  status?: PropertyStatus;
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

  if (filters.location) {
    whereClause.location = { [Op.iLike]: `%${filters.location}%` };
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

  return whereClause;
};

const propertyOrderMap: Record<PropertySortValue, Order> = {
  price_asc: [["price", "ASC"]],
  price_desc: [["price", "DESC"]],
  roi_desc: [["roi", "DESC"]],
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
