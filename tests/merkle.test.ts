import assert from "node:assert/strict";
import { test } from "node:test";
import { leafHash, merkleRoot } from "../src/lib/merkle.ts";

const a = { accountId: "acct-1", securityId: "sec-1", units: "10000000" };
const b = { accountId: "acct-1", securityId: "sec-2", units: "25000000" };
const c = { accountId: "acct-2", securityId: "sec-1", units: "5" };

test("root is deterministic and order-independent", () => {
  assert.equal(merkleRoot([a, b, c]), merkleRoot([c, a, b]));
  assert.match(merkleRoot([a, b, c]), /^[0-9a-f]{64}$/);
});

test("any change to a balance changes the root", () => {
  assert.notEqual(merkleRoot([a, b]), merkleRoot([a, { ...b, units: "25000001" }]));
});

test("single leaf root is the domain-separated leaf hash", () => {
  assert.equal(merkleRoot([a]), leafHash(a).toString("hex"));
});

test("odd leaf is promoted, not duplicated", () => {
  // With duplication, [a, b, c] and [a, b, c, c] would share a root.
  assert.notEqual(merkleRoot([a, b, c]), merkleRoot([a, b, c, c]));
});
