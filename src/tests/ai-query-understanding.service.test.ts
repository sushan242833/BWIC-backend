import assert from "node:assert/strict";
import test from "node:test";
import { AIQueryUnderstandingService } from "@services/ai-query-understanding.service";

test("returns validated AI extraction for a structured Nepal property brief", async () => {
  const service = new AIQueryUnderstandingService({
    enabled: true,
    apiKey: "test-key",
    requestChatCompletion: async () =>
      JSON.stringify({
        category: "home",
        location: {
          value: "Bafal",
          mode: "nearby",
          confidence: 0.86,
        },
        maxPrice: 30000000,
        minPrice: null,
        bedrooms: 2,
        bathrooms: null,
        parking: true,
        furnished: null,
        minArea: null,
        preferredArea: null,
        minRoi: null,
        preferredRoi: null,
        maxDistanceFromHighway: 1,
        landmarkPreference: null,
        status: null,
        confidence: 0.91,
      }),
  });

  const result = await service.extractRecommendationQuery(
    "2 bhk home near bafal with parking under 3 crore",
  );

  assert.equal(result?.source, "ai");
  assert.equal(result?.extraction.category, "home");
  assert.equal(result?.extraction.location?.value, "Bafal");
  assert.equal(result?.extraction.location?.mode, "nearby");
  assert.equal(result?.extraction.maxPrice, 30000000);
  assert.equal(result?.extraction.bedrooms, 2);
  assert.equal(result?.extraction.parking, true);
  assert.equal(result?.extraction.maxDistanceFromHighway, 1);
});

test("fails safely when the AI response is invalid JSON", async () => {
  const service = new AIQueryUnderstandingService({
    enabled: true,
    apiKey: "test-key",
    requestChatCompletion: async () => "{invalid-json",
  });

  const result = await service.extractRecommendationQuery("home near bafal");

  assert.equal(result, null);
});

test("fails safely when the AI request throws", async () => {
  const service = new AIQueryUnderstandingService({
    enabled: true,
    apiKey: "test-key",
    requestChatCompletion: async () => {
      throw new Error("network down");
    },
  });

  const result = await service.extractRecommendationQuery(
    "apartment with parking in lalitpur",
  );

  assert.equal(result, null);
});
