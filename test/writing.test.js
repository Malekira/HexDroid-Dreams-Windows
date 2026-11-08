"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  W = require("../src/writing"),
  { Cycle } = require("../src/completion"),
  { destinations } = require("../src/services/notice-policy");
test("Dictionary replaces whole words once, supports case and enabled flags, and preserves command arguments", () => {
  const s = W.validate({
    dictionary: [
      { from: "XDD", to: "😂" },
      { from: "hola", to: "XDD" },
      { from: "OK", to: "Exacto", matchCase: true },
      { from: "off", to: "No", enabled: false },
    ],
  });
  assert.equal(
    W.replaceWords("XDD xdd hola OK ok off", s),
    "😂 😂 XDD Exacto ok off",
  );
  assert.equal(W.replaceWords("XDD!", s), "XDD!");
  assert.equal(W.replaceWords("/msg XDD XDD", s), "/msg XDD 😂");
  assert.equal(W.replaceWords("/me XDD", s), "/me 😂");
  assert.equal(W.replaceWords("/join XDD", s), "/join XDD");
  assert.equal(W.replaceWords("XDD", s, false), "XDD");
  assert.equal(W.replaceWords("XDD ", s, false), "😂 ");
});
test("Dictionary cannot turn literal text into a command, recurses nowhere and strips control characters", () => {
  const s = W.validate({
    dictionary: [
      { from: "bye", to: "/quit" },
      { from: "bad\n", to: "\0hello" },
      { from: "two words", to: "bad" },
    ],
  });
  assert.equal(W.replaceWords("bye", s), "//quit");
  assert.equal(W.replaceWords("bye ", s, false), "//quit ");
  assert.equal(W.replaceWords("//quit", s), "//quit");
  assert.equal(s.dictionary[1].to, "hello");
  assert.equal(s.dictionary.length, 2);
  assert.equal(
    W.validate({ nickCompletion: { template: "no nick" } }).nickCompletion
      .template,
    "{nick}",
  );
});
test("Formatted nick completion cycles the original names and keeps emojis out of raw editor codes", () => {
  assert.equal(W.prefix({ background: "#ffffff" }), "\x04111111,ffffff");
  const settings = W.validate({
      nickCompletion: {
        enabled: true,
        template: "👋 {nick} 💜",
        color: "#aabbcc",
        bold: true,
      },
    }),
    cycle = new Cycle(),
    names = ["Alice", "Alberto"];
  let r = cycle.next("Al", 2, 2, "room", names, 1, (n, start) =>
    W.nickText(n, settings, {}, start),
  );
  assert.equal(r.value, "👋 Alberto 💜 ");
  r = cycle.next(r.value, r.caret, r.caret, "room", names, 1, (n) =>
    W.nickText(n, settings),
  );
  assert.equal(r.value, "👋 Alice 💜 ");
  const ranges = new W.Ranges(r.value);
  ranges.mark(r.start, r.end, settings.nickCompletion);
  assert.ok(ranges.format().includes("\x04aabbcc👋 Alice 💜"));
  assert.ok(!/[\x00-\x1f]/.test(r.value));
});
test("Nick formatting follows non-overlapping edits, is dropped if edited, and survives restoring a draft", () => {
  const ranges = new W.Ranges("Alice hola");
  ranges.mark(0, 5, { bold: true });
  ranges.edit("Alice hola!");
  assert.equal(ranges.ranges.length, 1);
  const restored = new W.Ranges(ranges.value, ranges.ranges);
  assert.equal(restored.format(), "\x0f\x02Alice\x0f hola!");
  restored.edit("Alicia hola!");
  assert.equal(restored.ranges.length, 0);
  const r = new W.Ranges("hey Alice");
  r.mark(4, 9, { italic: true });
  r.edit("hey! Alice");
  assert.equal(r.ranges[0].start, 5);
  assert.equal(r.format(), "hey! \x0f\x1dAlice\x0f");
});
test("NOTICE destinations are explicit, deduplicate copies and use only this network active room", () => {
  const d = { target: "#room", nick: "Alice" };
  assert.deepEqual(destinations(d, {}, {}), ["#room"]);
  assert.deepEqual(
    destinations(
      d,
      { noticeDestinations: ["original", "room", "status", "private"] },
      { target: "#other" },
    ),
    ["#room", "Alice", "*"],
  );
  assert.deepEqual(
    destinations(
      { target: "Alice", nick: "Alice" },
      { noticeDestinations: ["room"] },
      null,
    ),
    ["*"],
  );
  assert.deepEqual(
    destinations(
      { target: "Alice", nick: "Alice" },
      { noticeDestinations: ["room"] },
      { target: "#here" },
    ),
    ["#here"],
  );
  assert.deepEqual(
    destinations(
      { target: "*", nick: "server" },
      { noticeDestinations: ["private"] },
      {},
    ),
    ["*"],
  );
  assert.deepEqual(destinations(d, { noticeDestinations: [] }, {}), []);
});
