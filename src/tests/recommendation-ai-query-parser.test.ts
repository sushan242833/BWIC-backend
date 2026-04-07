import assert from "node:assert/strict";
import test from "node:test";
import { RecommendationQueryParserService } from "@services/recommendation-query-parser.service";

const categoryLoader = async () => [
  { id: 1, name: "Home" },
  { id: 2, name: "Land" },
];

test("maps AI extraction into the existing recommendation request contract", async () => {
  const parser = new RecommendationQueryParserService({
    aiQueryUnderstandingService: {
      extractRecommendationQuery: async () => ({
        source: "ai",
        extraction: {
          category: "home",
          location: {
            value: "Bafal",
            mode: "nearby",
            confidence: 0.88,
          },
          maxPrice: 30000000,
          bedrooms: 2,
          parking: true,
          confidence: 0.93,
        },
      }),
    },
    categoryLoader,
  });

  const result = await parser.parse({
    brief: "2 bhk home near bafal with parking under 3 crore",
  });

  assert.equal(result.mustHave.category, "Home");
  assert.equal(result.mustHave.categoryId, 1);
  assert.equal(result.mustHave.location, undefined);
  assert.equal(result.mustHave.maxPrice, 30000000);
  assert.equal(result.preferences.location, "Bafal");
  assert.equal(result.preferences.price, undefined);
  assert.equal(result.parsedBrief.extractionSource, "ai");
  assert.equal(result.parsedBrief.locationMode, "nearby");
  assert.equal(result.parsedBrief.aiExtraction?.bedrooms, 2);
  assert.equal(result.parsedBrief.aiExtraction?.parking, true);
  assert.equal(
    result.parsedBrief.detectedEntities.some(
      (entity) => entity.type === "parking" && entity.value === true,
    ),
    true,
  );
});

test("falls back to the rule-based parser when AI extraction is unavailable", async () => {
  const parser = new RecommendationQueryParserService({
    aiQueryUnderstandingService: {
      extractRecommendationQuery: async () => null,
    },
    categoryLoader,
  });

  const result = await parser.parse({
    brief: "land around kalanki",
  });

  assert.equal(result.mustHave.category, "Land");
  assert.equal(result.mustHave.categoryId, 2);
  assert.equal(result.preferences.location, "Kalanki");
  assert.equal(result.mustHave.location, undefined);
  assert.equal(result.parsedBrief.extractionSource, "rule_based_fallback");
  assert.equal(result.parsedBrief.locationMode, "nearby");
  assert.equal(result.parsedBrief.aiExtraction, undefined);
});
