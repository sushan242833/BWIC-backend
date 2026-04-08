export const recommendationConfig = {
  topRecommendationLimit: 20,
  minimumMatchPercentage: 30,
  defaultPageSize: 5,
  maxPageSize: 20,
  defaultLocationRadiusKm: 3,
  strongMatchThresholdPercent: 60,
  closePriceDeltaRatio: 0.025,
  closeAreaDeltaRatio: 0.15,
  earthRadiusKm: 6371,
  scoreWeights: {
    location: 35,
    price: 35,
    roi: 5,
    area: 20,
    distance: 5,
  },
} as const;

export type RecommendationScoreKey =
  keyof typeof recommendationConfig.scoreWeights;

export const RECOMMENDATION_SCORE_LABELS: Record<
  RecommendationScoreKey,
  string
> = {
  location: "Location",
  price: "Price",
  roi: "ROI",
  area: "Area",
  distance: "Access",
};

export const getRecommendationRoiPoints = (difference: number): number => {
  return difference <= 0 ? recommendationConfig.scoreWeights.roi : 0;
};
