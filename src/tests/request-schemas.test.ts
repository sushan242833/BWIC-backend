import assert from "node:assert/strict";
import test from "node:test";
import {
  createPropertySchema,
  favoritePropertyParamSchema,
  loginSchema,
  recommendationBodySchema,
  updatePropertySchema,
} from "../validation/request-schemas";

test("login rejects invalid email format", () => {
  const result = loginSchema.safeParse({
    email: "not-an-email",
    password: "StrongPassword123!",
  });

  assert.equal(result.success, false);
});

test("login rejects missing password", () => {
  const result = loginSchema.safeParse({
    email: "alice@example.com",
  });

  assert.equal(result.success, false);
});

test("property create payload rejects invalid numeric fields", () => {
  const result = createPropertySchema.safeParse({
    title: "Investment Plot",
    categoryId: 1,
    location: "Kathmandu",
    price: 0,
    roi: -1,
    status: "Available",
    area: -1200,
    description: "Good location",
  });

  assert.equal(result.success, false);
});

test("property update payload rejects invalid images and distance", () => {
  const result = updatePropertySchema.safeParse({
    title: "Investment Plot",
    categoryId: 1,
    location: "Kathmandu",
    price: 5000000,
    roi: 10,
    status: "Available",
    area: 1200,
    distanceFromHighway: -10,
    description: "Good location",
    existingImages: new Array(11).fill("/uploads/example.jpg"),
  });

  assert.equal(result.success, false);
});

test("recommendation request rejects invalid preference payloads", () => {
  const result = recommendationBodySchema.safeParse({
    preferences: {
      latitude: 27.7,
    },
  });

  assert.equal(result.success, false);
});

test("favorite params reject invalid property ids", () => {
  const result = favoritePropertyParamSchema.safeParse({
    propertyId: "abc",
  });

  assert.equal(result.success, false);
});
