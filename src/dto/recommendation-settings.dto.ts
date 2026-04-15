import type { RecommendationWeights } from "@constants/recommendation-weights";

export type RecommendationWeightsDto = RecommendationWeights;

export type UpdateRecommendationSettingsRequestDto = RecommendationWeightsDto;

export interface RecommendationSettingsResponseDto {
  weights: RecommendationWeightsDto;
  isDefault: boolean;
}

export interface RecommendationSettingsUpdateResponseDto {
  weights: RecommendationWeightsDto;
}

export interface ResolvedRecommendationWeightsDto {
  weights: RecommendationWeightsDto;
  isDefault: boolean;
  source: "default" | "user";
}
