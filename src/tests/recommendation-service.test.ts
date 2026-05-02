import assert from "node:assert/strict";
import test from "node:test";
import { Op } from "sequelize";
import { DEFAULT_RECOMMENDATION_WEIGHTS } from "@constants/recommendation-weights";
import { RecommendationService } from "@services/recommendation.service";
import { buildRecommendationPropertyWhere } from "@utils/property-filters";

const ZERO_WEIGHTS = {
  location: 0,
  price: 0,
  area: 0,
  roi: 0,
  highwayAccess: 0,
} as const;

test("reuses recommendation must-have values as scoring preferences instead of filtering", () => {
  const service = new RecommendationService();

  const scoringPreferences = (
    service as unknown as {
      buildScoringPreferences: (
        preferences: Record<string, number | string | undefined>,
        mustHave: Record<string, number | string | undefined>,
      ) => Record<string, number | string | undefined>;
    }
  ).buildScoringPreferences(
    {},
    {
      location: "Bafal",
      maxPrice: 10000000,
      minRoi: 12,
      minArea: 1500,
      maxDistanceFromHighway: 1,
    },
  );

  assert.equal(scoringPreferences.location, "Bafal");
  assert.equal(scoringPreferences.priceCeiling, 10000000);
  assert.equal(scoringPreferences.roi, 12);
  assert.equal(scoringPreferences.area, 1500);
  assert.equal(scoringPreferences.maxDistanceFromHighway, 1);
});

test("builds candidate filters from must-have location and budget constraints", () => {
  const service = new RecommendationService();

  const candidateWhere = (
    service as unknown as {
      buildLocationScopedCandidateWhere: (
        mustHave: Record<string, number | string | string[] | undefined>,
        preferences: Record<string, number | string | string[] | undefined>,
        weights: typeof DEFAULT_RECOMMENDATION_WEIGHTS,
      ) => Record<string | symbol, unknown>;
    }
  ).buildLocationScopedCandidateWhere(
    {
      categoryId: 1,
      location: "Kathmandu",
      maxPrice: 20000000,
    },
    {},
    DEFAULT_RECOMMENDATION_WEIGHTS,
  );

  const andConditions = candidateWhere[Op.and] as Array<Record<string | symbol, unknown>>;

  assert.ok(Array.isArray(andConditions));
  assert.equal(andConditions.length, 2);
  assert.equal(andConditions[0]?.categoryId, 1);
  assert.deepEqual(andConditions[0]?.price, {
    [Op.lte]: 20000000,
  });
});

test("builds candidate filters from preferred locations when no must-have location is present", () => {
  const service = new RecommendationService();

  const candidateWhere = (
    service as unknown as {
      buildLocationScopedCandidateWhere: (
        mustHave: Record<string, number | string | string[] | undefined>,
        preferences: Record<string, number | string | string[] | undefined>,
        weights: typeof DEFAULT_RECOMMENDATION_WEIGHTS,
      ) => Record<string | symbol, unknown>;
    }
  ).buildLocationScopedCandidateWhere(
    {
      categoryId: 1,
      maxPrice: 20000000,
    },
    {
      locations: ["Bafal", "Kalanki"],
    },
    DEFAULT_RECOMMENDATION_WEIGHTS,
  );

  const andConditions = candidateWhere[Op.and] as Array<Record<string | symbol, unknown>>;

  assert.ok(Array.isArray(andConditions));
  assert.equal(andConditions.length, 2);
  assert.equal(andConditions[0]?.categoryId, 1);
  assert.deepEqual(andConditions[0]?.price, {
    [Op.lte]: 20000000,
  });
  assert.deepEqual(
    andConditions[1],
    buildRecommendationPropertyWhere({
      location: "Bafal",
      locations: ["Bafal", "Kalanki"],
    }),
  );
});

test("keeps must-have locations stricter than preferred locations when both exist", () => {
  const service = new RecommendationService();

  const candidateWhere = (
    service as unknown as {
      buildLocationScopedCandidateWhere: (
        mustHave: Record<string, number | string | string[] | undefined>,
        preferences: Record<string, number | string | string[] | undefined>,
        weights: typeof DEFAULT_RECOMMENDATION_WEIGHTS,
      ) => Record<string | symbol, unknown>;
    }
  ).buildLocationScopedCandidateWhere(
    {
      location: "Kathmandu",
    },
    {
      locations: ["Bafal"],
    },
    DEFAULT_RECOMMENDATION_WEIGHTS,
  );

  assert.deepEqual(
    candidateWhere,
    buildRecommendationPropertyWhere({
      location: "Kathmandu",
    }),
  );
});

test("scopes inactive preference filters into the candidate query when weights are zero", () => {
  const service = new RecommendationService();

  const candidateWhere = (
    service as unknown as {
      buildLocationScopedCandidateWhere: (
        mustHave: Record<string, number | string | string[] | undefined>,
        preferences: Record<string, number | string | string[] | undefined>,
        weights: typeof DEFAULT_RECOMMENDATION_WEIGHTS,
      ) => Record<string | symbol, unknown>;
    }
  ).buildLocationScopedCandidateWhere(
    {},
    {
      price: 20000000,
      roi: 12,
      area: 10000,
      maxDistanceFromHighway: 1,
    },
    ZERO_WEIGHTS,
  );

  assert.deepEqual(
    candidateWhere,
    buildRecommendationPropertyWhere({
      minPrice: 13000000,
      maxPrice: 27000000,
      minRoi: 10.2,
      minArea: 7500,
      maxArea: 12500,
      maxDistanceFromHighway: 1,
    }),
  );
});
