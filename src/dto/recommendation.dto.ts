import type { PropertyStatus } from "@constants/property";
import type { RecommendationWeightsDto } from "@dto/recommendation-settings.dto";
import type { PropertySummaryDto } from "@utils/property-serializers";

export interface RecommendationMustHaveDto {
  categoryId?: number;
  category?: string;
  location?: string;
  maxPrice?: number;
  minRoi?: number;
  minArea?: number;
  maxDistanceFromHighway?: number;
  status?: PropertyStatus;
}

export interface RecommendationPreferencesDto {
  categoryId?: number;
  category?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  locationRadiusKm?: number;
  price?: number;
  roi?: number;
  area?: number;
  maxDistanceFromHighway?: number;
  status?: PropertyStatus;
}

export type RecommendationLocationMode = "strict" | "nearby" | "soft";
export type RecommendationExtractionSource = "ai";

export type RecommendationDetectedEntityType =
  | "category"
  | "location"
  | "maxPrice"
  | "minPrice"
  | "preferredPrice"
  | "bedrooms"
  | "bathrooms"
  | "parking"
  | "furnished"
  | "minRoi"
  | "preferredRoi"
  | "minArea"
  | "preferredArea"
  | "maxDistanceFromHighway"
  | "landmark"
  | "status";

export interface RecommendationDetectedEntityDto {
  type: RecommendationDetectedEntityType;
  value: string | number | boolean;
  raw: string;
}

export interface RecommendationDetectedLocationDto {
  raw: string;
  value: string;
  normalizedValue: string;
  aliases: string[];
  mode: RecommendationLocationMode;
  confidence: number;
  matchReason: string;
}

export interface RecommendationAIExtractionDto {
  category?: string;
  location?: {
    value?: string;
    mode?: RecommendationLocationMode;
    confidence?: number;
  };
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

export interface RecommendationParsedBriefMetadataDto {
  brief?: string;
  extractionSource?: RecommendationExtractionSource;
  extractionConfidence?: number;
  locationMode?: RecommendationLocationMode;
  detectedEntities: RecommendationDetectedEntityDto[];
  detectedLocation?: RecommendationDetectedLocationDto;
  detectedLocations?: RecommendationDetectedLocationDto[];
  aiExtraction?: RecommendationAIExtractionDto;
  parsedMustHave: RecommendationMustHaveDto;
  parsedPreferences: RecommendationPreferencesDto;
  appliedFilters: RecommendationMustHaveDto;
  appliedPreferences: RecommendationPreferencesDto;
  warnings: string[];
}

export interface RecommendationResponseMetaDto {
  parsedBrief: RecommendationParsedBriefMetadataDto;
  appliedWeights: RecommendationWeightsDto;
  isDefaultWeights: boolean;
  weightSource: "default" | "user";
}

export interface RecommendationRequestDto {
  brief?: string;
  mustHave?: RecommendationMustHaveDto;
  preferences?: RecommendationPreferencesDto;
  page?: number;
  limit?: number;
}

export type RecommendationScoreKey =
  | "location"
  | "price"
  | "roi"
  | "area"
  | "highwayAccess";

export type RecommendationExplanationTone = "positive" | "negative" | "neutral";

export interface RecommendationExplanationDto {
  category: RecommendationScoreKey;
  sentiment: RecommendationExplanationTone;
  reason: string;
  points: number;
}

export interface RecommendationScoreBreakdownDto {
  location?: number;
  price?: number;
  roi?: number;
  area?: number;
  highwayAccess?: number;
}

export interface RecommendationResultDto {
  property: PropertySummaryDto;
  matchPercentage: number;
  score: number;
  explanation: RecommendationExplanationDto[];
  rankingSummary: string;
  topReasons: string[];
  penalties: string[];
  scoreBreakdown?: RecommendationScoreBreakdownDto;
}

export interface RecommendationDetailDto {
  property: PropertySummaryDto;
  recommendation: Omit<RecommendationResultDto, "property"> & {
    rank: number | null;
  };
  meta: RecommendationResponseMetaDto;
}
