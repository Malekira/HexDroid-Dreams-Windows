(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DreamsFormatting = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const colors = [
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
  colors.push(
    ..."470000 472100 474700 324700 004700 00472c 004747 002747 000047 2e0047 470047 47002a 740000 743a00 747400 517400 007400 007449 007474 004074 000074 4b0074 740074 740045 b50000 b56300 b5b500 7db500 00b500 00b571 00b5b5 0063b5 0000b5 7500b5 b500b5 b5006b ff0000 ff8c00 ffff00 b2ff00 00ff00 00ffa0 00ffff 008cff 0000ff a500ff ff00ff ff0098 ff5959 ffb459 ffff71 cfff60 6fff6f 65ffc9 6dffff 59b4ff 5959ff c459ff ff66ff ff59bc ff9c9c ffd39c ffff9c e2ff9c 9cff9c 9cffdb 9cffff 9cd3ff 9c9cff dc9cff ff9cff ff94d3 000000 131313 282828 363636 4d4d4d 656565 818181 9f9f9f bcbcbc e2e2e2 ffffff"
      .split(" ")
      .map((c) => "#" + c),
  );
  function ansiColor(n) {
    const base = [
      "#333333",
      "#cd5555",
      "#55aa55",
      "#c4a84e",
      "#6699ee",
      "#bb77cc",
      "#55b7bb",
      "#eeeeee",
      "#808080",
      "#ff0000",
      "#00ff00",
      "#ffff00",
      "#0000ff",
      "#ff00ff",
      "#00ffff",
      "#ffffff",
    ];
    if (n < 16) return base[n];
    if (n < 232) {
      const k = n - 16,
        v = [0, 95, 135, 175, 215, 255];
      return (
        "#" +
        [v[Math.floor(k / 36)], v[Math.floor(k / 6) % 6], v[k % 6]]
          .map((c) => c.toString(16).padStart(2, "0"))
          .join("")
      );
    }
    if (n < 256) {
      const v = (8 + (n - 232) * 10).toString(16).padStart(2, "0");
      return "#" + v.repeat(3);
    }
  }
  function segments(value) {
    const text = String(value),
      output = [];
    let style = {},
      buffer = "";
    const flush = () => {
      if (buffer) output.push({ text: buffer, style: { ...style } });
      buffer = "";
    };
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (["\x02", "\x1d", "\x1f", "\x1e", "\x11", "\x16"].includes(c)) {
        flush();
        const key = {
          "\x02": "bold",
          "\x1d": "italic",
          "\x1f": "underline",
          "\x1e": "strike",
          "\x11": "mono",
          "\x16": "inverse",
        }[c];
        style[key] = !style[key];
      } else if (c === "\x0f") {
        flush();
        style = {};
      } else if (c === "\x03" || c === "\x04") {
        flush();
        const m = (
          c === "\x03"
            ? /^(\d{1,2})(?:,(\d{1,2}))?/
            : /^([a-f\d]{6})(?:,([a-f\d]{6}))?/i
        ).exec(text.slice(i + 1));
        if (!m) {
          delete style.color;
          delete style.background;
        } else {
          style.color =
            c === "\x04" ? "#" + m[1] : colors[Number(m[1])] || undefined;
          style.background = m[2]
            ? c === "\x04"
              ? "#" + m[2]
              : colors[Number(m[2])] || undefined
            : undefined;
          i += m[0].length;
        }
      } else if (c === "\x1b") {
        const m = /^\[([\d;]*)m/.exec(text.slice(i + 1));
        if (m) {
          flush();
          i += m[0].length;
          const codes = (m[1] || "0").split(";").map(Number);
          for (let j = 0; j < codes.length; j++) {
            const n = codes[j];
            if (n === 0) style = {};
            else if (n === 1) style.bold = true;
            else if (n === 3) style.italic = true;
            else if (n === 4) style.underline = true;
            else if (n === 7) style.inverse = true;
            else if (n === 9) style.strike = true;
            else if (n === 22) style.bold = false;
            else if (n === 23) style.italic = false;
            else if (n === 24) style.underline = false;
            else if (n === 27) style.inverse = false;
            else if (n === 29) style.strike = false;
            else if (n === 39) delete style.color;
            else if (n === 49) delete style.background;
            else if (n >= 30 && n <= 37) style.color = ansiColor(n - 30);
            else if (n >= 40 && n <= 47) style.background = ansiColor(n - 40);
            else if (n >= 90 && n <= 97) style.color = ansiColor(n - 90 + 8);
            else if (n >= 100 && n <= 107)
              style.background = ansiColor(n - 100 + 8);
            else if (n === 38 || n === 48) {
              const key = n === 38 ? "color" : "background";
              if (
                codes[j + 1] === 5 &&
                Number.isInteger(codes[j + 2]) &&
                codes[j + 2] >= 0 &&
                codes[j + 2] <= 255
              ) {
                style[key] = ansiColor(codes[j + 2]);
                j += 2;
              } else if (
                codes[j + 1] === 2 &&
                codes.slice(j + 2, j + 5).length === 3 &&
                codes
                  .slice(j + 2, j + 5)
                  .every((c) => Number.isInteger(c) && c >= 0 && c <= 255)
              ) {
                style[key] =
                  "#" +
                  codes
                    .slice(j + 2, j + 5)
                    .map((c) => c.toString(16).padStart(2, "0"))
                    .join("");
                j += 4;
              }
            }
          }
        }
      } else if (
        c === "\n" ||
        c === "\t" ||
        (c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127)
      )
        buffer += c;
    }
    flush();
    return output;
  }
  function plain(text) {
    return segments(text)
      .map((s) => s.text)
      .join("");
  }
  function render(node, text) {
    node.replaceChildren();
    for (const s of segments(text)) {
      const span = node.ownerDocument.createElement("span");
      span.textContent = s.text;
      const v = s.style;
      if (v.bold) span.style.fontWeight = "700";
      if (v.italic) span.style.fontStyle = "italic";
      if (v.underline || v.strike)
        span.style.textDecoration = [
          v.underline ? "underline" : "",
          v.strike ? "line-through" : "",
        ]
          .join(" ")
          .trim();
      if (v.mono) span.style.fontFamily = "Consolas, monospace";
      if (v.color) span.style.color = v.color;
      if (v.background) span.style.backgroundColor = v.background;
      if (v.inverse) span.style.filter = "invert(1)";
      node.append(span);
    }
  }
  return { segments, plain, render, colors };
});
