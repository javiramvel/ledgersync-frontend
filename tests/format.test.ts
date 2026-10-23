import assert from "node:assert/strict";
import { test } from "node:test";
import { fromUnits, toUnits } from "../src/lib/format.ts";

test("toUnits converts decimals to 7-decimal base units", () => {
  assert.equal(toUnits("1"), 10_000_000n);
  assert.equal(toUnits("1,234.5"), 12_345_000_000n);
  assert.equal(toUnits("0.0000001"), 1n);
});

test("toUnits rejects invalid input", () => {
  for (const bad of ["", "-1", "1.00000001", "abc", "1e5"]) assert.throws(() => toUnits(bad));
});

test("fromUnits round-trips", () => {
  assert.equal(fromUnits(toUnits("1500")), "1,500");
  assert.equal(fromUnits(-25_000_000n), "-2.5");
});
