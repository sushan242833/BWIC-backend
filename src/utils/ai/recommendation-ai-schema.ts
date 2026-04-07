import { z } from "zod";
import type { RecommendationLocationMode } from "@dto/recommendation.dto";

const LOCATION_MODES = ["strict", "nearby", "soft"] as const;

const nullableTrimmedString = (label: string, maxLength: number) =>
  z.preprocess(
    (value) => {
      if (value === null || value === undefined) {
        return null;
      }

      if (typeof value !== "string") {
        return value;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    },
    z
      .union([
        z
          .string()
          .min(1, `${label} must not be empty`)
          .max(maxLength, `${label} must be ${maxLength} characters or fewer`),
        z.null(),
      ])
      .optional(),
  );

const nullableNumber = (
  label: string,
  options: { min?: number; max?: number; integer?: boolean } = {},
) =>
  z.preprocess(
    (value) => {
      if (value === null || value === undefined || value === "") {
        return null;
      }

      if (typeof value === "string") {
        const parsed = Number.parseFloat(value.replace(/,/g, "").trim());
        return Number.isNaN(parsed) ? value : parsed;
      }

      return value;
    },
    z
      .union([
        (() => {
          let schema = z.number({ error: `${label} must be a number` });
          if (options.integer) {
            schema = schema.int(`${label} must be an integer`);
          }
          if (options.min !== undefined) {
            schema = schema.min(options.min, `${label} must be at least ${options.min}`);
          }
          if (options.max !== undefined) {
            schema = schema.max(options.max, `${label} must be at most ${options.max}`);
          }
          return schema;
        })(),
        z.null(),
      ])
      .optional(),
  );

const nullableBoolean = (label: string) =>
  z.preprocess(
    (value) => {
      if (value === null || value === undefined || value === "") {
        return null;
      }

      if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (["true", "1", "yes", "with", "available"].includes(normalized)) {
          return true;
        }
        if (["false", "0", "no", "without", "not available"].includes(normalized)) {
          return false;
        }
      }

      return value;
    },
    z.union([z.boolean({ error: `${label} must be a boolean` }), z.null()]).optional(),
  );

const aiLocationPayloadSchema = z
  .object({
    value: nullableTrimmedString("location.value", 120),
    mode: z
      .union([z.enum(LOCATION_MODES), z.null()])
      .optional(),
    confidence: nullableNumber("location.confidence", { min: 0, max: 1 }),
  })
  .strict();

const aiRecommendationExtractionPayloadSchema = z
  .object({
    category: nullableTrimmedString("category", 40),
    location: z.union([aiLocationPayloadSchema, z.null()]).optional(),
    maxPrice: nullableNumber("maxPrice", { min: 1 }),
    minPrice: nullableNumber("minPrice", { min: 1 }),
    bedrooms: nullableNumber("bedrooms", { min: 1, max: 20, integer: true }),
    bathrooms: nullableNumber("bathrooms", { min: 1, max: 20, integer: true }),
    parking: nullableBoolean("parking"),
    furnished: nullableBoolean("furnished"),
    minArea: nullableNumber("minArea", { min: 1 }),
    preferredArea: nullableNumber("preferredArea", { min: 1 }),
    minRoi: nullableNumber("minRoi", { min: 0, max: 100 }),
    preferredRoi: nullableNumber("preferredRoi", { min: 0, max: 100 }),
    maxDistanceFromHighway: nullableNumber("maxDistanceFromHighway", {
      min: 0,
      max: 200,
    }),
    landmarkPreference: nullableTrimmedString("landmarkPreference", 120),
    status: nullableTrimmedString("status", 20),
    confidence: nullableNumber("confidence", { min: 0, max: 1 }),
  })
  .strict();

export interface AIRecommendationLocation {
  value?: string;
  mode?: RecommendationLocationMode;
  confidence?: number;
}

export interface AIRecommendationExtraction {
  category?: string;
  location?: AIRecommendationLocation;
  maxPrice?: number;
  minPrice?: number;
  bedrooms?: number;
  bathrooms?: number;
  parking?: boolean;
  furnished?: boolean;
  minArea?: number;
  preferredArea?: number;
  minRoi?: number;
  preferredRoi?: number;
  maxDistanceFromHighway?: number;
  landmarkPreference?: string;
  status?: string;
  confidence?: number;
}

const toOptionalValue = <T>(value: T | null | undefined): T | undefined =>
  value === null || value === undefined ? undefined : value;

const sanitizeLocation = (
  value:
    | z.infer<typeof aiLocationPayloadSchema>
    | null
    | undefined,
): AIRecommendationLocation | undefined => {
  if (!value) {
    return undefined;
  }

  const locationValue = toOptionalValue(value.value);
  const locationMode = toOptionalValue(value.mode);
  const locationConfidence = toOptionalValue(value.confidence);

  if (!locationValue) {
    return undefined;
  }

  return {
    value: locationValue,
    mode: locationMode,
    confidence: locationConfidence,
  };
};

export const sanitizeAIRecommendationExtraction = (
  payload: z.infer<typeof aiRecommendationExtractionPayloadSchema>,
): AIRecommendationExtraction => ({
  category: toOptionalValue(payload.category),
  location: sanitizeLocation(payload.location),
  maxPrice: toOptionalValue(payload.maxPrice),
  minPrice: toOptionalValue(payload.minPrice),
  bedrooms: toOptionalValue(payload.bedrooms),
  bathrooms: toOptionalValue(payload.bathrooms),
  parking: toOptionalValue(payload.parking),
  furnished: toOptionalValue(payload.furnished),
  minArea: toOptionalValue(payload.minArea),
  preferredArea: toOptionalValue(payload.preferredArea),
  minRoi: toOptionalValue(payload.minRoi),
  preferredRoi: toOptionalValue(payload.preferredRoi),
  maxDistanceFromHighway: toOptionalValue(payload.maxDistanceFromHighway),
  landmarkPreference: toOptionalValue(payload.landmarkPreference),
  status: toOptionalValue(payload.status),
  confidence: toOptionalValue(payload.confidence),
});

export const parseAIRecommendationExtraction = (
  input: unknown,
): AIRecommendationExtraction | null => {
  const result = aiRecommendationExtractionPayloadSchema.safeParse(input);
  if (!result.success) {
    return null;
  }

  const sanitized = sanitizeAIRecommendationExtraction(result.data);
  const hasMeaningfulFields = Boolean(
    sanitized.category ||
      sanitized.location?.value ||
      sanitized.maxPrice !== undefined ||
      sanitized.minPrice !== undefined ||
      sanitized.bedrooms !== undefined ||
      sanitized.bathrooms !== undefined ||
      sanitized.parking !== undefined ||
      sanitized.furnished !== undefined ||
      sanitized.minArea !== undefined ||
      sanitized.preferredArea !== undefined ||
      sanitized.minRoi !== undefined ||
      sanitized.preferredRoi !== undefined ||
      sanitized.maxDistanceFromHighway !== undefined ||
      sanitized.landmarkPreference ||
      sanitized.status,
  );

  return hasMeaningfulFields ? sanitized : null;
};

export const aiRecommendationExtractionJsonSchema = {
  name: "real_estate_query_extraction",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "category",
      "location",
      "maxPrice",
      "minPrice",
      "bedrooms",
      "bathrooms",
      "parking",
      "furnished",
      "minArea",
      "preferredArea",
      "minRoi",
      "preferredRoi",
      "maxDistanceFromHighway",
      "landmarkPreference",
      "status",
      "confidence",
    ],
    properties: {
      category: {
        anyOf: [
          { type: "string", minLength: 1, maxLength: 40 },
          { type: "null" },
        ],
      },
      location: {
        anyOf: [
          {
            type: "object",
            additionalProperties: false,
            required: ["value", "mode", "confidence"],
            properties: {
              value: {
                anyOf: [
                  { type: "string", minLength: 1, maxLength: 120 },
                  { type: "null" },
                ],
              },
              mode: {
                anyOf: [
                  { type: "string", enum: LOCATION_MODES },
                  { type: "null" },
                ],
              },
              confidence: {
                anyOf: [
                  { type: "number", minimum: 0, maximum: 1 },
                  { type: "null" },
                ],
              },
            },
          },
          { type: "null" },
        ],
      },
      maxPrice: {
        anyOf: [{ type: "number", minimum: 1 }, { type: "null" }],
      },
      minPrice: {
        anyOf: [{ type: "number", minimum: 1 }, { type: "null" }],
      },
      bedrooms: {
        anyOf: [
          { type: "integer", minimum: 1, maximum: 20 },
          { type: "null" },
        ],
      },
      bathrooms: {
        anyOf: [
          { type: "integer", minimum: 1, maximum: 20 },
          { type: "null" },
        ],
      },
      parking: {
        anyOf: [{ type: "boolean" }, { type: "null" }],
      },
      furnished: {
        anyOf: [{ type: "boolean" }, { type: "null" }],
      },
      minArea: {
        anyOf: [{ type: "number", minimum: 1 }, { type: "null" }],
      },
      preferredArea: {
        anyOf: [{ type: "number", minimum: 1 }, { type: "null" }],
      },
      minRoi: {
        anyOf: [{ type: "number", minimum: 0, maximum: 100 }, { type: "null" }],
      },
      preferredRoi: {
        anyOf: [{ type: "number", minimum: 0, maximum: 100 }, { type: "null" }],
      },
      maxDistanceFromHighway: {
        anyOf: [{ type: "number", minimum: 0, maximum: 200 }, { type: "null" }],
      },
      landmarkPreference: {
        anyOf: [
          { type: "string", minLength: 1, maxLength: 120 },
          { type: "null" },
        ],
      },
      status: {
        anyOf: [
          { type: "string", minLength: 1, maxLength: 20 },
          { type: "null" },
        ],
      },
      confidence: {
        anyOf: [{ type: "number", minimum: 0, maximum: 1 }, { type: "null" }],
      },
    },
  },
} as const;

export const recommendationAIExtractionSchema =
  aiRecommendationExtractionPayloadSchema;
