import assert from "node:assert/strict";
import test from "node:test";
import { inspect } from "node:util";
import { buildPropertyWhere } from "@utils/property-filters";

test("qualifies numeric property id search with the Property table alias", () => {
  const whereClause = buildPropertyWhere({ search: "20" });
  const printedClause = inspect(whereClause, { depth: 10 });

  assert.match(printedClause, /Property\.id/);
  assert.doesNotMatch(printedClause, /col: 'id'/);
});
