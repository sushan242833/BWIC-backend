import assert from "node:assert/strict";
import test from "node:test";
import { scoreProperty } from "@utils/recommendation";

const baseProperty = {
  title: "Yield Property",
  location: "Kathmandu",
  description: "Income-focused opportunity",
  categoryId: 1,
  status: "available",
  price: 10000000,
  area: 1200,
  distanceFromHighway: 1,
};

test("gives full ROI points when property meets or exceeds the ROI target", () => {
  const scored = scoreProperty(
    {
      ...baseProperty,
      roi: 12,
    },
    {
      roi: 10,
    },
  );

  assert.equal(scored.scoreBreakdown?.roi, 5);
  assert.match(
    scored.explanation.find((item) => item.category === "roi")?.reason || "",
    /meets your roi target/i,
  );
});

test("gives zero ROI points when property is below the ROI target", () => {
  const scored = scoreProperty(
    {
      ...baseProperty,
      roi: 9,
    },
    {
      roi: 10,
    },
  );

  assert.equal(scored.scoreBreakdown?.roi, 0);
  assert.match(
    scored.explanation.find((item) => item.category === "roi")?.reason || "",
    /below your roi target/i,
  );
});
