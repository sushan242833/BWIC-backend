import assert from "node:assert/strict";
import test from "node:test";
import { parsePropertySearchQuery } from "@utils/nlp/property-search-parser";

test("parses public search NLU for nearby locality and budget", () => {
  const result = parsePropertySearchQuery("home near bafal under 3 crore");

  assert.equal(result.category, "home");
  assert.equal(result.location, "Bafal");
  assert.equal(result.maxPrice, 30000000);
  assert.equal(result.textSearch, undefined);
});

test("keeps property-name keywords while extracting location intent", () => {
  const result = parsePropertySearchQuery("Compact Home in Ilam");

  assert.equal(result.category, "home");
  assert.equal(result.location, "Ilam");
  assert.equal(result.textSearch, "compact");
});

test("preserves plain keyword search when no explicit NLU cue exists", () => {
  const result = parsePropertySearchQuery("Bafal Residency");

  assert.equal(result.category, undefined);
  assert.equal(result.location, undefined);
  assert.equal(result.textSearch, "bafal residency");
});

test("keeps numeric property id search intact", () => {
  const result = parsePropertySearchQuery("20750");

  assert.equal(result.category, undefined);
  assert.equal(result.location, undefined);
  assert.equal(result.textSearch, "20750");
});

test("ignores invalid generic nearby phrases in public search", () => {
  const result = parsePropertySearchQuery("home near parking");

  assert.equal(result.category, "home");
  assert.equal(result.location, undefined);
  assert.equal(result.textSearch, undefined);
});
