(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DreamsWriting = api;
})(globalThis, () => {
  "use strict";
  const classic = [
    "#ffffff",
    "#111111",
    "#00007f",
    "#009300",
    "#ff0000",
    "#7f0000",
    "#9c009c",
    "#fc7f00",
    "#ffff00",
    "#00fc00",
    "#009393",
    "#00ffff",
    "#0000fc",
    "#ff00ff",
    "#7f7f7f",
    "#d2d2d2",
  ];
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  function nearest(color) {
    const c = rgb(color);
    let best = 0,
      distance = Infinity;
    classic.forEach((hex, i) => {
      const p = rgb(hex),
        d = c.reduce((n, v, k) => n + (v - p[k]) ** 2, 0);
      if (d < distance) {
        distance = d;
        best = i;
      }
    });
    return String(best).padStart(2, "0");
  }
  function colorCode(color, background) {
    if (!color && !background) return "";
    const bg = background ? rgb(background) : null,
      fore =
        color ||
        (bg[0] * 0.299 + bg[1] * 0.587 + bg[2] * 0.114 > 150
          ? "#111111"
          : "#ffffff");
    return (
      "\x03" + nearest(fore) + (background ? "," + nearest(background) : "")
    );
  }
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
        colorMode: ["single", "letters", "gradient", "rainbow"].includes(
          n.colorMode,
        )
          ? n.colorMode
          : "single",
        endColor: /^#[a-f\d]{6}$/i.test(n.endColor || "")
          ? n.endColor
          : "#00ffff",
        letterColors: (Array.isArray(n.letterColors)
          ? n.letterColors
          : ["#9c009c", "#009393", "#ff00ff"]
        )
          .filter((c) => typeof c === "string" && /^#[a-f\d]{6}$/i.test(c))
          .slice(0, 12),
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
    return (
      (style.bold ? "\x02" : "") +
      (style.italic ? "\x1d" : "") +
      (style.underline ? "\x1f" : "") +
      colorCode(style.color, style.background)
    );
  }
  function multicolor(text, style) {
    const chars =
        typeof Intl.Segmenter === "function"
          ? [
              ...new Intl.Segmenter(undefined, {
                granularity: "grapheme",
              }).segment(text),
            ].map((x) => x.segment)
          : [...text],
      list = style.letterColors?.length
        ? style.letterColors
        : ["#9c009c", "#009393", "#ff00ff"],
      rainbow = [
        "#ff0000",
        "#fc7f00",
        "#ffff00",
        "#009300",
        "#009393",
        "#0000fc",
        "#9c009c",
      ];
    const from = rgb(style.color || "#9c009c"),
      to = rgb(style.endColor || "#00ffff");
    let last = "",
      out = "";
    chars.forEach((ch, i) => {
      let color =
        style.colorMode === "rainbow"
          ? rainbow[i % rainbow.length]
          : style.colorMode === "letters"
            ? list[i % list.length]
            : "#" +
              from
                .map((v, k) =>
                  Math.round(
                    v + ((to[k] - v) * i) / Math.max(1, chars.length - 1),
                  )
                    .toString(16)
                    .padStart(2, "0"),
                )
                .join("");
      const code = colorCode(color, style.background);
      if (code !== last) {
        out += code;
        last = code;
      }
      out += ch;
    });
    return out;
  }
  function formatCompletion(text, style, nick) {
    const base = prefix(style);
    if (!style.colorMode || style.colorMode === "single") return base + text;
    const index = nick ? text.indexOf(nick) : -1;
    if (index < 0) return base + multicolor(text, style);
    return (
      base +
      text.slice(0, index) +
      multicolor(nick, style) +
      "\x0f" +
      base +
      text.slice(index + nick.length)
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
    mark(start, end, style, nick) {
      this.ranges = this.ranges.filter((r) => r.end <= start || r.start >= end);
      if (end > start && end <= this.value.length)
        this.ranges.push({ start, end, style: { ...style }, nick });
      this.ranges = this.ranges.slice(-100);
    }
    format(restore = "") {
      let text = this.value;
      for (const r of [...this.ranges].sort((a, b) => b.start - a.start)) {
        const p = prefix(r.style);
        if (p || (r.style.colorMode && r.style.colorMode !== "single"))
          text =
            text.slice(0, r.start) +
            "\x0f" +
            formatCompletion(text.slice(r.start, r.end), r.style, r.nick) +
            "\x0f" +
            restore +
            text.slice(r.end);
      }
      return text;
    }
  }
  return {
    validate,
    replaceWords,
    nickText,
    prefix,
    colorCode,
    nearest,
    formatCompletion,
    classic,
    Ranges,
  };
});
