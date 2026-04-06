import type { PropertyStatus } from "@constants/property";
import type { RecommendationDetectedEntityDto } from "@dto/recommendation.dto";
import { normalizeLocationText } from "@utils/nlp/location-parser";
import { parseRecommendationBrief } from "@utils/nlp/recommendation-brief-parser";

export interface ParsedPropertySearchQuery {
  category?: string;
  location?: string;
  maxPrice?: number;
  minRoi?: number;
  minArea?: number;
  maxDistanceFromHighway?: number;
  status?: PropertyStatus;
  textSearch?: string;
}

const PROPERTY_SEARCH_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "around",
  "at",
  "bathroom",
  "bathrooms",
  "balcony",
  "bedroom",
  "bedrooms",
  "bhk",
  "by",
  "close",
  "commercial",
  "for",
  "flat",
  "furnished",
  "home",
  "hospital",
  "house",
  "in",
  "land",
  "near",
  "nearby",
  "of",
  "or",
  "parking",
  "plot",
  "plots",
  "property",
  "properties",
  "residential",
  "school",
  "shop",
  "the",
  "to",
  "under",
  "upto",
  "up",
  "villa",
  "with",
]);

const buildIgnoredTokens = (
  entities: RecommendationDetectedEntityDto[],
): Set<string> => {
  const ignoredTokens = new Set<string>();

  for (const entity of entities) {
    [entity.raw, typeof entity.value === "string" ? entity.value : ""].forEach(
      (candidate) => {
        normalizeLocationText(candidate)
          .split(" ")
          .filter(Boolean)
          .forEach((token) => ignoredTokens.add(token));
      },
    );
  }

  return ignoredTokens;
};

export const parsePropertySearchQuery = (
  search?: string,
): ParsedPropertySearchQuery => {
  const normalizedSearch = search?.trim();
  if (!normalizedSearch) {
    return {};
  }

  const parsedBrief = parseRecommendationBrief(normalizedSearch);
  const ignoredTokens = buildIgnoredTokens(parsedBrief.detectedEntities);

  const textTokens = normalizeLocationText(normalizedSearch)
    .split(" ")
    .filter(
      (token) =>
        token.length > 1 &&
        !PROPERTY_SEARCH_STOPWORDS.has(token) &&
        !ignoredTokens.has(token),
    );

  const textSearch =
    textTokens.length > 0 ? Array.from(new Set(textTokens)).join(" ") : undefined;

  return {
    category: parsedBrief.mustHave.category,
    location: parsedBrief.mustHave.location || parsedBrief.preferences.location,
    maxPrice: parsedBrief.mustHave.maxPrice,
    minRoi: parsedBrief.mustHave.minRoi,
    minArea: parsedBrief.mustHave.minArea,
    maxDistanceFromHighway: parsedBrief.mustHave.maxDistanceFromHighway,
    status: parsedBrief.mustHave.status,
    textSearch,
  };
};
