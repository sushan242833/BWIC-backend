import { z } from "zod";
import {
  propertySortValues,
  validatePropertyFilterCombinations,
} from "@utils/property-filters";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  STRONG_PASSWORD_MESSAGE,
  isStrongPassword,
} from "@utils/password-policy";
import { USER_ROLES } from "@models/user.model";

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

const optionalBoolean = () =>
  z.preprocess((value) => {
    const candidate = firstString(value);

    if (candidate === undefined || candidate === null || candidate === "") {
      return undefined;
    }

    if (typeof candidate === "boolean") {
      return candidate;
    }

    if (typeof candidate === "string") {
      const normalized = candidate.trim().toLowerCase();
      if (["true", "1", "yes", "on"].includes(normalized)) {
        return true;
      }
      if (["false", "0", "no", "off"].includes(normalized)) {
        return false;
      }
    }

    return candidate;
  }, z.boolean().optional());

const optionalStringArray = () =>
  z.preprocess((value) => {
    const candidate = firstString(value);

    if (candidate === undefined || candidate === null || candidate === "") {
      return undefined;
    }

    if (Array.isArray(candidate)) {
      return candidate;
    }

    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      if (!trimmed) {
        return undefined;
      }

      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed : [trimmed];
      } catch {
        return [trimmed];
      }
    }

    return candidate;
  }, z.array(z.string()).optional());

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

const emailString = (label: string) =>
  trimmedString(label)
    .pipe(z.string().email(`${label} must be a valid email address`))
    .transform((value) => value.toLowerCase());

const passwordString = () =>
  trimmedString("password").pipe(
    z
      .string()
      .min(8, "password must be at least 8 characters long")
      .max(72, "password must be 72 characters or fewer"),
  );

const strongPasswordString = (label: string) =>
  trimmedString(label).pipe(
    z
      .string()
      .min(
        PASSWORD_MIN_LENGTH,
        `${label} must be at least ${PASSWORD_MIN_LENGTH} characters long`,
      )
      .max(
        PASSWORD_MAX_LENGTH,
        `${label} must be ${PASSWORD_MAX_LENGTH} characters or fewer`,
      )
      .refine(isStrongPassword, STRONG_PASSWORD_MESSAGE),
  );

export const registerSchema = z.object({
  fullName: trimmedString("fullName").pipe(
    z.string().min(2, "fullName must be at least 2 characters long"),
  ),
  email: emailString("email"),
  password: passwordString(),
  rememberMe: optionalBoolean(),
});

export const loginSchema = z.object({
  email: emailString("email"),
  password: passwordString(),
  rememberMe: optionalBoolean(),
  scope: z.preprocess(firstString, z.enum(USER_ROLES).optional()),
});

export const forgotPasswordSchema = z.object({
  email: emailString("email"),
});

export const validateResetTokenQuerySchema = z.object({
  token: trimmedString("token"),
});

export const resetPasswordSchema = z
  .object({
    token: trimmedString("token"),
    newPassword: strongPasswordString("newPassword"),
    confirmPassword: strongPasswordString("confirmPassword"),
  })
  .superRefine((value, ctx) => {
    if (value.newPassword !== value.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Passwords do not match",
      });
    }
  });

export const autocompleteQuerySchema = z.object({
  q: optionalTrimmedString(),
});

export const placeDetailsQuerySchema = z.object({
  placeId: trimmedString("placeId"),
});

export const propertyListQuerySchema = z
  .object({
    location: optionalTrimmedString(),
    categoryId: optionalNumber("categoryId", 1),
    minPrice: optionalNumber("minPrice"),
    maxPrice: optionalNumber("maxPrice"),
    minRoi: optionalNumber("minRoi"),
    minArea: optionalNumber("minArea"),
    maxDistanceFromHighway: optionalNumber("maxDistanceFromHighway"),
    status: optionalTrimmedString(),
    sort: z
      .preprocess(firstString, z.enum(propertySortValues).optional())
      .optional(),
    page: optionalNumber("page", 1),
    limit: optionalNumber("limit", 1),
  })
  .superRefine((value, ctx) => {
    validatePropertyFilterCombinations(value, (path, message) => {
      ctx.addIssue({
        code: "custom",
        path: [path],
        message,
      });
    });
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

export const updatePropertySchema = propertyBodySchema.extend({
  existingImages: optionalStringArray(),
});

const recommendationPreferencesSchema = z
  .object({
    location: optionalTrimmedString(),
    latitude: optionalNumber("preferences.latitude"),
    longitude: optionalNumber("preferences.longitude"),
    locationRadiusKm: optionalNumber("preferences.locationRadiusKm"),
    price: optionalNumber("preferences.price"),
    roi: optionalNumber("preferences.roi"),
    area: optionalNumber("preferences.area"),
    maxDistanceFromHighway: optionalNumber(
      "preferences.maxDistanceFromHighway",
    ),
  })
  .superRefine((value, ctx) => {
    if (
      (value.latitude !== undefined && value.longitude === undefined) ||
      (value.latitude === undefined && value.longitude !== undefined)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["latitude"],
        message:
          "preferences.latitude and preferences.longitude must be provided together",
      });
    }
  });

const recommendationPaginationSchema = z.object({
  page: optionalNumber("page", 1),
  limit: optionalNumber("limit", 1),
});

export const recommendationQuerySchema = z
  .object({
    location: optionalTrimmedString(),
    latitude: optionalNumber("latitude"),
    longitude: optionalNumber("longitude"),
    locationRadiusKm: optionalNumber("locationRadiusKm"),
    price: optionalNumber("price"),
    roi: optionalNumber("roi"),
    area: optionalNumber("area"),
    maxDistanceFromHighway: optionalNumber("maxDistanceFromHighway"),
    preferredLocation: optionalTrimmedString(),
    preferredLatitude: optionalNumber("preferredLatitude"),
    preferredLongitude: optionalNumber("preferredLongitude"),
    preferredRoi: optionalNumber("preferredRoi"),
    preferredArea: optionalNumber("preferredArea"),
    preferredMaxDistance: optionalNumber("preferredMaxDistance"),
  })
  .merge(recommendationPaginationSchema)
  .superRefine((value, ctx) => {
    if (
      ((value.latitude !== undefined || value.longitude !== undefined) &&
        (value.latitude === undefined || value.longitude === undefined)) ||
      ((value.preferredLatitude !== undefined ||
        value.preferredLongitude !== undefined) &&
        (value.preferredLatitude === undefined ||
          value.preferredLongitude === undefined))
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["latitude"],
        message: "latitude and longitude must be provided together",
      });
    }
  });

export const recommendationBodySchema = z
  .object({
    preferences: recommendationPreferencesSchema.optional(),
  })
  .merge(recommendationPaginationSchema);
