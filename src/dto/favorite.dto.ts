import type { PropertySummaryDto } from "@utils/property-serializers";

export interface FavoriteStatusDto {
  propertyId: number;
  isFavorited: boolean;
}

export interface FavoriteListItemDto {
  id: number;
  property: PropertySummaryDto;
  createdAt: Date;
}

export interface FavoriteListDto {
  items: FavoriteListItemDto[];
}
