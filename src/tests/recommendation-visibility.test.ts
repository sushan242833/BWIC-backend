import assert from "node:assert/strict";
import test from "node:test";
import type { RecommendationResultDto } from "@dto/recommendation.dto";
import { filterVisibleRecommendations } from "@services/recommendation.service";

const createResult = (
  overrides: Partial<RecommendationResultDto>,
): RecommendationResultDto => ({
  property: {
    id: 1,
    title: "Sample Property",
    categoryId: 1,
    category: { id: 1, name: "Home" },
    location: "Kathmandu",
    price: 10000000,
    roi: 10,
    status: "Available",
    area: 1200,
    images: [],
    description: "Sample",
  },
  matchPercentage: 55,
  score: 10,
  explanation: [],
  rankingSummary: "Sample summary",
  topReasons: [],
  penalties: [],
  scoreBreakdown: {},
  ...overrides,
});

test("filters out recommendations below the minimum match threshold when scoring preferences are active", () => {
  const visible = filterVisibleRecommendations(
    [
      createResult({ matchPercentage: 0, score: 0 }),
      createResult({
        property: { ...createResult({}).property, id: 2 },
        matchPercentage: 42,
      }),
    ],
    {
      hasLocationPreference: false,
      hasScoringPreferences: true,
      minimumMatchPercentage: 30,
      allowZeroMatchResults: false,
    },
  );

  assert.equal(visible.length, 1);
  assert.equal(visible[0]?.matchPercentage, 42);
});

test("removes 0% recommendations even when no scoring preferences are active", () => {
  const visible = filterVisibleRecommendations(
    [
      createResult({ matchPercentage: 0, score: 0 }),
      createResult({
        property: { ...createResult({}).property, id: 3 },
        matchPercentage: 12,
      }),
    ],
    {
      hasLocationPreference: false,
      hasScoringPreferences: false,
      minimumMatchPercentage: 30,
      allowZeroMatchResults: false,
    },
  );

  assert.equal(visible.length, 1);
  assert.equal(visible[0]?.matchPercentage, 12);
  assert.equal(visible[0]?.property.id, 3);
});

test("filters out recommendations with zero location score when location preference is active", () => {
  const visible = filterVisibleRecommendations(
    [
      createResult({
        matchPercentage: 78,
        scoreBreakdown: { location: 0, price: 30 },
      }),
      createResult({
        property: { ...createResult({}).property, id: 4 },
        matchPercentage: 62,
        scoreBreakdown: { location: 21, price: 20 },
      }),
    ],
    {
      hasLocationPreference: true,
      hasScoringPreferences: true,
      minimumMatchPercentage: 30,
      allowZeroMatchResults: false,
    },
  );

  assert.equal(visible.length, 1);
  assert.equal(visible[0]?.property.id, 4);
});

test("keeps location-scoped recommendations even when all scoring weights are inactive", () => {
  const visible = filterVisibleRecommendations(
    [
      createResult({
        matchPercentage: 0,
        score: 0,
        scoreBreakdown: { location: 0 },
      }),
      createResult({
        property: { ...createResult({}).property, id: 5 },
        matchPercentage: 0,
        score: 0,
        scoreBreakdown: { location: 0 },
      }),
    ],
    {
      hasLocationPreference: false,
      hasScoringPreferences: false,
      minimumMatchPercentage: 30,
      allowZeroMatchResults: true,
    },
  );

  assert.equal(visible.length, 2);
  assert.equal(visible[0]?.property.id, 1);
  assert.equal(visible[1]?.property.id, 5);
});
