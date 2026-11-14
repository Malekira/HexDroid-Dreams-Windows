(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DreamsClassicEditor = api;
})(globalThis, () => {
  function valid(text) {
    if (/[\x04\x1b]/.test(text)) return false;
    for (const m of String(text).matchAll(/\x03(\d{1,2})?(?:,(\d{1,2}))?/g))
      if ([m[1], m[2]].some((n) => n !== undefined && Number(n) > 15))
        return false;
    return true;
  }
  function color(text, start, end, index) {
    if (!Number.isInteger(index) || index < 0 || index > 15)
      throw Error("Solo colores IRC 00–15.");
    const code = "\x03" + String(index).padStart(2, "0");
    let restore = "";
    if (end > start) {
      const f =
          typeof module === "object" && module.exports
            ? require("./formatting")
            : globalThis.DreamsFormatting,
        style = f.segments(text.slice(0, end) + "\u200b").at(-1).style;
      restore = "\x0f";
      for (const [key, control] of Object.entries({
        bold: "\x02",
        italic: "\x1d",
        underline: "\x1f",
        strike: "\x1e",
        mono: "\x11",
        inverse: "\x16",
      }))
        if (style[key]) restore += control;
      const fg = f.colors.indexOf(style.color),
        bg = f.colors.indexOf(style.background);
      if (fg >= 0 && fg < 16)
        restore +=
          "\x03" +
          String(fg).padStart(2, "0") +
          (bg >= 0 && bg < 16 ? "," + String(bg).padStart(2, "0") : "");
    }
    return {
      value:
        text.slice(0, start) +
        code +
        text.slice(start, end) +
        restore +
        text.slice(end),
      start: start + code.length,
      end: end + code.length,
    };
  }
  function style(text, start, end, name) {
    const code = { bold: "\x02", italic: "\x1d", underline: "\x1f" }[name];
    if (!code) throw Error("Estilo no válido.");
    let restore = "";
    if (end > start) {
      const f =
          typeof module === "object" && module.exports
            ? require("./formatting")
            : globalThis.DreamsFormatting,
        s = f.segments(text.slice(0, end) + "\u200b").at(-1).style;
      restore =
        "\x0f" +
        (s.bold ? "\x02" : "") +
        (s.italic ? "\x1d" : "") +
        (s.underline ? "\x1f" : "");
      const fg = f.colors.indexOf(s.color),
        bg = f.colors.indexOf(s.background);
      if (fg >= 0 && fg < 16)
        restore +=
          "\x03" +
          String(fg).padStart(2, "0") +
          (bg >= 0 && bg < 16 ? "," + String(bg).padStart(2, "0") : "");
    }
    const selected = text.slice(start, end).split(code).join("");
    return {
      value: text.slice(0, start) + code + selected + restore + text.slice(end),
      start: start + 1,
      end: start + 1 + selected.length,
    };
  }
  return { valid, color, style };
});
