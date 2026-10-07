import test from "node:test";
import assert from "node:assert/strict";
import { buildDateFilter, csvCell } from "../src/utils/reportDates.js";

test("report date boundaries include the final day and reject invalid ranges", () => {
  assert.equal(buildDateFilter({ dateTo: "2026-09-15" }).lt.toISOString(), "2026-09-16T00:00:00.000Z");
  assert.equal(buildDateFilter({ dateFrom: "2024-02-29" }).gte.toISOString(), "2024-02-29T00:00:00.000Z");
  for (const range of [{ dateFrom: "2026-02-30" }, { dateTo: "invalid" }, { dateFrom: "2026-09-16", dateTo: "2026-09-15" }]) assert.throws(() => buildDateFilter(range));
});
test("CSV escapes delimiters and neutralizes spreadsheet formulas", () => {
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
  assert.equal(csvCell('=1+1'), String.fromCharCode(34, 39) + '=1+1"');
  assert.equal(csvCell(-5), '"-5"');
});
