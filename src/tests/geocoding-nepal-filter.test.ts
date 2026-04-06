import assert from "node:assert/strict";
import test from "node:test";
import { isNepalLocationResult } from "@utils/geocoding";

test("accepts Nominatim results that belong to Nepal by country code", () => {
  const result = isNepalLocationResult({
    display_name: "Bafal, Kathmandu, Bagmati, Nepal",
    address: {
      country_code: "np",
      country: "Nepal",
    },
  });

  assert.equal(result, true);
});

test("rejects Nominatim results from outside Nepal", () => {
  const result = isNepalLocationResult({
    display_name: "Bafal, Abu Dhabi, United Arab Emirates",
    address: {
      country_code: "ae",
      country: "United Arab Emirates",
    },
  });

  assert.equal(result, false);
});

test("falls back to the display name when address metadata is missing", () => {
  const nepalResult = isNepalLocationResult({
    display_name: "Kalanki, Kathmandu, Nepal",
  });
  const foreignResult = isNepalLocationResult({
    display_name: "Kalanki, Someplace, India",
  });

  assert.equal(nepalResult, true);
  assert.equal(foreignResult, false);
});
