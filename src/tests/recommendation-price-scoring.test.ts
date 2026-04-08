import assert from "node:assert/strict";
import test from "node:test";
import { scoreProperty } from "@utils/recommendation";

const baseProperty = {
  title: "Budget Home",
  location: "Kathmandu",
  description: "Affordable option",
  categoryId: 1,
  status: "available",
  roi: 8,
  area: 1200,
  distanceFromHighway: 1,
};

test("gives full price points to properties within a maximum budget", () => {
  const scored = scoreProperty(
    {
      ...baseProperty,
      price: 9800000,
    },
    {
      priceCeiling: 10000000,
    },
  );

  assert.equal(scored.scoreBreakdown?.price, 35);
  assert.match(
    scored.explanation.find((item) => item.category === "price")?.reason || "",
    /within 2\.5% of your budget target/i,
  );
});

test("gives full price points to properties at or below the preferred price", () => {
  const scored = scoreProperty(
    {
      ...baseProperty,
      price: 9800000,
    },
    {
      price: 10000000,
    },
  );

  assert.equal(scored.scoreBreakdown?.price, 35);
  assert.match(
    scored.explanation.find((item) => item.category === "price")?.reason || "",
    /within 2\.5% of your preferred price/i,
  );
});

test("reduces price points when the property is more than 2.5% above the preferred price", () => {
  const scored = scoreProperty(
    {
      ...baseProperty,
      price: 12000000,
    },
    {
      price: 10000000,
    },
  );

  assert.equal(scored.scoreBreakdown?.price, 28.88);
  assert.match(
    scored.explanation.find((item) => item.category === "price")?.reason || "",
    /above your preferred price range/i,
  );
});

test("reduces price points when the property is far below the budget target", () => {
  const scored = scoreProperty(
    {
      ...baseProperty,
      price: 4500000,
    },
    {
      priceCeiling: 10000000,
    },
  );

  assert.equal(scored.scoreBreakdown?.price, 16.63);
  assert.match(
    scored.explanation.find((item) => item.category === "price")?.reason || "",
    /below your budget target/i,
  );
});
