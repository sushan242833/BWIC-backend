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

test("sends Nepal land-unit and NPR conversion rules to the AI model", async () => {
  let capturedSystemPrompt = "";

  const service = new AIQueryUnderstandingService({
    enabled: true,
    apiKey: "test-key",
    requestChatCompletion: async (payload) => {
      capturedSystemPrompt =
        payload.messages.find((message) => message.role === "system")?.content ||
        "";

      return JSON.stringify({
        category: null,
        location: null,
        maxPrice: 20000000,
        minPrice: null,
        bedrooms: null,
        bathrooms: null,
        parking: null,
        furnished: null,
        minArea: 3645,
        preferredArea: null,
        minRoi: null,
        preferredRoi: null,
        maxDistanceFromHighway: null,
        landmarkPreference: null,
        status: null,
        confidence: 0.95,
      });
    },
  });

  const result = await service.extractRecommendationQuery(
    "land around birgunj under 2 crore with area 1 kattha",
  );

  assert.equal(result?.extraction.maxPrice, 20000000);
  assert.equal(result?.extraction.minArea, 3645);
  assert.match(capturedSystemPrompt, /integer nepalese rupees \(npr\)/i);
  assert.match(capturedSystemPrompt, /1 kattha\/katha = 3645 sq ft/i);
  assert.match(capturedSystemPrompt, /1 bigha = 72900 sq ft/i);
  assert.match(capturedSystemPrompt, /never return area in square meters/i);
});

test("sends qualitative ROI and highway mapping rules to the AI model", async () => {
  let capturedSystemPrompt = "";

  const service = new AIQueryUnderstandingService({
    enabled: true,
    apiKey: "test-key",
    requestChatCompletion: async (payload) => {
      capturedSystemPrompt =
        payload.messages.find((message) => message.role === "system")?.content ||
        "";

      return JSON.stringify({
        category: "home",
        location: {
          value: "Bafal",
          mode: "strict",
          confidence: 0.9,
        },
        maxPrice: null,
        minPrice: null,
        bedrooms: null,
        bathrooms: null,
        parking: null,
        furnished: null,
        minArea: null,
        preferredArea: null,
        minRoi: null,
        preferredRoi: 12,
        maxDistanceFromHighway: 1,
        landmarkPreference: null,
        status: null,
        confidence: 0.94,
      });
    },
  });

  const result = await service.extractRecommendationQuery(
    "home at bafal near highway with good roi",
  );

  assert.equal(result?.extraction.preferredRoi, 12);
  assert.equal(result?.extraction.maxDistanceFromHighway, 1);
  assert.match(capturedSystemPrompt, /map "good roi", "high roi", or "strong roi" to preferredRoi=12/i);
  assert.match(capturedSystemPrompt, /map "very high roi" to preferredRoi=15/i);
  assert.match(
    capturedSystemPrompt,
    /maxDistanceFromHighway=1/i,
  );
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
