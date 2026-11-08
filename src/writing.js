(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DreamsWriting = api;
})(globalThis, () => {
  "use strict";
  const clean = (s, max) =>
    typeof s === "string"
      ? s.replace(/[\x00-\x1f\x7f]/g, "").slice(0, max)
      : "";
  function validate(input = {}) {
    const dictionary = [],
      seen = new Set();
    for (const r of Array.isArray(input.dictionary)
      ? input.dictionary.slice(0, 500)
      : []) {
      const from = clean(r?.from, 40),
        to = clean(r?.to, 1000);
      if (!from || /\s/.test(from) || !to) continue;
      const key = r.matchCase ? from : from.toLocaleLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      dictionary.push({
        from,
        to,
        enabled: r.enabled !== false,
        matchCase: r.matchCase === true,
      });
    }
    const n = input.nickCompletion || {},
      template = clean(n.template, 240) || "{nick}";
    return {
      dictionaryEnabled: input.dictionaryEnabled !== false,
      dictionary,
      nickCompletion: {
        enabled: n.enabled === true,
        template: template.includes("{nick}") ? template : "{nick}",
        color: /^#[a-f\d]{6}$/i.test(n.color || "") ? n.color : null,
        background: /^#[a-f\d]{6}$/i.test(n.background || "")
          ? n.background
          : null,
        bold: n.bold === true,
        italic: n.italic === true,
        underline: n.underline === true,
        onlyStart: n.onlyStart === true,
      },
    };
  }
  function replaceWords(text, settings, complete = true) {
    if (settings.dictionaryEnabled === false || !settings.dictionary?.length)
      return text;
    let head = "",
      body = text;
    const command = /^(\/(?:me)\s+|\/(?:msg|notice)\s+\S+\s+)([\s\S]*)$/i.exec(
      text,
    );
    if (text.startsWith("/")) {
      if (!command) return text;
      head = command[1];
      body = command[2];
    }
    const tokens = body.match(/\s+|\S+/gu) || [];
    const result =
      head +
      tokens
        .map((t, i) => {
          if (/\s/.test(t) || (!complete && i === tokens.length - 1)) return t;
          const rule = settings.dictionary.find(
            (r) =>
              r.enabled !== false &&
              (r.matchCase
                ? r.from === t
                : r.from.toLocaleLowerCase() === t.toLocaleLowerCase()),
          );
          return rule?.to ?? t;
        })
        .join("");
    return !text.startsWith("/") && result.startsWith("/")
      ? "/" + result
      : result;
  }
  function nickText(name, settings, context = {}, start = 0) {
    const n = settings.nickCompletion || {};
    if (!n.enabled || (n.onlyStart && start !== 0)) return name;
    return (n.template || "{nick}").replace(
      /\{nick\}|\{red\}|\{sala\}/g,
      (t) =>
        ({
          "{nick}": name,
          "{red}": context.network || "Red",
          "{sala}": context.target || "#sala",
        })[t],
    );
  }
  function prefix(style) {
    const rgb = style.background
        ?.slice(1)
        .match(/../g)
        ?.map((v) => parseInt(v, 16)),
      foreground =
        rgb && rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114 > 150
          ? "111111"
          : "ffffff";
    return (
      (style.bold ? "\x02" : "") +
      (style.italic ? "\x1d" : "") +
      (style.underline ? "\x1f" : "") +
      (style.color
        ? "\x04" +
          style.color.slice(1) +
          (style.background ? "," + style.background.slice(1) : "")
        : style.background
          ? "\x04" + foreground + "," + style.background.slice(1)
          : "")
    );
  }
  class Ranges {
    constructor(value = "", ranges = []) {
      this.value = value;
      this.ranges = ranges
        .filter(
          (r) =>
            Number.isInteger(r.start) &&
            Number.isInteger(r.end) &&
            r.start >= 0 &&
            r.end <= value.length &&
            r.end > r.start,
        )
        .map((r) => ({ ...r }));
    }
    edit(value) {
      const old = this.value;
      if (old === value) return;
      let start = 0,
        end = 0;
      while (
        start < old.length &&
        start < value.length &&
        old[start] === value[start]
      )
        start++;
      while (
        end < old.length - start &&
        end < value.length - start &&
        old[old.length - end - 1] === value[value.length - end - 1]
      )
        end++;
      const oldEnd = old.length - end,
        delta = value.length - old.length;
      this.ranges = this.ranges.flatMap((r) =>
        r.end <= start
          ? [r]
          : r.start >= oldEnd
            ? [{ ...r, start: r.start + delta, end: r.end + delta }]
            : [],
      );
      this.value = value;
    }
    mark(start, end, style) {
      this.ranges = this.ranges.filter((r) => r.end <= start || r.start >= end);
      if (end > start && end <= this.value.length)
        this.ranges.push({ start, end, style: { ...style } });
      this.ranges = this.ranges.slice(-100);
    }
    format(restore = "") {
      let text = this.value;
      for (const r of [...this.ranges].sort((a, b) => b.start - a.start)) {
        const p = prefix(r.style);
        if (p)
          text =
            text.slice(0, r.start) +
            "\x0f" +
            p +
            text.slice(r.start, r.end) +
            "\x0f" +
            restore +
            text.slice(r.end);
      }
      return text;
    }
  }
  return { validate, replaceWords, nickText, prefix, Ranges };
});
