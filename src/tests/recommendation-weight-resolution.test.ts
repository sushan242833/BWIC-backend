import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_RECOMMENDATION_WEIGHTS } from "@constants/recommendation-weights";
import { recommendationSettingsUpdateSchema } from "../validation/request-schemas";
import {
  normalizeRecommendationWeights,
  resolveRecommendationWeights,
} from "@services/recommendation-weight.service";

test("uses default recommendation weights when no user settings are available", () => {
  const resolved = resolveRecommendationWeights({});

  assert.equal(resolved.isDefault, true);
  assert.equal(resolved.source, "default");
  assert.deepEqual(resolved.weights, DEFAULT_RECOMMENDATION_WEIGHTS);
});

test("uses default recommendation weights for authenticated users without saved settings", () => {
  const resolved = resolveRecommendationWeights({
    userSettings: null,
  });

  assert.equal(resolved.isDefault, true);
  assert.deepEqual(resolved.weights, DEFAULT_RECOMMENDATION_WEIGHTS);
});

test("saved user recommendation settings override defaults and normalize to 100", () => {
  const resolved = resolveRecommendationWeights({
    userSettings: {
      location: 3,
      price: 3,
      area: 2,
      roi: 1,
      highwayAccess: 1,
    },
  });

  assert.equal(resolved.isDefault, false);
  assert.deepEqual(resolved.weights, {
    location: 30,
    price: 30,
    area: 20,
    roi: 10,
    highwayAccess: 10,
  });
});

test("normalization keeps the applied weight total at 100", () => {
  const normalized = normalizeRecommendationWeights({
    location: 1,
    price: 1,
    area: 1,
    roi: 1,
    highwayAccess: 1,
  });

  const total = Object.values(normalized).reduce((sum, value) => sum + value, 0);

  assert.deepEqual(normalized, {
    location: 20,
    price: 20,
    area: 20,
    roi: 20,
    highwayAccess: 20,
  });
  assert.equal(total, 100);
});

test("invalid recommendation settings payload is rejected", () => {
  const result = recommendationSettingsUpdateSchema.safeParse({
    ...DEFAULT_RECOMMENDATION_WEIGHTS,
    price: -1,
  });

  assert.equal(result.success, false);
});

test("recommendation settings payload must total 100", () => {
  const result = recommendationSettingsUpdateSchema.safeParse({
    location: 20,
    price: 20,
    area: 20,
    roi: 20,
    highwayAccess: 10,
  });

  assert.equal(result.success, false);
});
