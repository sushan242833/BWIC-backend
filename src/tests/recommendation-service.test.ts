import assert from "node:assert/strict";
import test from "node:test";
import { Op } from "sequelize";
import { RecommendationService } from "@services/recommendation.service";

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
      buildCandidateWhere: (
        mustHave: Record<string, number | string | undefined>,
      ) => Record<string | symbol, unknown>;
    }
  ).buildCandidateWhere({
    categoryId: 1,
    location: "Kathmandu",
    maxPrice: 20000000,
  });

  const andConditions = candidateWhere[Op.and] as Array<Record<string | symbol, unknown>>;

  assert.ok(Array.isArray(andConditions));
  assert.equal(andConditions.length, 2);
  assert.equal(andConditions[0]?.categoryId, 1);
  assert.deepEqual(andConditions[0]?.price, {
    [Op.lte]: 20000000,
  });
});
