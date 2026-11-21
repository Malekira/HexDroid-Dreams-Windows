"use strict";
(() => {
  const panel = (key) => document.querySelector('[data-panel="' + key + '"]'),
    nav = document.querySelector(".settings-nav"),
    appearance = panel("appearance"),
    layout = panel("layout");
  const run = (fn) =>
    Promise.resolve()
      .then(fn)
      .catch((e) => notify(e.message, true));
  const save = async () => {
    await persist();
    applySettings();
    render();
  };
  // Reuse the original controls and their persistence handlers instead of keeping
  // parallel copies in multiple sections of the configuration window.
  const groups = [...nav.querySelectorAll(".settings-group")];
  if (!groups.length) {
    const existing = [...nav.children];
    for (const title of ["Redes e identidad", "Apariencia", "Herramientas"]) {
      const d = el("details", "settings-group"),
        children = el("div", "settings-children");
      d.open = true;
      d.append(el("summary", "", title), children);
      nav.append(d);
      groups.push(d);
    }
    for (const b of existing)
      groups[
        b.dataset.section === "networks"
          ? 0
          : b.dataset.section === "diagnostics"
            ? 2
            : 1
      ].lastElementChild.append(b);
  }
  groups.forEach(
    (g, i) =>
      (g.querySelector("summary").textContent = [
        "Redes e identidad",
        "Apariencia",
        "Herramientas",
      ][i]),
  );
  const labels = {
    appearance: "Colores del entorno",
    chat: "Chat",
    layout: "Paneles",
    diagnostics: "Diagnóstico",
  };
  for (const [key, label] of Object.entries(labels)) {
    nav.querySelector('[data-section="' + key + '"]').textContent = label;
    panel(key).querySelector("h3").textContent = label;
  }
  nav.querySelector("[data-advanced-section=palette]")?.remove();
  const look = groups[1].lastElementChild,
    tools = groups[2].lastElementChild;
  for (const key of ["appearance", "chat", "layout"])
    look.append(nav.querySelector('[data-section="' + key + '"]'));
  for (const key of ["notifications", "media"]) {
    const b = nav.querySelector('[data-advanced-section="' + key + '"]');
    if (b) look.append(b);
  }
  for (const key of ["diagnostics", "history", "scripts", "dcc", "backup"]) {
    const b = nav.querySelector(
      '[data-section="' + key + '"],[data-advanced-section="' + key + '"]',
    );
    if (b) tools.append(b);
  }
  appearance.querySelector("p.muted")?.remove();
  $("setting-ownNickColor").closest("label").hidden = true;
  const manager = appearance.querySelector(".theme-manager");
  if (manager) appearance.querySelector("h3").after(manager);
  const paletteRow = el("label", "setting-row", "Colores de nicks"),
    palette = el("select");
  palette.setAttribute("aria-label", "Colores de nicks");
  for (const [v, t] of [
    ["strong", "Fuertes"],
    ["pastel", "Pastel"],
  ]) {
    const o = el("option", "", t);
    o.value = v;
    palette.append(o);
  }
  paletteRow.append(palette);
  appearance.append(paletteRow);
  palette.onchange = () =>
    run(async () => {
      config.settings.nickPalette = palette.value;
      await save();
    });
  const colors = el("div", "environment-colors-grid"),
    fields = {};
  for (const [key, label] of Object.entries({
    bg: "Fondo de conversación",
    sidebar: "Fondo de paneles",
    surface: "Ventanas y controles",
    raised: "Superficies destacadas",
    border: "Bordes",
    text: "Texto normal",
    muted: "Texto secundario",
    accent: "Color de selección",
  })) {
    const row = el("label", "setting-row", label),
      i = el("input");
    i.type = "color";
    i.setAttribute("aria-label", label);
    row.append(i);
    colors.append(row);
    fields[key] = i;
  }
  appearance.append(colors);
  const actions = el("div", "settings-actions");
  for (const [label, fn] of [
    [
      "Guardar colores del entorno",
      async () => {
        config.settings.customColors = Object.fromEntries(
          Object.entries(fields).map(([k, i]) => [k, i.value]),
        );
        await save();
      },
    ],
    [
      "Restaurar colores del tema",
      async () => {
        config.settings.customColors = {};
        await save();
      },
    ],
  ]) {
    const b = el("button", "secondary", label);
    b.type = "button";
    b.onclick = () => run(fn);
    actions.append(b);
  }
  appearance.append(actions);
  if (api.advanced)
    for (const label of panel("chat").querySelectorAll("label"))
      if (label.textContent.includes("mencion")) label.remove();
  const clones = panel("chat")
    .querySelector('[aria-label="Mostrar posibles clones"]')
    ?.closest("label");
  if (clones) layout.append(clones);
  const events = panel("chat")
    .querySelector('[aria-label="Vista de eventos de sala"]')
    ?.closest("label");
  if (events) layout.append(events);
  for (const id of [
    "setting-sidebar",
    "setting-usersWidth",
    "setting-showPrivates",
    "setting-showUsers",
    "setting-showEvents",
    "setting-eventShowHost",
    "setting-autoScroll",
  ])
    layout.append($(id).closest("label"));
  if (events) layout.append(events);
  layout.append($("setting-showTopic").closest("label"));
  panel("diagnostics").querySelectorAll("p")[1].textContent =
    "Las redes y preferencias se guardan en el perfil de Windows. El historial TXT y el historial de búsqueda se configuran en Historial; las credenciales guardadas utilizan el almacén seguro.";
  for (const id of ["profile-textColor", "profile-textStyle"])
    $(id).addEventListener(
      "input",
      () => ($("profile-customText").checked = true),
    );
  function sync() {
    palette.value = config.settings.nickPalette || "strong";
    for (const [k, i] of Object.entries(fields)) {
      const color =
        config.settings.customColors?.[k] ||
        getComputedStyle(document.documentElement)
          .getPropertyValue("--" + k)
          .trim();
      i.value = hex(color);
    }
  }
  function hex(color) {
    if (/^#[a-f0-9]{6}$/i.test(color)) return color;
    if (/^#[a-f0-9]{3}$/i.test(color))
      return "#" + [...color.slice(1)].map((c) => c + c).join("");
    const m = /rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\)/.exec(color);
    return m
      ? "#" +
          m
            .slice(1)
            .map((n) => Number(n).toString(16).padStart(2, "0"))
            .join("")
      : "#000000";
  }
  const baseApply = applySettings;
  applySettings = function (...args) {
    const r = baseApply(...args);
    sync();
    return r;
  };
  // A network can use a different mention colour while retaining the common default.
  window.addEventListener('dreams-settings-rendered',()=>{const h=document.querySelector('.advanced-content')?.firstElementChild;if(h?.matches('p.note'))h.replaceWith(el('h3','',h.textContent));});

  sync();
})();
