import assert from "node:assert/strict";
import test from "node:test";
import { Op } from "sequelize";
import { buildRecommendationPropertyWhere } from "@utils/property-filters";
import { scoreProperty } from "@utils/recommendation";

const baseProperty = {
  categoryId: 1,
  status: "available",
  price: 25000000,
  roi: 8,
  area: 1200,
  distanceFromHighway: 1,
};

test("ranks locality and alias matches above city-only matches", () => {
  const localityMatch = scoreProperty(
    {
      ...baseProperty,
      title: "2 BHK Home near Koteshwar Chowk",
      location: "Kathmandu",
      description: "Parking available",
    },
    {
      location: "Koteshwor",
    },
  );

  const cityOnlyMatch = scoreProperty(
    {
      ...baseProperty,
      title: "Family Home in Kathmandu",
      location: "Kathmandu",
      description: "Well connected city property",
    },
    {
      location: "Koteshwor",
    },
  );

  assert.ok((localityMatch.scoreBreakdown?.location || 0) > 0);
  assert.ok(
    (localityMatch.scoreBreakdown?.location || 0) >
      (cityOnlyMatch.scoreBreakdown?.location || 0),
  );
});

test("matches landmark variants in descriptions for locality scoring", () => {
  const scored = scoreProperty(
    {
      ...baseProperty,
      title: "Residential Home",
      location: "Kathmandu",
      description: "Walking distance from Swayambhunath stupa",
    },
    {
      location: "Swayambhu",
    },
  );

  assert.ok((scored.scoreBreakdown?.location || 0) > 0);
  assert.match(scored.explanation[0]?.reason || "", /preferred area/i);
});

test("scores a property when it matches any preferred location alternative", () => {
  const scored = scoreProperty(
    {
      ...baseProperty,
      title: "Residential land near Kalanki chowk",
      location: "Kalanki, Kathmandu",
      description: "Quick ring road access",
    },
    {
      locations: ["Bafal", "Kalanki"],
    },
  );

  assert.ok((scored.scoreBreakdown?.location || 0) > 0);
  assert.equal(scored.matchPercentage > 0, true);
  assert.match(scored.explanation[0]?.reason || "", /preferred area/i);
});

test("builds recommendation location filters across multiple searchable fields", () => {
  const where = buildRecommendationPropertyWhere({
    location: "Kathmandu",
  });

  const orConditions = (where as Record<symbol, unknown[]>)[Op.or];

  assert.ok(Array.isArray(orConditions));
  assert.ok(orConditions.length >= 3);
});

test("converts recommendation highway distance filters from kilometers to meters", () => {
  const where = buildRecommendationPropertyWhere({
    maxDistanceFromHighway: 0.5,
  });

  assert.deepEqual(
    (where as Record<string, Record<symbol, number>>).distanceFromHighway,
    {
      [Op.lte]: 500,
    },
  );
});
