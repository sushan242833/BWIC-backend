export const RECOMMENDATION_WEIGHT_TOTAL = 100;

export const RECOMMENDATION_WEIGHT_KEYS = [
  "location",
  "price",
  "area",
  "roi",
  "highwayAccess",
] as const;

export type RecommendationWeightKey =
  (typeof RECOMMENDATION_WEIGHT_KEYS)[number];

export type RecommendationWeights = Record<RecommendationWeightKey, number>;

export const DEFAULT_RECOMMENDATION_WEIGHTS: RecommendationWeights = {
  location: 35,
  price: 35,
  area: 20,
  roi: 5,
  highwayAccess: 5,
};

const defaultWeightTotal = RECOMMENDATION_WEIGHT_KEYS.reduce(
  (total, key) => total + DEFAULT_RECOMMENDATION_WEIGHTS[key],
  0,
);

if (defaultWeightTotal !== RECOMMENDATION_WEIGHT_TOTAL) {
  throw new Error(
    `Default recommendation weights must total ${RECOMMENDATION_WEIGHT_TOTAL}`,
  );
}
