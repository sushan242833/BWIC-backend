import { normalizePropertyStatus } from "@constants/property";
import type {
  RecommendationDetectedEntityDto,
  RecommendationDetectedLocationDto,
  RecommendationMustHaveDto,
  RecommendationPreferencesDto,
} from "@dto/recommendation.dto";
import { parseCategoryCandidate } from "@utils/nlp/category-parser";
import { parseLocationCandidates } from "@utils/nlp/location-parser";
import {
  parseAreaValue,
  parseDistanceKmValue,
  parseNepaliCurrency,
  parseNumberToken,
} from "@utils/nlp/number-parser";

export interface RecommendationBriefParserResult {
  mustHave: RecommendationMustHaveDto;
  preferences: RecommendationPreferencesDto;
  detectedEntities: RecommendationDetectedEntityDto[];
  detectedLocation?: RecommendationDetectedLocationDto;
  detectedLocations: RecommendationDetectedLocationDto[];
  warnings: string[];
}

const QUALITATIVE_ROI_TARGETS = {
  high: 12,
  "very high": 15,
} as const;

const DEFAULT_HIGHWAY_DISTANCE_KM = 1;

const UNSUPPORTED_BRIEF_TERMS = [
  "bedroom",
  "bedrooms",
  "bhk",
  "bathroom",
  "bathrooms",
  "parking",
  "furnished",
  "balcony",
  "school",
  "hospital",
];

const createEmptyResult = (): RecommendationBriefParserResult => ({
  mustHave: {},
  preferences: {},
  detectedEntities: [],
  detectedLocations: [],
  warnings: [],
});

const pushEntity = (
  entities: RecommendationDetectedEntityDto[],
  entity: RecommendationDetectedEntityDto,
) => {
  const exists = entities.some(
    (current) => current.type === entity.type && current.raw === entity.raw,
  );

  if (!exists) {
    entities.push(entity);
  }
};

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const removeDetectedLocationFragments = (
  brief: string,
  locations: RecommendationDetectedLocationDto[],
): string => {
  let sanitizedBrief = brief;

  for (const location of locations) {
    const fragments = [location.raw, location.value, ...location.aliases]
      .map((fragment) => fragment.trim())
      .filter(Boolean)
      .sort((left, right) => right.length - left.length);

    for (const fragment of fragments) {
      sanitizedBrief = sanitizedBrief.replace(
        new RegExp(`\\b${escapeRegExp(fragment)}\\b`, "gi"),
        " ",
      );
    }
  }

  return sanitizedBrief;
};

const detectUnsupportedTerms = (
  brief: string,
  locations: RecommendationDetectedLocationDto[],
): string[] => {
  const sanitizedBrief = removeDetectedLocationFragments(brief, locations);

  return UNSUPPORTED_BRIEF_TERMS.filter((term) =>
    new RegExp(`\\b${term}\\b`, "i").test(sanitizedBrief),
  );
};

export const parseRecommendationBrief = (
  brief?: string,
): RecommendationBriefParserResult => {
  const normalizedBrief = brief?.trim().replace(/\s+/g, " ") || "";
  if (!normalizedBrief) {
    return createEmptyResult();
  }

  const result = createEmptyResult();

  const category = parseCategoryCandidate(normalizedBrief);
  if (category) {
    result.mustHave.category = category.canonical;
    pushEntity(result.detectedEntities, {
      type: "category",
      value: category.canonical,
      raw: category.raw,
    });
  }

  const locations = parseLocationCandidates(normalizedBrief);
  const strictLocation = locations.find((location) => location.mode === "strict");
  const nearbyLocation = locations.find((location) => location.mode === "nearby");
  const preferredLocation = nearbyLocation || strictLocation;

  result.detectedLocations = locations;
  result.detectedLocation = preferredLocation || strictLocation;

  if (strictLocation) {
    result.mustHave.location = strictLocation.value;
    pushEntity(result.detectedEntities, {
      type: "location",
      value: strictLocation.value,
      raw: strictLocation.raw,
    });
  }

  if (preferredLocation) {
    result.preferences.location = preferredLocation.value;
    pushEntity(result.detectedEntities, {
      type: "location",
      value: preferredLocation.value,
      raw: preferredLocation.raw,
    });
  }

  const pricePattern =
    /\b(?:under|below|less than|not more than|up to|upto|max(?:imum)?(?: budget)?|budget(?: of| up to)?|within)\s+(?:npr|nrs|rs\.?|rupees?)?\s*(\d[\d,]*(?:\.\d+)?)\s*(crores?|crore|cr|lakhs?|lakh|lacs?|lac)\b/i;
  const preferredPricePattern =
    /\b(?:at\s+)?(?:around|about|approximately|approx(?:imately)?|roughly)\s+(?:npr|nrs|rs\.?|rupees?)?\s*(\d[\d,]*(?:\.\d+)?)\s*(crores?|crore|cr|lakhs?|lakh|lacs?|lac)\b/i;
  const priceMatch = normalizedBrief.match(pricePattern);
  if (priceMatch) {
    const rawPrice = priceMatch[0];
    const parsedPrice = parseNepaliCurrency(
      `${priceMatch[1]} ${priceMatch[2]}`,
    );
    if (parsedPrice !== undefined) {
      result.mustHave.maxPrice = parsedPrice;
      result.preferences.price = parsedPrice;
      pushEntity(result.detectedEntities, {
        type: "maxPrice",
        value: parsedPrice,
        raw: rawPrice,
      });
    }
  } else {
    const preferredPriceMatch = normalizedBrief.match(preferredPricePattern);
    if (preferredPriceMatch) {
      const rawPrice = preferredPriceMatch[0];
      const parsedPrice = parseNepaliCurrency(
        `${preferredPriceMatch[1]} ${preferredPriceMatch[2]}`,
      );
      if (parsedPrice !== undefined) {
        result.preferences.price = parsedPrice;
        pushEntity(result.detectedEntities, {
          type: "preferredPrice",
          value: parsedPrice,
          raw: rawPrice,
        });
      }
    }
  }

  const minRoiPattern =
    /\b(?:roi|return on investment)\s*(?:of\s*)?(?:at least|min(?:imum)?|above|over|more than)\s*(\d[\d.]*)\s*%?\b/i;
  const preferredRoiPattern =
    /\b(?:roi|return on investment)\s*(?:of\s*)?(?:around|about|approximately|approx(?:imately)?|target(?: of)?|preferred)?\s*(\d[\d.]*)\s*%?\b/i;
  const highRoiPattern = /\b(?:(very high|high|good|strong)\s+roi)\b/i;

  const minRoiMatch = normalizedBrief.match(minRoiPattern);
  if (minRoiMatch) {
    const parsedRoi = parseNumberToken(minRoiMatch[1]);
    if (parsedRoi !== undefined) {
      result.mustHave.minRoi = parsedRoi;
      result.preferences.roi = parsedRoi;
      pushEntity(result.detectedEntities, {
        type: "minRoi",
        value: parsedRoi,
        raw: minRoiMatch[0],
      });
    }
  } else {
    const preferredRoiMatch = normalizedBrief.match(preferredRoiPattern);
    const highRoiMatch = normalizedBrief.match(highRoiPattern);

    if (preferredRoiMatch) {
      const parsedRoi = parseNumberToken(preferredRoiMatch[1]);
      if (parsedRoi !== undefined) {
        result.preferences.roi = parsedRoi;
        pushEntity(result.detectedEntities, {
          type: "preferredRoi",
          value: parsedRoi,
          raw: preferredRoiMatch[0],
        });
      }
    } else if (highRoiMatch) {
      const qualifier =
        highRoiMatch[1].toLowerCase() as keyof typeof QUALITATIVE_ROI_TARGETS;
      // Phase 1 maps qualitative ROI hints to conservative numeric targets.
      const parsedRoi =
        QUALITATIVE_ROI_TARGETS[qualifier] ?? QUALITATIVE_ROI_TARGETS.high;
      result.preferences.roi = parsedRoi;
      pushEntity(result.detectedEntities, {
        type: "preferredRoi",
        value: parsedRoi,
        raw: highRoiMatch[0],
      });
    }
  }

  const minAreaPattern =
    /\b(?:at least|min(?:imum)?(?: area)?|area above|area over|over|above|more than)\s*(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|square\s*feet|ft2|ft²)\b/i;
  const preferredAreaPattern =
    /\b(?:around|about|approximately|approx(?:imately)?|roughly|near)\s*(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|square\s*feet|ft2|ft²)\b/i;

  const minAreaMatch = normalizedBrief.match(minAreaPattern);
  if (minAreaMatch) {
    const parsedArea = parseAreaValue(minAreaMatch[1]);
    if (parsedArea !== undefined) {
      result.mustHave.minArea = parsedArea;
      result.preferences.area = parsedArea;
      pushEntity(result.detectedEntities, {
        type: "minArea",
        value: parsedArea,
        raw: minAreaMatch[0],
      });
    }
  } else {
    const preferredAreaMatch = normalizedBrief.match(preferredAreaPattern);
    if (preferredAreaMatch) {
      const parsedArea = parseAreaValue(preferredAreaMatch[1]);
      if (parsedArea !== undefined) {
        result.preferences.area = parsedArea;
        pushEntity(result.detectedEntities, {
          type: "preferredArea",
          value: parsedArea,
          raw: preferredAreaMatch[0],
        });
      }
    }
  }

  const highwayDistancePattern =
    /\b(?:within|under|below|less than|up to|upto|max(?:imum)?(?: of)?)\s*(\d[\d,]*(?:\.\d+)?)\s*(?:km|kilometers?|kilometres?)?\s*(?:from|to)?\s*(?:the\s+)?highway\b/i;
  const highwayNearPattern =
    /\b(?:near|close to|close by|next to)\s+(?:the\s+)?highway\b/i;
  const lowHighwayDistancePattern = /\blow highway distance\b/i;

  const explicitHighwayDistanceMatch = normalizedBrief.match(
    highwayDistancePattern,
  );
  if (explicitHighwayDistanceMatch) {
    const parsedDistance = parseDistanceKmValue(
      explicitHighwayDistanceMatch[1],
    );
    if (parsedDistance !== undefined) {
      result.mustHave.maxDistanceFromHighway = parsedDistance;
      result.preferences.maxDistanceFromHighway = parsedDistance;
      pushEntity(result.detectedEntities, {
        type: "maxDistanceFromHighway",
        value: parsedDistance,
        raw: explicitHighwayDistanceMatch[0],
      });
    }
  } else {
    const qualitativeHighwayMatch =
      normalizedBrief.match(highwayNearPattern) ||
      normalizedBrief.match(lowHighwayDistancePattern);

    if (qualitativeHighwayMatch) {
      result.mustHave.maxDistanceFromHighway = DEFAULT_HIGHWAY_DISTANCE_KM;
      result.preferences.maxDistanceFromHighway = DEFAULT_HIGHWAY_DISTANCE_KM;
      pushEntity(result.detectedEntities, {
        type: "maxDistanceFromHighway",
        value: DEFAULT_HIGHWAY_DISTANCE_KM,
        raw: qualitativeHighwayMatch[0],
      });
    }
  }

  const statusPattern = /\b(available|pending|sold|rented)\b/i;
  const statusMatch = normalizedBrief.match(statusPattern);
  if (statusMatch) {
    const normalizedStatus = normalizePropertyStatus(statusMatch[1]);
    if (normalizedStatus) {
      result.mustHave.status = normalizedStatus;
      pushEntity(result.detectedEntities, {
        type: "status",
        value: normalizedStatus,
        raw: statusMatch[0],
      });
    }
  }

  const unsupportedTerms = detectUnsupportedTerms(normalizedBrief, locations);
  if (unsupportedTerms.length > 0) {
    result.warnings.push(
      `Ignored unsupported Phase 1 terms: ${unsupportedTerms.join(", ")}`,
    );
  }

  return result;
};
