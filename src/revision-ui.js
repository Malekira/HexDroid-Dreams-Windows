"use strict";
(() => {
  const call = async (name, data = {}) => {
    if (!api.advanced)
      throw Error("Función disponible en la aplicación de escritorio.");
    const r = await api.advanced(name, data);
    if (r?.error) throw Error(r.error);
    return r;
  };
  const run = (fn) =>
    Promise.resolve()
      .then(fn)
      .catch((e) => notify(e.message, true));
  window.openDreamsHistory = () => call("history.window");
  // Capture before the native details toggle, including dynamically created menus.
  document.addEventListener(
    "click",
    (e) => {
      const summary = e.target.closest(".menu > summary");
      if (summary) {
        const current = summary.parentElement;
        for (const menu of document.querySelectorAll(".menu[open]"))
          if (menu !== current) menu.open = false;
      } else if (!e.target.closest(".menu"))
        for (const menu of document.querySelectorAll(".menu[open]"))
          menu.open = false;
    },
    true,
  );
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape")
      for (const menu of document.querySelectorAll(".menu[open]"))
        menu.open = false;
  });
  const menu = el("details", "menu"),
    summary = el("summary", "", "Salas"),
    popup = el("div", "menu-popup");
  menu.id = "rooms-menu";
  menu.append(summary, popup);
  const nav = document.querySelector(".menubar nav"),
    red = [...nav.children].find(
      (n) => n.querySelector("summary")?.textContent === "Red",
    );
  red.after(menu);
  function action(label, fn, parent = popup) {
    const b = el("button", "", label);
    b.type = "button";
    b.onclick = () =>
      run(async () => {
        menu.open = false;
        await fn();
      });
    parent.append(b);
    return b;
  }
  function fill() {
    popup.replaceChildren();
    action("Unirse a sala", () =>
      document.querySelector("[data-action=join]").click(),
    );
    action("Agregar sala actual a favoritas", async () => {
      const c = selected();
      if (c?.kind !== "channel") throw Error("Selecciona una sala.");
      config.settings.favoriteRooms ||= [];
      if (
        !config.settings.favoriteRooms.some(
          (r) => r.network === active.id && fold(r.name) === fold(c.name),
        )
      )
        config.settings.favoriteRooms.push({
          network: active.id,
          name: c.name,
        });
      await persist();
      fill();
    });
    action("Abrir historial", window.openDreamsHistory);
    popup.append(el("hr"));
    for (const item of [...(config.settings.favoriteRooms || [])].sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      if (!profile(item.network)) continue;
      const row = el("div", "favorite-room");
      action(
        item.name + " · " + profile(item.network).name,
        () =>
          api.send({
            id: item.network,
            target: "*",
            text: "/join " + item.name,
          }),
        row,
      );
      action(
        "Quitar " + item.name,
        async () => {
          config.settings.favoriteRooms = config.settings.favoriteRooms.filter(
            (r) => r !== item,
          );
          await persist();
          fill();
        },
        row,
      );
      popup.append(row);
    }
  }
  menu.addEventListener("toggle", () => {
    if (menu.open) fill();
  });
  fill();
})();
(() => {
  const d = el("dialog", "feature-dialog theme-editor");
  d.id = "theme-editor-dialog";
  const header = el("header", "dialog-header"),
    body = el("div", "form-content"),
    preview = el("div", "theme-live-preview");
  header.append(el("h2", "", "Editar tema"));
  const close = el("button", "secondary", "Cancelar");
  close.onclick = () => d.close();
  header.append(close);
  d.append(header, body);
  document.body.append(d);
  window.openDreamsThemeEditor = () => {
    body.replaceChildren();
    let draft = DreamsThemes.snapshot(config.settings);
    draft.customColors = { ...draft.customColors };
    draft.roomAppearance = {
      background: getComputedStyle($("messages")).backgroundColor,
      inputBackground: getComputedStyle($("message-input")).backgroundColor,
      text: getComputedStyle($("messages")).color,
      ...draft.roomAppearance,
    };
    for (const key of ["background", "inputBackground", "text"]) {
      const match = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(
        draft.roomAppearance[key],
      );
      if (match)
        draft.roomAppearance[key] =
          "#" +
          match
            .slice(1)
            .map((v) => Number(v).toString(16).padStart(2, "0"))
            .join("");
    }
    const name = el("input");
    name.placeholder = "Nombre del tema";
    name.setAttribute("aria-label", "Nombre del nuevo tema");
    name.maxLength = 80;
    body.append(name, preview);
    const grid = el("div", "theme-editor-grid");
    body.append(grid);
    function draw() {
      preview.replaceChildren();
      const environment = el(
        "div",
        "theme-preview-environment",
        "HexDreams IRC · Salas · Privados",
      );
      environment.style.background =
        draft.customColors.sidebar ||
        getComputedStyle(document.documentElement).getPropertyValue(
          "--sidebar",
        );
      environment.style.color =
        draft.customColors.text ||
        getComputedStyle(document.documentElement).getPropertyValue("--text");
      environment.style.borderColor = draft.customColors.border || "#46416f";
      preview.append(environment);
      preview.style.background =
        draft.roomAppearance.background ||
        getComputedStyle($("messages")).backgroundColor;
      preview.style.color =
        draft.roomAppearance.text || getComputedStyle($("messages")).color;
      preview.style.fontSize = (draft.fontSize || 14) + "px";
      preview.style.fontWeight = (draft.roomAppearance.style || "").includes(
        "bold",
      )
        ? "700"
        : "400";
      preview.style.fontStyle = (draft.roomAppearance.style || "").includes(
        "italic",
      )
        ? "italic"
        : "normal";
      preview.style.fontFamily =
        (draft.fontFamily || "Segoe UI") + ', "Segoe UI Emoji", sans-serif';
      for (const [nick, text, hue] of [
        ["Luna", "Hola, esta es la vista previa 💋", 285],
        ["Atlas", "Así se verán las conversaciones.", 210],
      ]) {
        const row = el("p"),
          n = el("strong", "", "[12:34] {" + nick + "} ");
        n.style.color = `hsl(${hue} ${draft.nickPalette === "pastel" ? 48 : 78}% ${DreamsFormatting.luminance(preview.style.background) > 0.4 ? (draft.nickPalette === "pastel" ? 36 : 28) : draft.nickPalette === "pastel" ? 78 : 68}%)`;
        row.append(n, document.createTextNode(text));
        preview.append(row);
      }
      const input = el("div", "preview-input", "Escribe un mensaje…");
      input.style.background =
        draft.roomAppearance.inputBackground || "#141932";
      preview.append(input);
    }
    function field(label, type, value, change, options) {
      const l = el("label", "feature-field", label),
        i = el(type === "select" ? "select" : "input");
      i.setAttribute("aria-label", label);
      if (type === "select")
        for (const [v, t] of options) {
          const o = el("option", "", t);
          o.value = v;
          i.append(o);
        }
      else i.type = type;
      i.value = value;
      i.oninput = () => {
        change(type === "number" ? Number(i.value) : i.value);
        draw();
      };
      l.append(i);
      grid.append(l);
      return i;
    }
    for (const [key, label] of Object.entries({
      bg: "Fondo general",
      sidebar: "Paneles",
      surface: "Ventanas",
      raised: "Superficies destacadas",
      border: "Bordes",
      text: "Texto del entorno",
      muted: "Texto secundario",
      accent: "Selección",
    }))
      field(
        label,
        "color",
        draft.customColors[key] ||
          getComputedStyle(document.documentElement)
            .getPropertyValue("--" + key)
            .trim(),
        (v) => (draft.customColors[key] = v),
      );
    for (const [key, label] of Object.entries({
      background: "Fondo de sala",
      inputBackground: "Fondo del cuadro de texto",
      text: "Color del texto de sala",
    }))
      field(
        label,
        "color",
        draft.roomAppearance[key] ||
          {
            background: "#ffffff",
            inputBackground: "#f7f4ff",
            text: "#211630",
          }[key],
        (v) => (draft.roomAppearance[key] = v),
      );
    field(
      "Fuente",
      "select",
      draft.fontFamily || "Segoe UI",
      (v) => (draft.fontFamily = v),
      ["Segoe UI", "Consolas", "Arial", "Cascadia Mono"].map((v) => [v, v]),
    );
    const size = field(
      "Tamaño",
      "number",
      draft.fontSize || 14,
      (v) => (draft.fontSize = v),
    );
    size.min = 11;
    size.max = 24;
    field(
      "Estilo",
      "select",
      draft.roomAppearance.style || "normal",
      (v) => (draft.roomAppearance.style = v),
      [
        ["normal", "Normal"],
        ["bold", "Negrita"],
        ["italic", "Cursiva"],
        ["bold italic", "Negrita y cursiva"],
      ],
    );
    field(
      "Color del propio nick",
      "color",
      draft.ownNickColor || "#6c209e",
      (v) => (draft.ownNickColor = v),
    );
    field(
      "Colores de nicks",
      "select",
      draft.nickPalette || "strong",
      (v) => (draft.nickPalette = v),
      [
        ["strong", "Fuertes"],
        ["pastel", "Pastel"],
      ],
    );
    const save = el("button", "primary", "Guardar tema");
    save.onclick = async () => {
      try {
        const label = name.value.trim();
        if (!label) throw Error("Escribe el nombre del tema.");
        const themes = [...(config.settings.savedThemes || [])],
          old = themes.find(
            (t) => t.name.toLocaleLowerCase() === label.toLocaleLowerCase(),
          );
        const item = {
          id: old?.id || crypto.randomUUID(),
          name: label,
          settings: DreamsThemes.snapshot(draft),
        };
        if (old) themes[themes.indexOf(old)] = item;
        else {
          if (themes.length >= 40)
            throw Error("Puedes guardar hasta 40 temas.");
          themes.push(item);
        }
        Object.assign(config.settings, draft, { savedThemes: themes });
        await persist();
        applySettings();
        lastMessageView = "";
        render();
        d.close();
        window.dispatchEvent(
          new CustomEvent("dreams-themes-changed", { detail: item.id }),
        );
        notify("Tema guardado: " + label);
      } catch (e) {
        notify(e.message, true);
      }
    };
    body.append(save);
    draw();
    d.showModal();
  };
  const panel = document.querySelector("[data-panel=appearance]"),
    label = el("label", "setting-row", "Colores de los nicks"),
    select = el("select");
  select.setAttribute("aria-label", "Colores de los nicks");
  for (const [value, text] of [
    ["strong", "Fuertes"],
    ["pastel", "Pastel"],
  ]) {
    const o = el("option", "", text);
    o.value = value;
    select.append(o);
  }
  select.value = config.settings.nickPalette || "strong";
  select.onchange = async () => {
    config.settings.nickPalette = select.value;
    lastMessageView = "";
    render();
    await persist();
  };
  label.append(select);
  panel.append(label);
})();
(() => {
  const dialog = el("dialog", "feature-dialog");
  dialog.id = "selective-backup-dialog";
  document.body.append(dialog);
  window.openDreamsBackup = (mode) => {
    dialog.replaceChildren();
    const header = el("header", "dialog-header");
    header.append(
      el(
        "h2",
        "",
        mode === "export" ? "Exportar configuración" : "Importar configuración",
      ),
    );
    const cancel = el("button", "secondary", "Cancelar");
    cancel.onclick = () => dialog.close();
    header.append(cancel);
    const body = el("div", "form-content");
    dialog.append(header, body);
    const fields = {};
    for (const [key, text] of Object.entries({
      networks: "Redes e identidades",
      appearance: "Apariencia y temas",
      notifications: "Notificaciones",
      multimedia: "Multimedia",
      history: "Preferencias del historial",
      preferences: "Otras preferencias",
    })) {
      const label = el("label", "setting-row", text),
        input = el("input");
      input.type = "checkbox";
      input.checked = true;
      input.setAttribute("aria-label", text);
      label.append(input);
      body.append(label);
      fields[key] = input;
    }
    const history = el("input");
    history.type = "checkbox";
    const hl = el(
      "label",
      "setting-row",
      "Incluir historial de conversaciones de la aplicación",
    );
    hl.append(history);
    body.append(hl);
    const secrets = el("input");
    secrets.type = "checkbox";
    const sl = el(
      "label",
      "setting-row",
      "Incluir credenciales y claves cifradas",
    );
    sl.append(secrets);
    if (mode === "export") body.append(sl);
    const pass = el("input");
    pass.type = "password";
    pass.placeholder = "Frase de paso del respaldo";
    pass.setAttribute("aria-label", "Frase de paso del respaldo");
    body.append(pass);
    body.append(
      el(
        "p",
        "note",
        "Los archivos TXT se conservan en su carpeta. Las redes existentes no incluidas se conservan; las que tengan el mismo identificador se actualizan.",
      ),
    );
    const feedback = el("p", "form-error"),
      submit = el(
        "button",
        "primary",
        mode === "export" ? "Exportar" : "Importar",
      );
    submit.onclick = async () => {
      submit.disabled = true;
      try {
        const sections = Object.keys(fields).filter(
          (key) => fields[key].checked,
        );
        if (!sections.length) throw Error("Selecciona al menos un apartado.");
        const r = await api.advanced("backup." + mode, {
          sections,
          includeHistory: history.checked,
          includeSecrets: secrets.checked,
          password: pass.value,
        });
        if (r?.error) throw Error(r.error);
        if (r.reload) location.reload();
        if (r.ok) dialog.close();
      } catch (e) {
        feedback.textContent = e.message;
      } finally {
        submit.disabled = false;
      }
    };
    body.append(feedback, submit);
    dialog.showModal();
  };
})();
