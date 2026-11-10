"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { parse317 } = require("../src/whois-time");
test("317 idle and sign-on are independent and sign-on is an epoch in seconds", () => {
  const result = parse317(
    ["125", "1700000000", "seconds idle, signon time"],
    1700007200000,
  );
  assert.equal(result.idle, "0 h 2 min 5 s");
  assert.equal(result.connectedFor, "2 h 0 min 0 s");
  assert.equal(
    result.connectedAt,
    new Date(1700000000000).toLocaleString("es-UY"),
  );
});
test("Missing or invalid sign-on never invents a date or a duration from idle or trailing text", () => {
  for (const value of [
    undefined,
    "",
    "0",
    "-1",
    "seconds idle",
    "NaN",
    "1700000000000",
    "999999999999999999999",
  ]) {
    const r = parse317(["60", value], 1700007200000);
    assert.equal(r.idle, "0 h 1 min 0 s");
    assert.equal(r.connectedAt, undefined);
    assert.equal(r.connectedFor, undefined);
  }
  assert.equal(parse317(["-1", "1700000000"], 1700007200000).idle, undefined);
});
test("Missing idle can coexist with valid sign-on and long durations include days", () => {
  const r = parse317(["bad", "1700000000"], 1700176461000);
  assert.equal(r.idle, undefined);
  assert.equal(r.connectedFor, "2 d 1 h 1 min 1 s");
});
