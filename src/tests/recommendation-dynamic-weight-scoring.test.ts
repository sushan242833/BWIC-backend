import assert from "node:assert/strict";
import test from "node:test";
import { resolveRecommendationWeights } from "@services/recommendation-weight.service";
import { scoreProperty } from "@utils/recommendation";

const baseProperty = {
  title: "Weight Test Property",
  location: "Kathmandu",
  description: "A property used for weight-sensitive ranking tests",
  categoryId: 1,
  status: "available",
  roi: 10,
  distanceFromHighway: 500,
};

const preferences = {
  price: 10000000,
  area: 1000,
};

test("recommendation scoring changes when resolved weights change", () => {
  const priceFitAreaMiss = {
    ...baseProperty,
    price: 10000000,
    area: 2000,
  };
  const priceMissAreaFit = {
    ...baseProperty,
    price: 20000000,
    area: 1000,
  };

  const priceHeavyWeights = resolveRecommendationWeights({
    userSettings: {
      location: 0,
      price: 80,
      area: 20,
      roi: 0,
      highwayAccess: 0,
    },
  }).weights;
  const areaHeavyWeights = resolveRecommendationWeights({
    userSettings: {
      location: 0,
      price: 20,
      area: 80,
      roi: 0,
      highwayAccess: 0,
    },
  }).weights;

  const priceHeavyFirstScore = scoreProperty(
    priceFitAreaMiss,
    preferences,
    priceHeavyWeights,
  ).score;
  const priceHeavySecondScore = scoreProperty(
    priceMissAreaFit,
    preferences,
    priceHeavyWeights,
  ).score;
  const areaHeavyFirstScore = scoreProperty(
    priceFitAreaMiss,
    preferences,
    areaHeavyWeights,
  ).score;
  const areaHeavySecondScore = scoreProperty(
    priceMissAreaFit,
    preferences,
    areaHeavyWeights,
  ).score;

  assert.ok(priceHeavyFirstScore > priceHeavySecondScore);
  assert.ok(areaHeavySecondScore > areaHeavyFirstScore);
});
