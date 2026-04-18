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

test("falls back to deterministic brief parsing when AI extraction is unavailable", async () => {
  const parser = new RecommendationQueryParserService({
    aiQueryUnderstandingService: {
      extractRecommendationQuery: async () => null,
    },
    categoryLoader,
  });

  const result = await parser.parse({
    brief: "land around kalanki",
    mustHave: {
      category: "Land",
    },
    preferences: {
      location: "Kalanki",
    },
  });

  assert.equal(result.mustHave.category, "Land");
  assert.equal(result.mustHave.categoryId, 2);
  assert.equal(result.mustHave.location, undefined);
  assert.equal(result.preferences.location, "Kalanki");
  assert.equal(result.parsedBrief.extractionSource, undefined);
  assert.equal(result.parsedBrief.locationMode, undefined);
  assert.equal(
    result.parsedBrief.detectedEntities.some(
      (entity) => entity.type === "category" && entity.value === "land",
    ),
    true,
  );
  assert.equal(result.parsedBrief.aiExtraction, undefined);
  assert.deepEqual(result.parsedBrief.warnings, []);
});

test("supplements partial AI extraction with deterministic compact price parsing", async () => {
  const parser = new RecommendationQueryParserService({
    aiQueryUnderstandingService: {
      extractRecommendationQuery: async () => ({
        source: "ai",
        extraction: {
          category: "land",
          location: {
            value: "Bafal",
            mode: "nearby",
            confidence: 0.88,
          },
          confidence: 0.9,
        },
      }),
    },
    categoryLoader,
  });

  const result = await parser.parse({
    brief: "land around bafal around 2cr",
  });

  assert.equal(result.mustHave.category, "Land");
  assert.equal(result.mustHave.categoryId, 2);
  assert.equal(result.mustHave.location, undefined);
  assert.equal(result.preferences.location, "Bafal");
  assert.equal(result.preferences.price, 20000000);
  assert.equal(result.parsedBrief.extractionSource, "ai");
  assert.equal(
    result.parsedBrief.detectedEntities.some(
      (entity) =>
        entity.type === "preferredPrice" && entity.value === 20000000,
    ),
    true,
  );
});

test("maps AI preferred price into scoring preferences", async () => {
  const parser = new RecommendationQueryParserService({
    aiQueryUnderstandingService: {
      extractRecommendationQuery: async () => ({
        source: "ai",
        extraction: {
          category: "land",
          location: {
            value: "Bafal",
            mode: "nearby",
            confidence: 0.88,
          },
          preferredPrice: 20000000,
          confidence: 0.92,
        },
      }),
    },
    categoryLoader,
  });

  const result = await parser.parse({
    brief: "land around bafal around 2cr",
  });

  assert.equal(result.mustHave.maxPrice, undefined);
  assert.equal(result.preferences.price, 20000000);
  assert.equal(
    result.parsedBrief.detectedEntities.some(
      (entity) =>
        entity.type === "preferredPrice" && entity.value === 20000000,
    ),
    true,
  );
});

test("treats generic property category as all categories", async () => {
  const parser = new RecommendationQueryParserService({
    aiQueryUnderstandingService: {
      extractRecommendationQuery: async () => ({
        source: "ai",
        extraction: {
          category: "property",
          location: {
            value: "Sitapaila",
            mode: "nearby",
            confidence: 0.88,
          },
          preferredPrice: 20000000,
          confidence: 0.92,
        },
      }),
    },
    categoryLoader,
  });

  const result = await parser.parse({
    brief: "property near sitapaila around 2cr",
  });

  assert.equal(result.mustHave.category, undefined);
  assert.equal(result.mustHave.categoryId, undefined);
  assert.equal(result.preferences.location, "Sitapaila");
  assert.equal(result.preferences.price, 20000000);
  assert.deepEqual(result.parsedBrief.warnings, []);
  assert.equal(
    result.parsedBrief.detectedEntities.some(
      (entity) => entity.type === "category",
    ),
    false,
  );
});

test("ignores generic property manual category instead of warning", async () => {
  const parser = new RecommendationQueryParserService({
    aiQueryUnderstandingService: {
      extractRecommendationQuery: async () => null,
    },
    categoryLoader,
  });

  const result = await parser.parse({
    mustHave: {
      category: "property",
    },
    preferences: {
      location: "Sitapaila",
      price: 20000000,
    },
  });

  assert.equal(result.mustHave.category, undefined);
  assert.equal(result.mustHave.categoryId, undefined);
  assert.equal(result.preferences.location, "Sitapaila");
  assert.equal(result.preferences.price, 20000000);
  assert.deepEqual(result.parsedBrief.warnings, []);
});

test("uses the AI area value directly in the recommendation contract", async () => {
  const parser = new RecommendationQueryParserService({
    aiQueryUnderstandingService: {
      extractRecommendationQuery: async () => ({
        source: "ai",
        extraction: {
          location: {
            value: "Tahachal",
            mode: "nearby",
            confidence: 0.98,
          },
          minArea: 3645,
          confidence: 0.96,
        },
      }),
    },
    categoryLoader,
  });

  const result = await parser.parse({
    brief: "property near tahachal with area 1 kattha",
  });

  assert.equal(result.mustHave.minArea, 3645);
  assert.equal(result.preferences.area, 3645);
  assert.equal(result.parsedBrief.aiExtraction?.minArea, 3645);
});

test("uses AI qualitative ROI and highway extraction directly in the recommendation contract", async () => {
  const parser = new RecommendationQueryParserService({
    aiQueryUnderstandingService: {
      extractRecommendationQuery: async () => ({
        source: "ai",
        extraction: {
          category: "home",
          location: {
            value: "Bafal",
            mode: "strict",
            confidence: 0.94,
          },
          preferredRoi: 12,
          maxDistanceFromHighway: 1,
          confidence: 0.96,
        },
      }),
    },
    categoryLoader,
  });

  const result = await parser.parse({
    brief: "home at bafal near highway with good roi",
  });

  assert.equal(result.mustHave.category, "Home");
  assert.equal(result.mustHave.categoryId, 1);
  assert.equal(result.mustHave.location, "Bafal");
  assert.equal(result.preferences.location, "Bafal");
  assert.equal(result.preferences.roi, 12);
  assert.equal(result.mustHave.maxDistanceFromHighway, 1);
  assert.equal(result.preferences.maxDistanceFromHighway, 1);
  assert.equal(result.parsedBrief.aiExtraction?.preferredRoi, 12);
  assert.equal(result.parsedBrief.aiExtraction?.maxDistanceFromHighway, 1);
});

test("keeps AI soft landmark locations as preferences without forcing a strict filter", async () => {
  const parser = new RecommendationQueryParserService({
    aiQueryUnderstandingService: {
      extractRecommendationQuery: async () => ({
        source: "ai",
        extraction: {
          location: {
            value: "Grande International Hospital",
            mode: "soft",
            confidence: 0.84,
          },
          confidence: 0.9,
        },
      }),
    },
    categoryLoader,
  });

  const result = await parser.parse({
    brief: "flat somewhere close to grande international hospital",
  });

  assert.equal(result.mustHave.location, undefined);
  assert.equal(result.preferences.location, "Grande International Hospital");
  assert.equal(result.parsedBrief.locationMode, "soft");
  assert.equal(
    result.parsedBrief.detectedLocation?.value,
    "Grande International Hospital",
  );
});
