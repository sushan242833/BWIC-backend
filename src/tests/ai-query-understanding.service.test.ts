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
        preferredPrice: null,
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

test("accepts multilingual briefs and returns normalized Latin-script extraction", async () => {
  const service = new AIQueryUnderstandingService({
    enabled: true,
    apiKey: "test-key",
    requestChatCompletion: async () =>
      JSON.stringify({
        category: "home",
        location: {
          value: "Kathmandu",
          mode: "strict",
          confidence: 0.9,
        },
        maxPrice: 20000000,
        preferredPrice: null,
        minPrice: null,
        bedrooms: null,
        bathrooms: null,
        parking: null,
        furnished: null,
        minArea: null,
        preferredArea: null,
        minRoi: null,
        preferredRoi: null,
        maxDistanceFromHighway: null,
        landmarkPreference: null,
        status: null,
        confidence: 0.93,
      }),
  });

  const result = await service.extractRecommendationQuery(
    "काठमाडौंमा २ करोडभित्र घर चाहियो",
  );

  assert.equal(result?.source, "ai");
  assert.equal(result?.extraction.category, "home");
  assert.equal(result?.extraction.location?.value, "Kathmandu");
  assert.equal(result?.extraction.location?.mode, "strict");
  assert.equal(result?.extraction.maxPrice, 20000000);
});

test("supports preferred price extraction for around/about budget language", async () => {
  let capturedSystemPrompt = "";

  const service = new AIQueryUnderstandingService({
    enabled: true,
    apiKey: "test-key",
    requestChatCompletion: async (payload) => {
      capturedSystemPrompt =
        payload.messages.find((message) => message.role === "system")?.content ||
        "";

      return JSON.stringify({
        category: "land",
        location: {
          value: "Bafal",
          mode: "nearby",
          confidence: 0.88,
        },
        maxPrice: null,
        preferredPrice: 20000000,
        minPrice: null,
        bedrooms: null,
        bathrooms: null,
        parking: null,
        furnished: null,
        minArea: null,
        preferredArea: null,
        minRoi: null,
        preferredRoi: null,
        maxDistanceFromHighway: null,
        landmarkPreference: null,
        status: null,
        confidence: 0.92,
      });
    },
  });

  const result = await service.extractRecommendationQuery(
    "land around bafal around 2cr",
  );

  assert.equal(result?.extraction.maxPrice, undefined);
  assert.equal(result?.extraction.preferredPrice, 20000000);
  assert.match(capturedSystemPrompt, /use preferredPrice for target language/i);
  assert.match(capturedSystemPrompt, /compact forms like 2cr/i);
  assert.match(
    capturedSystemPrompt,
    /category=null for generic words like "property"/i,
  );
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
        preferredPrice: null,
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
  assert.match(
    capturedSystemPrompt,
    /use preferredArea for approximate target language like around, about, approximately, roughly, ideal, target, or preferred/i,
  );
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
        preferredPrice: null,
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

test("sends generalized Nepal location-understanding rules to the AI model", async () => {
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
        location: {
          value: "Grande International Hospital",
          mode: "nearby",
          confidence: 0.89,
        },
        maxPrice: null,
        preferredPrice: null,
        minPrice: null,
        bedrooms: null,
        bathrooms: null,
        parking: null,
        furnished: null,
        minArea: null,
        preferredArea: null,
        minRoi: null,
        preferredRoi: null,
        maxDistanceFromHighway: null,
        landmarkPreference: null,
        status: null,
        confidence: 0.92,
      });
    },
  });

  const result = await service.extractRecommendationQuery(
    "flat close to grande international hospital",
  );

  assert.equal(result?.extraction.location?.value, "Grande International Hospital");
  assert.equal(result?.extraction.location?.mode, "nearby");
  assert.match(capturedSystemPrompt, /examples only, not a fixed list/i);
  assert.match(capturedSystemPrompt, /do not limit extraction to predefined locations/i);
  assert.match(
    capturedSystemPrompt,
    /municipalities, wards, toles, chowks, bazaars, bus parks, ring road areas/i,
  );
  assert.match(
    capturedSystemPrompt,
    /spelling variations, transliteration differences, abbreviations, and minor typos/i,
  );
  assert.match(
    capturedSystemPrompt,
    /keep only the actual place or landmark phrase and remove cue words like in, at, near, nearby, around, or close to/i,
  );
});

test("sends multilingual and Latin-script normalization rules to the AI model", async () => {
  let capturedSystemPrompt = "";
  let capturedUserPrompt = "";

  const service = new AIQueryUnderstandingService({
    enabled: true,
    apiKey: "test-key",
    requestChatCompletion: async (payload) => {
      capturedSystemPrompt =
        payload.messages.find((message) => message.role === "system")?.content ||
        "";
      capturedUserPrompt =
        payload.messages.find((message) => message.role === "user")?.content ||
        "";

      return JSON.stringify({
        category: "home",
        location: {
          value: "Kathmandu",
          mode: "strict",
          confidence: 0.9,
        },
        maxPrice: 20000000,
        preferredPrice: null,
        minPrice: null,
        bedrooms: null,
        bathrooms: null,
        parking: null,
        furnished: null,
        minArea: null,
        preferredArea: null,
        minRoi: null,
        preferredRoi: null,
        maxDistanceFromHighway: null,
        landmarkPreference: null,
        status: null,
        confidence: 0.92,
      });
    },
  });

  const result = await service.extractRecommendationQuery(
    "加德满都で2 crore以下の家",
  );

  assert.equal(result?.extraction.category, "home");
  assert.equal(result?.extraction.location?.value, "Kathmandu");
  assert.match(
    capturedSystemPrompt,
    /Nepali, English, Hindi, Hinglish, Chinese, Japanese, or any other language/i,
  );
  assert.match(
    capturedSystemPrompt,
    /return all string fields in English or common Romanized Nepal place names using Latin characters/i,
  );
  assert.match(
    capturedSystemPrompt,
    /return "Kathmandu" instead of "काठमाडौं"/i,
  );
  assert.match(
    capturedSystemPrompt,
    /Arabic digits, Devanagari digits, and language-specific number words/i,
  );
  assert.match(
    capturedUserPrompt,
    /The query may be written in any language or mixed languages/i,
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
