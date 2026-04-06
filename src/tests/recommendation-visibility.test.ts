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

test("filters out recommendation results with 0 percent match", () => {
  const visible = filterVisibleRecommendations(
    [
      createResult({ matchPercentage: 0, score: 0 }),
      createResult({ property: { ...createResult({}).property, id: 2 }, matchPercentage: 42 }),
    ],
    {
      hasLocationPreference: false,
      hasScoringPreferences: true,
      minimumMatchPercentage: 30,
    },
  );

  assert.equal(visible.length, 1);
  assert.equal(visible[0]?.matchPercentage, 42);
});

test("keeps non-zero recommendations only when there are no active scoring preferences", () => {
  const visible = filterVisibleRecommendations(
    [
      createResult({ matchPercentage: 0, score: 0 }),
      createResult({ property: { ...createResult({}).property, id: 3 }, matchPercentage: 12 }),
    ],
    {
      hasLocationPreference: false,
      hasScoringPreferences: false,
      minimumMatchPercentage: 30,
    },
  );

  assert.equal(visible.length, 1);
  assert.equal(visible[0]?.matchPercentage, 12);
});
