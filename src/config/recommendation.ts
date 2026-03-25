export const recommendationConfig = {
  topRecommendationLimit: 20,
  minimumMatchPercentage: 30,
  defaultPageSize: 5,
  maxPageSize: 20,
  defaultLocationRadiusKm: 5,
  strongMatchThresholdPercent: 60,
  closePriceDeltaRatio: 0.1,
  closeAreaDeltaRatio: 0.15,
  earthRadiusKm: 6371,
  scoreWeights: {
    location: 35,
    price: 35,
    roi: 5,
    area: 20,
    distance: 5,
  },
  roiShortfallPoints: {
    1: 4,
    2: 3,
    3: 2,
    4: 1,
  } as const,
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
  if (difference <= 0) {
    return recommendationConfig.scoreWeights.roi;
  }

  return (
    recommendationConfig.roiShortfallPoints[
      difference as keyof typeof recommendationConfig.roiShortfallPoints
    ] ?? 0
  );
};
