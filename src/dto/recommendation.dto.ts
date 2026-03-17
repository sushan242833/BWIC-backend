import type { PropertySummaryDto } from "@utils/property-serializers";

export interface RecommendationMustHaveDto {
  location?: string;
  categoryId?: number;
  minPrice?: number;
  maxPrice?: number;
  minRoi?: number;
  minArea?: number;
  maxDistanceFromHighway?: number;
  status?: string;
}

export interface RecommendationPreferencesDto {
  location?: string;
  latitude?: number;
  longitude?: number;
  locationRadiusKm?: number;
  budget?: number;
  roiPercent?: number;
  areaSqft?: number;
  maxDistanceFromHighway?: number;
}

export interface RecommendationRequestDto {
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

export type RecommendationExplanationTone =
  | "positive"
  | "negative"
  | "neutral";

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
