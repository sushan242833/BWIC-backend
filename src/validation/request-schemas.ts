import { z } from "zod";

const firstString = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

const trimmedString = (label: string) =>
  z
    .preprocess(firstString, z.string({ error: `${label} is required` }))
    .transform((value) => value.trim())
    .pipe(z.string().min(1, `${label} is required`));

const optionalTrimmedString = () =>
  z
    .preprocess(firstString, z.string().optional())
    .transform((value) => value?.trim() || undefined);

const optionalNumber = (label: string, min = 0) =>
  z.preprocess(
    (value) => {
      const candidate = firstString(value);

      if (candidate === undefined || candidate === null || candidate === "") {
        return undefined;
      }

      if (typeof candidate === "number") {
        return candidate;
      }

      if (typeof candidate === "string") {
        const parsed = Number.parseFloat(candidate.replace(/,/g, "").trim());
        return Number.isNaN(parsed) ? candidate : parsed;
      }

      return candidate;
    },
    z
      .number({ error: `${label} must be a number` })
      .min(min, `${label} must be at least ${min}`)
      .optional(),
  );

const positiveIntParam = (label: string) =>
  z
    .preprocess(firstString, z.string({ error: `${label} is required` }))
    .transform((value) => value.trim())
    .pipe(z.string().regex(/^\d+$/, `${label} must be a positive integer`));

const sortValues = ["price_asc", "price_desc", "roi_desc", "newest"] as const;

export const idParamSchema = z.object({
  id: positiveIntParam("id"),
});

export const createCategorySchema = z.object({
  name: trimmedString("name"),
});

export const updateCategorySchema = createCategorySchema;

export const createContactSchema = z.object({
  name: trimmedString("name"),
  email: trimmedString("email").pipe(
    z.string().email("email must be a valid email address"),
  ),
  phone: optionalTrimmedString(),
  investmentRange: trimmedString("investmentRange"),
  propertyType: trimmedString("propertyType"),
  message: optionalTrimmedString(),
});

export const autocompleteQuerySchema = z.object({
  q: optionalTrimmedString(),
});

export const placeDetailsQuerySchema = z.object({
  placeId: trimmedString("placeId"),
});

export const propertyListQuerySchema = z.object({
  location: optionalTrimmedString(),
  categoryId: optionalNumber("categoryId"),
  minPrice: optionalNumber("minPrice"),
  maxPrice: optionalNumber("maxPrice"),
  minRoi: optionalNumber("minRoi"),
  minArea: optionalNumber("minArea"),
  maxDistanceFromHighway: optionalNumber("maxDistanceFromHighway"),
  status: optionalTrimmedString(),
  sort: z.preprocess(firstString, z.enum(sortValues).optional()).optional(),
  page: optionalNumber("page", 1),
  limit: optionalNumber("limit", 1),
});

const propertyBodySchema = z.object({
  title: trimmedString("title"),
  categoryId: z.preprocess(
    (value) => {
      const candidate = firstString(value);

      if (typeof candidate === "string") {
        const parsed = Number.parseInt(candidate.trim(), 10);
        return Number.isNaN(parsed) ? candidate : parsed;
      }

      return candidate;
    },
    z
      .number({ error: "categoryId must be a number" })
      .int("categoryId must be an integer")
      .positive("categoryId must be a positive integer"),
  ),
  location: trimmedString("location"),
  price: trimmedString("price"),
  roi: trimmedString("roi"),
  status: trimmedString("status"),
  area: trimmedString("area"),
  areaNepali: optionalTrimmedString(),
  distanceFromHighway: optionalNumber("distanceFromHighway"),
  description: trimmedString("description"),
});

export const createPropertySchema = propertyBodySchema;

export const updatePropertySchema = propertyBodySchema;

const recommendationMustHaveSchema = z
  .object({
    location: optionalTrimmedString(),
    categoryId: optionalNumber("mustHave.categoryId"),
    minPrice: optionalNumber("mustHave.minPrice"),
    maxPrice: optionalNumber("mustHave.maxPrice"),
    minRoi: optionalNumber("mustHave.minRoi"),
    minArea: optionalNumber("mustHave.minArea"),
    maxDistanceFromHighway: optionalNumber("mustHave.maxDistanceFromHighway"),
    status: optionalTrimmedString(),
  })
  .superRefine((value, ctx) => {
    if (
      value.minPrice !== undefined &&
      value.maxPrice !== undefined &&
      value.minPrice > value.maxPrice
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["minPrice"],
        message: "minPrice cannot be greater than maxPrice",
      });
    }
  });

const recommendationPreferencesSchema = z.object({
  location: optionalTrimmedString(),
  latitude: optionalNumber("preferences.latitude"),
  longitude: optionalNumber("preferences.longitude"),
  locationRadiusKm: optionalNumber("preferences.locationRadiusKm"),
  budget: optionalNumber("preferences.budget"),
  roiPercent: optionalNumber("preferences.roiPercent"),
  areaSqft: optionalNumber("preferences.areaSqft"),
  maxDistanceFromHighway: optionalNumber("preferences.maxDistanceFromHighway"),
});

export const recommendationQuerySchema = z
  .object({
    location: optionalTrimmedString(),
    categoryId: optionalNumber("categoryId"),
    minPrice: optionalNumber("minPrice"),
    maxPrice: optionalNumber("maxPrice"),
    minRoi: optionalNumber("minRoi"),
    minArea: optionalNumber("minArea"),
    maxDistanceFromHighway: optionalNumber("maxDistanceFromHighway"),
    status: optionalTrimmedString(),
    preferredLocation: optionalTrimmedString(),
    preferredLatitude: optionalNumber("preferredLatitude"),
    preferredLongitude: optionalNumber("preferredLongitude"),
    locationRadiusKm: optionalNumber("locationRadiusKm"),
    budget: optionalNumber("budget"),
    preferredRoi: optionalNumber("preferredRoi"),
    preferredArea: optionalNumber("preferredArea"),
    preferredMaxDistance: optionalNumber("preferredMaxDistance"),
    page: optionalNumber("page", 1),
    limit: optionalNumber("limit", 1),
  })
  .superRefine((value, ctx) => {
    if (
      value.minPrice !== undefined &&
      value.maxPrice !== undefined &&
      value.minPrice > value.maxPrice
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["minPrice"],
        message: "minPrice cannot be greater than maxPrice",
      });
    }
  });

export const recommendationBodySchema = z.object({
  mustHave: recommendationMustHaveSchema.optional(),
  preferences: recommendationPreferencesSchema.optional(),
  page: optionalNumber("page", 1),
  limit: optionalNumber("limit", 1),
});
