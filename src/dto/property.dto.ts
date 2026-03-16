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

export interface PropertyListQueryDto {
  location?: string | string[];
  categoryId?: string | string[];
  minPrice?: string | string[];
  maxPrice?: string | string[];
  minRoi?: string | string[];
  minArea?: string | string[];
  maxDistanceFromHighway?: string | string[];
  status?: string | string[];
  sort?: string | string[];
  page?: string | string[];
  limit?: string | string[];
}
