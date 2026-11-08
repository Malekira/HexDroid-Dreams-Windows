(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DreamsCompletion = api;
})(globalThis, () => {
  const fold = (s) =>
    String(s)
      .toLowerCase()
      .replace(
        /[\[\]\\^]/g,
        (c) => ({ "[": "{", "]": "}", "\\": "|", "^": "~" })[c],
      );
  function token(value, caret) {
    const before = value.slice(0, caret),
      word = /[^\s]*$/.exec(before)[0];
    return {
      word,
      start: caret - word.length,
      end: caret,
      command: before.length === word.length && word.startsWith("/"),
    };
  }
  function matches(values, prefix) {
    const seen = new Set();
    return values
      .filter((v) => {
        const key = fold(v);
        if (seen.has(key) || !fold(v).startsWith(fold(prefix))) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }
  class Cycle {
    reset() {
      this.state = null;
    }
    next(
      value,
      start,
      end,
      key,
      values,
      direction = 1,
      format = (name) => name,
    ) {
      let s = this.state;
      if (
        !s ||
        s.lastValue !== value ||
        s.lastCaret !== start ||
        start !== end ||
        s.key !== key
      ) {
        const t = token(value, start);
        if (!t.word) return null;
        const candidates = matches(values, t.word);
        if (!candidates.length) return null;
        s = {
          key,
          candidates,
          start: t.start,
          suffix: value.slice(end),
          prefix: value.slice(0, t.start),
          index: direction < 0 ? 0 : -1,
        };
      }
      s.index =
        (s.index + direction + s.candidates.length) % s.candidates.length;
      const replacement = format(s.candidates[s.index], s.start) + " ";
      s.lastValue = s.prefix + replacement + s.suffix;
      s.lastCaret = s.prefix.length + replacement.length;
      this.state = s;
      return {
        value: s.lastValue,
        caret: s.lastCaret,
        name: s.candidates[s.index],
        start: s.start,
        end: s.lastCaret - 1,
      };
    }
  }
  return { Cycle, token, matches };
});
