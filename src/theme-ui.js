"use strict";
(() => {
  function applyVisualTheme() {
    const root = document.documentElement,
      s = config.settings;
    if (["violet", "purple-light"].includes(s.theme)) {
      root.dataset.theme = s.theme;
      for (const [key, value] of Object.entries(
        DreamsThemes.violet.customColors,
      ))
        root.style.setProperty("--" + key, s.customColors?.[key] || value);
    } else if (!api.advanced) {
      root.dataset.theme = s.theme || "dark";
      for (const key of Object.keys(DreamsThemes.violet.customColors)) {
        root.style.removeProperty("--" + key);
        if (s.customColors?.[key])
          root.style.setProperty("--" + key, s.customColors[key]);
      }
    }
  }
  const baseApply = applySettings;
  applySettings = function () {
    applyVisualTheme();
    baseApply();
    applyVisualTheme();
  };
  window.renderDreamsThemeManager = (parent) => {
    const group = el("section", "theme-manager"),
      heading = el("h3", "", "Tema"),
      select = el("select"),
      name = el("input");
    select.setAttribute("aria-label", "Tema");
    name.setAttribute("aria-label", "Nombre del tema");
    name.maxLength = 80;
    name.placeholder = "Nombre para guardar este estilo";
    const row = el("div", "theme-manager-controls"),
      actions = el("div", "theme-manager-actions");
    function fill() {
      select.replaceChildren();
      for (const [value, label] of [
        ["violet", "Morado y azul marino"],
        ["purple-light", "PurpleDreamsLight"],
        ["dark", "Oscuro"],
        ["light", "Claro"],
        ["system", "Sistema"],
        ["matrix", "Matrix"],
        ...(config.settings.savedThemes || []).map((t) => [t.id, t.name]),
      ]) {
        const o = el("option", "", label);
        o.value = value;
        select.append(o);
      }
    }
    const add = (label, fn) => {
      const b = el("button", "secondary", label);
      b.type = "button";
      b.onclick = () =>
        Promise.resolve()
          .then(fn)
          .catch((e) => notify(e.message, true));
      actions.append(b);
      return b;
    };
    async function save() {
      await persist();
      applySettings();
      render();
    }
    add("Aplicar", async () => {
      const id = select.value,
        t = (config.settings.savedThemes || []).find((t) => t.id === id);
      const style =
        t?.settings ||
        (id === "purple-light"
          ? DreamsThemes.purpleLight
          : id === "violet"
            ? DreamsThemes.violet
            : { theme: id, customColors: {}, roomAppearance: {} });
      Object.assign(config.settings, structuredClone(style));
      config.settings.currentThemeId = id;
      await save();
    });
    add("Agregar…", () => window.openDreamsThemeEditor());
    add("Guardar", async () => {
      const label = name.value.trim();
      if (!label) throw new Error("Escribe un nombre para tu tema.");
      const themes = [...(config.settings.savedThemes || [])],
        old = themes.find(
          (t) => t.name.toLocaleLowerCase() === label.toLocaleLowerCase(),
        ),
        id = old?.id || crypto.randomUUID();
      const t = {
        id,
        name: label,
        settings: DreamsThemes.snapshot(config.settings),
      };
      if (old) themes[themes.indexOf(old)] = t;
      else {
        if (themes.length >= 40)
          throw new Error("Puedes guardar hasta 40 temas.");
        themes.push(t);
      }
      config.settings.savedThemes = themes;
      config.settings.currentThemeId = id;
      await save();
      fill();
      select.value = id;
      selection();
      notify("Tema guardado: " + label);
    });
    const remove = add("Eliminar", async () => {
      const id = select.value;
      if (!(config.settings.savedThemes || []).some((t) => t.id === id))
        throw new Error("Solo se eliminan temas personalizados.");
      if (config.settings.currentThemeId === id)
        config.settings.currentThemeId = config.settings.theme;
      config.settings.savedThemes = config.settings.savedThemes.filter(
        (t) => t.id !== id,
      );
      await save();
      fill();
      selection();
    });
    function selection() {
      const saved = (config.settings.savedThemes || []).find(
        (t) => t.id === select.value,
      );
      name.value = saved?.name || "";
      remove.disabled = !saved;
      remove.title = saved
        ? "Eliminar este tema"
        : "Los temas incluidos no se eliminan.";
    }
    select.onchange = selection;
    window.addEventListener("dreams-themes-changed", (event) => {
      if (group.isConnected) {
        fill();
        if (event.detail) select.value = event.detail;
        selection();
      }
    });
    fill();
    select.value =
      config.settings.currentThemeId || config.settings.theme || "dark";
    selection();
    row.append(select, name);
    group.append(heading, row, actions);
    parent.append(group);
  };
  window.renderDreamsThemeManager(
    document.querySelector("[data-panel=appearance]"),
  );
  const editor = $("profile-realName"),
    counter = el("p", "note identity-length");
  counter.id = "identity-length";
  editor.parentElement.append(counter);
  function count() {
    const value = editor.value || "",
      user = $("profile-username").value || $("profile-nick").value || "",
      bytes = new TextEncoder().encode(value).length,
      budget = 510 - new TextEncoder().encode("USER " + user + " 0 * :").length,
      limit = $("profile-id").value
        ? network($("profile-id").value).realNameLimit
        : null;
    counter.textContent =
      DreamsFormatting.plain(value).length +
      " caracteres visibles · " +
      bytes +
      " bytes UTF-8 con formato · espacio IRC " +
      budget +
      " bytes" +
      (limit ? " · límite anunciado por la red: " + limit : "");
    counter.classList.toggle("form-error", bytes > budget);
  }
  for (const node of [editor, $("profile-username"), $("profile-nick")])
    node.addEventListener("input", count);
  $("network-dialog").addEventListener("toggle", count);
  applySettings();
})();
