import { Property } from "@models/properties.model";

type CategoryLike = {
  id?: number;
  name?: string;
};

export interface PropertySummaryDto {
  id: number;
  title: string;
  categoryId: number;
  category: {
    id?: number;
    name: string;
  } | null;
  location: string;
  latitude?: number;
  longitude?: number;
  price: number;
  roi: number;
  status: string;
  area: number;
  areaNepali?: string;
  distanceFromHighway?: number;
  images: string[];
  primaryImage?: string;
  description: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PropertyDetailDto extends PropertySummaryDto {
  latitude?: number;
  longitude?: number;
}

const serializeCategory = (category?: CategoryLike | null) => {
  if (!category?.name) {
    return null;
  }

  return {
    id: category.id,
    name: category.name,
  };
};

export const serializePropertySummary = (
  property: Property,
): PropertySummaryDto => ({
  id: Number(property.id),
  title: property.title,
  categoryId: property.categoryId,
  category: serializeCategory(property.category),
  location: property.location,
  latitude: property.latitude,
  longitude: property.longitude,
  price: property.price,
  roi: property.roi,
  status: property.status,
  area: property.area,
  areaNepali: property.areaNepali,
  distanceFromHighway: property.distanceFromHighway,
  images: property.images ?? [],
  primaryImage: property.images?.[0],
  description: property.description,
  createdAt: property.createdAt,
  updatedAt: property.updatedAt,
});

export const serializePropertyDetail = (
  property: Property,
): PropertyDetailDto => ({
  ...serializePropertySummary(property),
  latitude: property.latitude,
  longitude: property.longitude,
});
