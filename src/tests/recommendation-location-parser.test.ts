import assert from "node:assert/strict";
import test from "node:test";
import { parseRecommendationBrief } from "@utils/nlp/recommendation-brief-parser";

test("parses nearby localities as soft recommendation preferences", () => {
  const result = parseRecommendationBrief("home near bafal");

  assert.equal(result.mustHave.location, undefined);
  assert.equal(result.preferences.location, "Bafal");
  assert.equal(result.detectedLocation?.value, "Bafal");
  assert.equal(result.detectedLocation?.mode, "nearby");
});

test("handles common nearby cue typos like 'neaa bafal'", () => {
  const result = parseRecommendationBrief("home neaa bafal");

  assert.equal(result.mustHave.location, undefined);
  assert.equal(result.preferences.location, "Bafal");
  assert.equal(result.detectedLocation?.mode, "nearby");
});

test("parses 'around kalanki' as a nearby location instead of a strict filter", () => {
  const result = parseRecommendationBrief("house around kalanki");

  assert.equal(result.mustHave.location, undefined);
  assert.equal(result.preferences.location, "Kalanki");
  assert.equal(result.detectedLocation?.mode, "nearby");
});

test("parses 'in kathmandu' as a strict must-have location", () => {
  const result = parseRecommendationBrief("land in kathmandu");

  assert.equal(result.mustHave.location, "Kathmandu");
  assert.equal(result.preferences.location, "Kathmandu");
  assert.equal(result.detectedLocation?.mode, "strict");
});

test("parses 'at lalitpur' as a strict city/location filter", () => {
  const result = parseRecommendationBrief("apartment at lalitpur");

  assert.equal(result.mustHave.location, "Lalitpur");
  assert.equal(result.preferences.location, "Lalitpur");
  assert.equal(result.detectedLocation?.mode, "strict");
});

test("keeps price parsing while extracting a nearby locality", () => {
  const result = parseRecommendationBrief(
    "2 bhk home near koteshwor under 2 crore",
  );

  assert.equal(result.mustHave.location, undefined);
  assert.equal(result.preferences.location, "Koteshwor");
  assert.equal(result.mustHave.maxPrice, 20000000);
  assert.equal(result.preferences.price, undefined);
  assert.equal(result.detectedLocation?.mode, "nearby");
});

test("ignores meaningless nearby phrases that should not become locations", () => {
  const result = parseRecommendationBrief("home near parking with balcony");

  assert.equal(result.mustHave.location, undefined);
  assert.equal(result.preferences.location, undefined);
  assert.equal(result.detectedLocation, undefined);
});

test("parses landmark-style school locations without warning and keeps nearby price intent", () => {
  const result = parseRecommendationBrief(
    "property near uniglobe secondary school at around 5 crore",
  );

  assert.equal(result.mustHave.location, undefined);
  assert.equal(result.preferences.location, "Uniglobe Secondary School");
  assert.equal(result.preferences.price, 50000000);
  assert.equal(result.detectedLocation?.value, "Uniglobe Secondary School");
  assert.equal(
    result.detectedEntities.some(
      (entity) => entity.type === "preferredPrice" && entity.value === 50000000,
    ),
    true,
  );
  assert.deepEqual(result.warnings, []);
});

test("still warns about unsupported generic school preferences when no landmark is detected", () => {
  const result = parseRecommendationBrief("property near school");

  assert.equal(result.preferences.location, undefined);
  assert.equal(result.warnings.includes("Ignored unsupported Phase 1 terms: school"), true);
});
