"use strict";
const $ = (id) => document.getElementById(id);
let selected = null,
  next = 0,
  request = 0;
async function call(name, data = {}) {
  const r = await window.historyApi.call(name, data);
  if (r?.error) throw Error(r.error);
  return r;
}
function fail(e) {
  $("feedback").textContent = e.message;
}
function label(id) {
  return id.replace(/--[a-f0-9]{16}(?=\.txt|\/|$)/g, "").replace(/\.txt$/, "");
}
async function open(id, append = false, offset = 0) {
  const token = ++request;
  try {
    const r = await call("logs.text.read", {
      id,
      offset: append ? next : offset,
    });
    if (token !== request) return;
    selected = id;
    next = r.next;
    $("title").textContent = label(id);
    if (append) $("content").append(document.createTextNode(r.text));
    else $("content").textContent = r.text;
    $("more").hidden = next >= r.size;
    $("feedback").textContent = `${next} / ${r.size} bytes`;
    for (const b of $("tree").querySelectorAll("button"))
      b.setAttribute("aria-current", String(b.dataset.id === id));
  } catch (e) {
    fail(e);
  }
}
async function refresh() {
  try {
    const rows = await call("logs.text.list");
    $("tree").replaceChildren();
    const groups = new Map();
    for (const item of rows) {
      const parts = item.id.split("/");
      let parent = $("tree"),
        key = "";
      for (const part of parts.slice(0, -1)) {
        key += "/" + part;
        if (!groups.has(key)) {
          const details = document.createElement("details"),
            summary = document.createElement("summary");
          details.open = true;
          summary.textContent =
            parent === $("tree")
              ? item.networkLabel || label(part)
              : label(part);
          details.append(summary);
          parent.append(details);
          groups.set(key, details);
        }
        parent = groups.get(key);
      }
      const b = document.createElement("button");
      b.textContent = label(parts.at(-1));
      b.dataset.id = item.id;
      b.onclick = () => open(item.id);
      parent.append(b);
    }
    $("feedback").textContent = rows.length + " archivos";
  } catch (e) {
    fail(e);
  }
}
$("refresh").onclick = refresh;
$("more").onclick = () => open(selected, true);
$("search").onsubmit = async (e) => {
  e.preventDefault();
  try {
    if (!$("all").checked && !selected)
      throw Error("Selecciona un archivo o busca en todos los logs.");
    $("feedback").textContent = "Buscando…";
    const rows = await call("logs.text.search", {
      text: $("word").value,
      id: $("all").checked ? undefined : selected,
    });
    $("results").replaceChildren();
    for (const row of rows) {
      const b = document.createElement("button");
      b.textContent = label(row.id) + " · línea " + row.line + "\n" + row.text;
      b.onclick = () => open(row.id, false, row.offset || 0);
      $("results").append(b);
    }
    $("feedback").textContent = rows.length + " resultados (máximo 1000)";
  } catch (e) {
    fail(e);
  }
};
refresh();
