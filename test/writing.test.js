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
  assert.equal(W.prefix({ background: "#ffffff" }), "\x0301,00");
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
  assert.ok(ranges.format().includes("\x0315👋 Alice 💜"));
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
test("Nick colors are compatible with clients that understand only classic IRC color codes", () => {
  const text = W.formatCompletion(
    "✨ SoyUnAlien 💜",
    { color: "#db0abf", bold: true },
    "SoyUnAlien",
  );
  assert.ok(text.includes("\x0306"));
  assert.ok(!text.includes("\x04"));
  assert.ok(!text.includes("db0abf"));
  assert.equal(
    text
      .replace(/\x03\d{2}(?:,\d{2})?/g, "")
      .replace(/[\x02\x0f\x1d\x1f]/g, ""),
    "✨ SoyUnAlien 💜",
  );
  assert.equal(W.colorCode("#ff0000", "#ffffff"), "\x0304,00");
});
test("Letter, gradient and rainbow modes color the nickname and reset before suffix decorations", () => {
  const F = require("../src/formatting");
  for (const colorMode of ["letters", "gradient", "rainbow"]) {
    const style = {
        colorMode,
        color: "#ff0000",
        endColor: "#0000fc",
        letterColors: ["#ff0000", "#0000fc"],
      },
      text = W.formatCompletion("✨ Alice 💜", style, "Alice");
    assert.equal(F.plain(text), "✨ Alice 💜");
    assert.ok(!text.includes("\x04"));
    const codes = [...text.matchAll(/\x03(\d{2})/g)].map((m) => Number(m[1]));
    assert.ok(codes.every((n) => n <= 15));
    assert.ok(new Set(codes).size >= 2);
    assert.ok(text.includes("\x0f\x0304 💜"));
  }
  const text = W.formatCompletion(
    "Bob",
    { colorMode: "letters", letterColors: ["#ff0000", "#0000fc"] },
    "Bob",
  );
  assert.match(text, /\x0304B\x0312o\x0304b/);
});
test("Multicolor settings validate and formatted nickname metadata survives draft restoration", () => {
  const s = W.validate({
    nickCompletion: {
      enabled: true,
      colorMode: "gradient",
      color: "#ff0000",
      endColor: "#0000fc",
      letterColors: ["bad", "#00ffff"],
    },
  }).nickCompletion;
  assert.deepEqual(s.letterColors, ["#00ffff"]);
  assert.equal(s.colorMode, "gradient");
  const model = new W.Ranges("✨ Alice 💜 ");
  model.mark(0, 10, s, "Alice");
  const copy = new W.Ranges(model.value, structuredClone(model.ranges));
  assert.equal(copy.format(), model.format());
  assert.equal(
    W.validate({ nickCompletion: { colorMode: "unsupported" } }).nickCompletion
      .colorMode,
    "single",
  );
});
