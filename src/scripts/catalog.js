"use strict";
const { parse } = require("./interpreter"),
  { plain } = require("../formatting");
function catalog(source) {
  const tree = parse(source),
    lines = source.split(/\r?\n/),
    out = [];
  for (const node of tree) {
    const alias = /^alias\s+([a-z][a-z0-9_.-]*)$/i.exec(node.header);
    if (!alias) continue;
    const name = alias[1],
      escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      index = lines.findIndex((line) =>
        new RegExp("^\\s*alias\\s+" + escaped + "(?:\\s|\\{)", "i").test(line),
      );
    let comments = [];
    for (let i = index - 1; i >= 0 && i >= index - 8; i--) {
      if (!lines[i].trim()) continue;
      if (!/^\s*;/.test(lines[i])) break;
      comments.unshift(lines[i].replace(/^\s*;\s?/, ""));
    }
    let usage = "/" + name,
      description = "";
    for (const line of lines.filter((l) => /^\s*;/.test(l))) {
      const m = new RegExp(
        "^\\s*;\\s*/" + escaped + "(?=\\s|$)\\s*(.*)$",
        "i",
      ).exec(line);
      if (m) {
        const parts = m[1].split(/\s{2,}/);
        usage = "/" + name + (parts[0] ? " " + parts[0] : "");
        description = parts.slice(1).join(" ");
        break;
      }
    }
    const internal = /^(?:sw_|ds_|hdg_|pv\d+\.|[a-z]+\.)/i.test(name),
      actions = [];
    function walk(nodes) {
      for (const n of nodes || []) {
        actions.push(n.header);
        walk(n.body);
      }
    }
    walk(node.body);
    const hint = actions.find((h) =>
      new RegExp("Uso:\\s*/" + escaped + "(?:\\s|$)", "i").test(h),
    );
    if (hint) {
      usage = plain(hint.slice(hint.toLowerCase().indexOf("uso:") + 4))
        .replace(/["}]+$/, "")
        .trim();
    }
    if (!description)
      description = comments
        .join(" ")
        .replace(/[-=]{3,}/g, "")
        .trim();
    if (!description) {
      const action = actions.find((h) =>
        /^(?:me|msg|sw_action|sw_msg)\s/i.test(h),
      );
      if (action) {
        const text = plain(
          action.replace(/^(?:me|msg|sw_action|sw_msg)\s+/i, ""),
        )
          .replace(/^"|"$/g, "")
          .replace(/\$\d+-?|%[\w.]+/g, "…")
          .trim();
        description =
          "Envía un mensaje o acción. Ejemplo: " + text.slice(0, 180);
      } else if (actions.some((h) => /^view(?:\s|$)/i.test(h)))
        description = "Abre o actualiza un panel del script.";
      else if (actions.some((h) => /^state\./i.test(h)))
        description = "Actualiza y guarda opciones del script.";
      else
        description = internal
          ? "Función interna de apoyo del script."
          : "Alias definido en este script; su comportamiento puede consultarse en el editor.";
    }
    out.push({
      name,
      usage: usage.slice(0, 240),
      description: description.slice(0, 600),
      internal,
    });
  }
  return out.sort(
    (a, b) =>
      Number(a.internal) - Number(b.internal) || a.name.localeCompare(b.name),
  );
}
module.exports = { catalog };
