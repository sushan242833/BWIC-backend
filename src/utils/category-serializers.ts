import { Category } from "@models/category.model";

export interface CategorySummaryDto {
  id: number;
  name: string;
  propertyCount: number;
}

export interface CategoryDetailDto extends CategorySummaryDto {}

export const serializeCategorySummary = (value: {
  id: number;
  name: string;
  propertyCount?: number | string | null;
}): CategorySummaryDto => ({
  id: Number(value.id),
  name: value.name,
  propertyCount: Number(value.propertyCount ?? 0),
});

export const serializeCategoryDetail = (
  category: Category,
  propertyCount = 0,
): CategoryDetailDto => ({
  id: Number(category.id),
  name: category.name,
  propertyCount,
});
