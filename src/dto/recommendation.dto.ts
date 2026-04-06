import type { PropertyStatus } from "@constants/property";
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

export type RecommendationDetectedEntityType =
  | "category"
  | "location"
  | "maxPrice"
  | "preferredPrice"
  | "minRoi"
  | "preferredRoi"
  | "minArea"
  | "preferredArea"
  | "maxDistanceFromHighway"
  | "status";

export interface RecommendationDetectedEntityDto {
  type: RecommendationDetectedEntityType;
  value: string | number;
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

export interface RecommendationParsedBriefMetadataDto {
  brief?: string;
  detectedEntities: RecommendationDetectedEntityDto[];
  detectedLocation?: RecommendationDetectedLocationDto;
  detectedLocations?: RecommendationDetectedLocationDto[];
  parsedMustHave: RecommendationMustHaveDto;
  parsedPreferences: RecommendationPreferencesDto;
  appliedFilters: RecommendationMustHaveDto;
  appliedPreferences: RecommendationPreferencesDto;
  warnings: string[];
}

export interface RecommendationResponseMetaDto {
  parsedBrief: RecommendationParsedBriefMetadataDto;
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
  | "distance";

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
  distance?: number;
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
