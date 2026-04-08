import assert from "node:assert/strict";
import test from "node:test";
import { scoreProperty } from "@utils/recommendation";

const baseProperty = {
  title: "Accessible Home",
  location: "Kathmandu",
  description: "Close to the main road",
  categoryId: 1,
  status: "available",
  price: 10000000,
  roi: 8,
  area: 1200,
};

test("gives full highway access points when property distance in meters is within the preferred kilometers", () => {
  const scored = scoreProperty(
    {
      ...baseProperty,
      distanceFromHighway: 300,
    },
    {
      maxDistanceFromHighway: 0.5,
    },
  );

  assert.equal(scored.scoreBreakdown?.distance, 5);
  assert.match(
    scored.explanation.find((item) => item.category === "distance")?.reason ||
      "",
    /within your preferred distance from the highway/i,
  );
});
