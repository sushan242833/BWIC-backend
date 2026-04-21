import { z } from "zod";
import {
  CONTACT_INVESTMENT_RANGE_VALUES,
  NEPAL_PHONE_PATTERN,
  CONTACT_PROPERTY_TYPE_VALUES,
} from "@constants/contact";
import {
  normalizePropertyStatus,
  PROPERTY_AREA_NEPALI_FORMAT_HINT,
  PROPERTY_AREA_NEPALI_PATTERN,
  PROPERTY_STATUSES,
} from "@constants/property";
import { RECOMMENDATION_WEIGHT_TOTAL } from "@constants/recommendation-weights";
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

const optionalPhoneString = (label: string) =>
  optionalTrimmedString().refine(
    (value) => value === undefined || NEPAL_PHONE_PATTERN.test(value),
    `${label} must be a valid Nepal phone number`,
  );

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

const optionalInteger = (label: string, min = 1) =>
  optionalNumber(label, min).refine(
    (value) => value === undefined || Number.isInteger(value),
    `${label} must be an integer`,
  );

const requiredNumber = (label: string, min = 0) =>
  z.preprocess(
    (value) => {
      const candidate = firstString(value);

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
      .min(min, `${label} must be at least ${min}`),
  );

const positiveIntParam = (label: string) =>
  z
    .preprocess(firstString, z.string({ error: `${label} is required` }))
    .transform((value) => value.trim())
    .pipe(z.string().regex(/^\d+$/, `${label} must be a positive integer`));

export const idParamSchema = z.object({
  id: positiveIntParam("id"),
});

export const recommendationDetailParamSchema = z.object({
  propertyId: positiveIntParam("propertyId"),
});

export const favoritePropertyParamSchema = recommendationDetailParamSchema;

export const createCategorySchema = z.object({
  name: trimmedString("name"),
});

export const updateCategorySchema = createCategorySchema;

export const createContactSchema = z.object({
  name: trimmedString("name"),
  email: trimmedString("email").pipe(
    z.string().email("email must be a valid email address"),
  ),
  phone: optionalPhoneString("phone"),
  investmentRange: z.preprocess(
    firstString,
    z.enum(CONTACT_INVESTMENT_RANGE_VALUES, {
      error: "investmentRange is required",
    }),
  ),
  propertyType: z.preprocess(
    firstString,
    z.enum(CONTACT_PROPERTY_TYPE_VALUES, {
      error: "propertyType is required",
    }),
  ),
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
      .min(
        PASSWORD_MIN_LENGTH,
        `password must be at least ${PASSWORD_MIN_LENGTH} characters long`,
      )
      .max(
        PASSWORD_MAX_LENGTH,
        `password must be ${PASSWORD_MAX_LENGTH} characters or fewer`,
      ),
  );

const propertyStatusSchema = trimmedString("status")
  .refine(
    (value) => normalizePropertyStatus(value) !== null,
    `status must be one of ${PROPERTY_STATUSES.join(", ")}`,
  )
  .transform((value) => normalizePropertyStatus(value)!);

const optionalPropertyStatusSchema = optionalTrimmedString()
  .refine(
    (value) => value === undefined || normalizePropertyStatus(value) !== null,
    `status must be one of ${PROPERTY_STATUSES.join(", ")}`,
  )
  .transform((value) =>
    value === undefined ? undefined : normalizePropertyStatus(value)!,
  );

const optionalAreaNepaliSchema = optionalTrimmedString().refine(
  (value) => value === undefined || PROPERTY_AREA_NEPALI_PATTERN.test(value),
  `areaNepali must match the ${PROPERTY_AREA_NEPALI_FORMAT_HINT} format`,
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

export const verifyEmailSchema = z.object({
  email: emailString("email"),
  otp: trimmedString("otp").pipe(
    z.string().regex(/^\d{6}$/, "otp must be a 6-digit numeric code"),
  ),
});

export const resendOtpSchema = z.object({
  email: emailString("email"),
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
    search: optionalTrimmedString(),
    location: optionalTrimmedString(),
    categoryId: optionalNumber("categoryId", 1),
    minPrice: optionalNumber("minPrice"),
    maxPrice: optionalNumber("maxPrice"),
    minRoi: optionalNumber("minRoi"),
    minArea: optionalNumber("minArea"),
    maxDistanceFromHighway: optionalNumber("maxDistanceFromHighway"),
    status: optionalPropertyStatusSchema,
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
  price: requiredNumber("price"),
  roi: requiredNumber("roi"),
  status: propertyStatusSchema,
  area: requiredNumber("area"),
  areaNepali: optionalAreaNepaliSchema,
  distanceFromHighway: optionalNumber("distanceFromHighway"),
  description: trimmedString("description"),
});

export const createPropertySchema = propertyBodySchema;

export const updatePropertySchema = propertyBodySchema.extend({
  existingImages: optionalStringArray(),
});

const recommendationPreferencesSchema = z
  .object({
    categoryId: optionalInteger("preferences.categoryId"),
    category: optionalTrimmedString(),
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
    status: optionalPropertyStatusSchema,
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

const recommendationMustHaveSchema = z.object({
  categoryId: optionalInteger("mustHave.categoryId"),
  category: optionalTrimmedString(),
  location: optionalTrimmedString(),
  maxPrice: optionalNumber("mustHave.maxPrice"),
  minRoi: optionalNumber("mustHave.minRoi"),
  minArea: optionalNumber("mustHave.minArea"),
  maxDistanceFromHighway: optionalNumber("mustHave.maxDistanceFromHighway"),
  status: optionalPropertyStatusSchema,
});

export const recommendationQuerySchema = z
  .object({
    brief: optionalTrimmedString(),
    categoryId: optionalInteger("categoryId"),
    category: optionalTrimmedString(),
    location: optionalTrimmedString(),
    latitude: optionalNumber("latitude"),
    longitude: optionalNumber("longitude"),
    locationRadiusKm: optionalNumber("locationRadiusKm"),
    price: optionalNumber("price"),
    roi: optionalNumber("roi"),
    area: optionalNumber("area"),
    maxDistanceFromHighway: optionalNumber("maxDistanceFromHighway"),
    status: optionalPropertyStatusSchema,
    mustHaveCategoryId: optionalInteger("mustHaveCategoryId"),
    mustHaveCategory: optionalTrimmedString(),
    mustHaveLocation: optionalTrimmedString(),
    maxPrice: optionalNumber("maxPrice"),
    minRoi: optionalNumber("minRoi"),
    minArea: optionalNumber("minArea"),
    mustHaveMaxDistanceFromHighway: optionalNumber(
      "mustHaveMaxDistanceFromHighway",
    ),
    mustHaveStatus: optionalPropertyStatusSchema,
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
    brief: optionalTrimmedString(),
    mustHave: recommendationMustHaveSchema.optional(),
    preferences: recommendationPreferencesSchema.optional(),
  })
  .merge(recommendationPaginationSchema);

export const recommendationSettingsUpdateSchema = z
  .object({
    location: requiredNumber("location"),
    price: requiredNumber("price"),
    area: requiredNumber("area"),
    roi: requiredNumber("roi"),
    highwayAccess: requiredNumber("highwayAccess"),
  })
  .superRefine((value, ctx) => {
    const total =
      Math.round(
        (value.location +
          value.price +
          value.area +
          value.roi +
          value.highwayAccess) *
          100,
      ) / 100;

    if (total <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["weights"],
        message: "At least one recommendation weight must be greater than 0",
      });
      return;
    }

    if (total !== RECOMMENDATION_WEIGHT_TOTAL) {
      ctx.addIssue({
        code: "custom",
        path: ["weights"],
        message: `Recommendation weights must total ${RECOMMENDATION_WEIGHT_TOTAL}`,
      });
    }
  });
