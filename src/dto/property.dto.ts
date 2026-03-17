import type { PropertyFilterQuery } from "@utils/property-filters";

export interface CreatePropertyDto {
  title: string;
  categoryId: number | string;
  location: string;
  price: string;
  roi: string;
  status: string;
  area: string;
  areaNepali?: string;
  distanceFromHighway?: number | string;
  images?: string[];
  description: string;
}

export interface UpdatePropertyDto extends CreatePropertyDto {}
export type PropertyListQueryDto = PropertyFilterQuery;

export interface UpdatePropertyRequestDto extends UpdatePropertyDto {
  existingImages?: string[];
}
