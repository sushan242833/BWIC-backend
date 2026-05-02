import {
  DEFAULT_RECOMMENDATION_WEIGHTS,
  type RecommendationWeightKey,
} from "@constants/recommendation-weights";

export const recommendationConfig = {
  topRecommendationLimit: 20,
  minimumMatchPercentage: 30,
  defaultPageSize: 5,
  maxPageSize: 20,
  defaultLocationRadiusKm: 3,
  strongMatchThresholdPercent: 60,
  closePriceDeltaRatio: 0.025,
  closeAreaDeltaRatio: 0.15,
  inactivePreferencePriceToleranceRatio: 0.35,
  inactivePreferenceAreaToleranceRatio: 0.25,
  inactivePreferenceRoiFloorRatio: 0.85,
  earthRadiusKm: 6371,
  scoreWeights: DEFAULT_RECOMMENDATION_WEIGHTS,
} as const;

export type RecommendationScoreKey = RecommendationWeightKey;

export const RECOMMENDATION_SCORE_LABELS: Record<
  RecommendationScoreKey,
  string
> = {
  location: "Location",
  price: "Price",
  roi: "ROI",
  area: "Area",
  highwayAccess: "Access",
};

export const getRecommendationRoiPoints = (
  difference: number,
  maxPoints: number,
): number => {
  return difference <= 0 ? maxPoints : 0;
};
