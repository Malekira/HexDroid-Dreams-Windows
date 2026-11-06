"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { Presence, normalizeNotify } = require("../src/services/presence");
function fixture(names = ["Alice"]) {
  const wire = [],
    events = [],
    c = {
      ready: true,
      nick: "Me",
      profile: { nick: "Me" },
      emit: (type, e) => events.push({ type, ...e }),
    };
  const p = new Presence(c, names);
  c.sendRaw = (line) => {
    wire.push(line);
    p.observe(line);
  };
  return { p, c, wire, events };
}
test("MONITOR updates connection status once and preserves an initial silent baseline", () => {
  const f = fixture();
  f.p.setMonitor(true);
  assert.ok(f.wire.includes("MONITOR + Alice"));
  f.p.handle({ command: "730", params: ["Me", "Alice!ident@host"] });
  f.p.handle({ command: "730", params: ["Me", "Alice!ident@host"] });
  f.p.handle({ command: "731", params: ["Me", "Alice"] });
  assert.deepEqual(
    f.events.map((e) => [e.nick, e.online, e.initial]),
    [
      ["Alice", true, true],
      ["Alice", false, false],
    ],
  );
  f.p.stop();
});
test("ISON fallback correlates manual requests and nickname recovery without producing false offline results", () => {
  const f = fixture(["Alice", "Bob"]);
  f.c.profile.recoverNick = true;
  f.c.profile.nick = "Original";
  f.c.sendRaw("ISON SomeoneElse");
  f.p.poll();
  f.p.handle({ command: "303", params: ["Me", "SomeoneElse"] });
  assert.equal(f.events.length, 0);
  f.p.poll();
  assert.ok(f.wire.includes("ISON Alice Bob Original"));
  f.p.handle({ command: "303", params: ["Me", "Alice"] });
  assert.equal(f.p.states.get("alice"), true);
  assert.equal(f.p.states.get("bob"), false);
  assert.ok(f.wire.includes("NICK Original"));
  f.p.stop();
});
test("Notify lists are bounded, deduplicated and cannot inject IRC commands", () => {
  assert.deepEqual(normalizeNotify(["Alice", "ALICE", "Bob"]), [
    "Alice",
    "Bob",
  ]);
  assert.throws(() => normalizeNotify(["Alice\r\nOPER x y"]));
  assert.throws(() => normalizeNotify(["#room"]));
  assert.throws(() => normalizeNotify(Array(101).fill("Alice")));
});
test("Room activity speeds up presence changes without treating PART as a disconnection", () => {
  const f = fixture();
  f.p.update("Alice", true);
  f.p.handle({ command: "PART", nick: "Alice", params: ["#room"] });
  assert.equal(f.events.length, 1);
  f.p.handle({ command: "QUIT", nick: "Alice", params: ["bye"] });
  assert.equal(f.events.at(-1).online, false);
  f.p.handle({ command: "JOIN", nick: "Alice", params: ["#room"] });
  assert.equal(f.events.at(-1).online, true);
  f.p.stop();
});
