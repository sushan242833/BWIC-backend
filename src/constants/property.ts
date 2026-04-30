export const PROPERTY_STATUSES = [
  "Available",
  "Pending",
  "Sold",
  "Rented",
] as const;

export type PropertyStatus = (typeof PROPERTY_STATUSES)[number];

export const PROPERTY_IMAGE_FIELD_NAME = "images";
export const PROPERTY_IMAGE_UPLOAD_LIMIT = 10;
export const PROPERTY_IMAGE_MIME_TYPES = [
  "image/jpg",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export const PROPERTY_DEFAULT_PAGE_SIZE = 9;
export const PROPERTY_MAX_PAGE_SIZE = 50;

export const PROPERTY_AREA_NEPALI_PATTERN = /^\d+-\d+-\d+-\d+(\.\d+)?$/;
export const PROPERTY_AREA_NEPALI_FORMAT_HINT = "0-0-0-0.0";

const propertyStatusLookup = PROPERTY_STATUSES.reduce<
  Record<string, PropertyStatus>
>((lookup, status) => {
  lookup[status.toLowerCase()] = status;
  return lookup;
}, {});

export const normalizePropertyStatus = (
  value: string,
): PropertyStatus | null => {
  const normalized = value.trim().toLowerCase();
  return propertyStatusLookup[normalized] ?? null;
};
