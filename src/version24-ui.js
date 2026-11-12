"use strict";
(() => {
  const run = (fn) =>
    Promise.resolve()
      .then(fn)
      .catch((e) => notify(e.message, true));
  const save = async () => {
    await persist();
    applySettings();
    render(true);
  };
  const button = (parent, label, fn) => {
    const b = el("button", "secondary", label);
    b.type = "button";
    b.onclick = () => run(fn);
    parent.append(b);
    return b;
  };
  const field = (parent, label, type, value) => {
    const row = el("label", "setting-row", label),
      i = el(type === "select" ? "select" : "input");
    if (type !== "select") i.type = type;
    i.setAttribute("aria-label", label);
    if (type === "checkbox") i.checked = value !== false;
    else i.value = value ?? "";
    row.append(i);
    parent.append(row);
    return i;
  };
  function dialog(title, id) {
    const d = el("dialog", "utility-dialog"),
      h = el("header", "dialog-header"),
      body = el("div", "form-content");
    if (id) d.id = id;
    h.append(el("h2", "", title));
    button(h, "Cerrar", () => d.close());
    d.append(h, body);
    document.body.append(d);
    d.addEventListener("close", () => d.remove());
    d.showModal();
    return { d, body };
  }
  const menus = () => [
    ...document.querySelectorAll(".menubar nav > details.menu"),
  ];
  function menu(title) {
    let m = menus().find(
      (m) => m.querySelector("summary")?.textContent.trim() === title,
    );
    if (!m) {
      m = el("details", "menu");
      m.append(el("summary", "", title), el("div", "menu-popup"));
      document.querySelector(".menubar nav").append(m);
      m.addEventListener("toggle", () => {
        if (m.open)
          for (const other of menus()) if (other !== m) other.open = false;
      });
      m.addEventListener("click", (e) => {
        if (e.target.closest("button")) m.open = false;
      });
    }
    return m;
  }
  const chat = menu("Chat"),
    rooms = menu("Salas"),
    commands = menu("Comandos");
  commands.after(rooms);
  for (const b of [...document.querySelectorAll(".menubar [data-action=join]")])
    rooms.lastElementChild.append(b);
  const favorites = $("favorites-menu");
  if (favorites) rooms.lastElementChild.append(favorites);
  const roomList = document.querySelector("#room-list-button");
  if (roomList)
    button(rooms.lastElementChild, "Listar salas", () => roomList.click());
  const windows = menu("Ventanas"),
    oldWindows = document.querySelector(".mdi-layout-menu");
  if (oldWindows) {
    for (const b of oldWindows.querySelectorAll("button"))
      windows.lastElementChild.append(b);
    oldWindows.remove();
  }
  windows.classList.add("mdi-layout-menu");
  windows.id = "windows-menu";
  rooms.after(chat);
  const help = menu("Ayuda");
  help.before(windows);
  document.addEventListener("pointerdown", (e) => {
    const root = e.target.closest(".menubar nav>.menu");
    if (root) for (const m of menus()) if (m !== root) m.open = false;
  });
  rooms.addEventListener("toggle", () => {
    if (!rooms.open && favorites) favorites.open = false;
  });
  window.openDreamsStatusSettings = () => {
    const { body } = dialog(
      "Configuración de Status",
      "status-settings-dialog",
    );
    const fields = {};
    for (const [key, g] of Object.entries(DreamsStatus.groups)) {
      const section = el("details", "status-filter-group");
      section.open = true;
      fields[key] = field(
        section,
        g.label,
        "checkbox",
        config.settings.statusFilters?.[key],
      );
      for (const [k, label] of Object.entries(g.items))
        if (k !== key)
          fields[k] = field(
            section,
            label,
            "checkbox",
            config.settings.statusFilters?.[k],
          );
      body.append(section);
    }
    button(body, "Guardar filtros", async () => {
      config.settings.statusFilters = Object.fromEntries(
        Object.entries(fields).map(([k, i]) => [k, i.checked]),
      );
      await save();
      notify("Filtros de Status guardados.");
    });
  };
  button(
    chat.lastElementChild,
    "Configuración de Status",
    window.openDreamsStatusSettings,
  );
  const chatPanel = document.querySelector("[data-panel=chat]");
  button(chatPanel, "Configuración de Status", window.openDreamsStatusSettings);
  const appearance = document.querySelector("[data-panel=appearance]");
  for (const id of ["setting-lineHeight", "setting-messageSpacing"]) {
    const row = $(id)?.closest("label");
    if (row) appearance.append(row);
  }
  const spacing = document.querySelector(".chat-spacing-preview");
  if (spacing) appearance.append(spacing);
  const style = $("room-appearance-button"),
    roomMode = document.querySelector(".room-view-choice");
  const baseRender = render;
  render = function (...args) {
    const result = baseRender(...args);
    for (const w of document.querySelectorAll(".mdi-window")) {
      const user = w.querySelector(".mdi-users-button");
      if (!user) continue;
      if (
        w.dataset.network === active?.id &&
        fold(w.dataset.target) === fold(active?.target || "")
      ) {
        if (style) user.after(style);
        if (roomMode) {
          roomMode.hidden = selected()?.kind !== "channel";
          user.after(roomMode);
        }
        w.querySelector(".v24-inactive-tools")?.remove();
      } else if (!w.querySelector(".v24-inactive-tools")) {
        const tools = el("span", "v24-inactive-tools"),
          b = button(tools, "Estilo", () => {
            choose(w.dataset.network, w.dataset.target);
            style?.click();
          });
        b.setAttribute("aria-label", "Apariencia de " + w.dataset.target);
        if (roomMode) {
          const select = roomMode.cloneNode(true);
          select.setAttribute(
            "aria-label",
            "Vista de sala de " + w.dataset.target,
          );
          select.title = "Vista de " + w.dataset.target;
          select.hidden = !/^[#&+!]/.test(w.dataset.target);
          select.onchange = () => {
            roomMode.value = select.value;
            roomMode.dispatchEvent(new Event("change"));
          };
          tools.prepend(select);
        }
        user.after(tools);
      }
    }
    for (const select of document.querySelectorAll(
      ".v24-inactive-tools select",
    ))
      select.value = config.settings.roomView || "unified";
    return result;
  };
  $("first-unread").hidden = true;
  document.querySelector(".message-toolbar [data-action=latest]").hidden = true;
  const search = $("user-search"),
    label = search.closest("label"),
    heading = document.querySelector(".users-heading");
  label.hidden = true;
  heading.firstElementChild.textContent = "Usuarios ·";
  const magnify = button(heading, "⌕", () => {
    const c = selected();
    if (!c) return;
    c.userSearchOpen = !c.userSearchOpen;
    label.hidden = !c.userSearchOpen;
    if (c.userSearchOpen) search.focus();
    else {
      c.userQuery = "";
      search.value = "";
      renderUsers();
    }
  });
  magnify.className = "user-search-toggle";
  magnify.setAttribute("aria-label", "Buscar en usuarios");
  search.addEventListener("input", () => {
    if (selected()) selected().userQuery = search.value;
  });
  $("user-list").addEventListener("scroll", () => {
    if (selected()) selected().userScroll = $("user-list").scrollTop;
  });
  const oldUsers = renderUsers;
  renderUsers = function (...args) {
    const c = selected();
    label.hidden = !c?.userSearchOpen;
    search.value = c?.userQuery || "";
    const r = oldUsers(...args);
    $("user-list").scrollTop = c?.userScroll || 0;
    return r;
  };
  const oldApply = applySettings;
  applySettings = function (...args) {
    const r = oldApply(...args),
      a = config.settings.roomAppearance || {},
      input = $("message-input");
    document.body.classList.toggle(
      "nick-regular",
      config.settings.nickBold === false,
    );
    if (a.inputText)
      input.style.color = DreamsFormatting.readableColor(
        a.inputText,
        getComputedStyle(input).backgroundColor,
      );
    return r;
  };
  window.openDreamsMessageFormat = () => openSettings('chat');
  button(chat.lastElementChild, "NOTICE · color y prefijo", () =>
    window.openDreamsMessageFormat("notice"),
  );
  button(chat.lastElementChild, "/me · color y prefijo", () =>
    window.openDreamsMessageFormat("action"),
  );
  button(chatPanel, "NOTICE · color y prefijo", () =>
    window.openDreamsMessageFormat("notice"),
  );
  button(chatPanel, "/me · color y prefijo", () =>
    window.openDreamsMessageFormat("action"),
  );
  button(appearance, "Apariencia de sala", () => style?.click());
  // Theme files use the validated appearance snapshot, never executable content.
  window.openDreamsThemes = () => {
    const { body } = dialog("Temas", "themes-dialog");
    window.renderDreamsThemeManager(body,{preview:false});
    const manager = body.querySelector(".theme-manager"),
      select = manager.querySelector("select"),
      preview = el("div", "theme-file-preview"),
      before = DreamsThemes.snapshot(config.settings),
      beforeId = config.settings.currentThemeId;
    preview.setAttribute("aria-label", "Vista previa del tema");
    body.append(preview);
    function draw() {
      const t =
        config.settings.savedThemes?.find((t) => t.id === select.value)
          ?.settings ||
        (select.value === "violet"
          ? DreamsThemes.violet
          : select.value === "purple-light"
            ? DreamsThemes.purpleLight
            : { customColors: {}, roomAppearance: {} });
      preview.textContent =
        "HexDreams IRC · Sala\nNora: Vista previa de mensajes\nTuNick: ¡Hola!";
      preview.style.background =
        t.roomAppearance?.background ||
        t.customColors?.bg ||
        (select.value === "light" ? "#ffffff" : "#101526");
      preview.style.color =
        t.roomAppearance?.text ||
        t.customColors?.text ||
        (select.value === "light" ? "#222222" : "#eeeeff");
      preview.style.fontFamily = t.fontFamily || "Segoe UI";
      preview.style.fontSize = (t.fontSize || 14) + "px";
    }
    select.addEventListener("change", draw);
    draw();
    button(body, "Importar tema", async () => {
      const r = await api.advanced("theme.import");
      if (r?.error) throw Error(r.error);
      if (!r?.theme) return;
      if ((config.settings.savedThemes || []).length >= 40)
        throw Error("Puedes guardar hasta 40 temas.");
      config.settings.savedThemes ||= [];
      config.settings.savedThemes.push(r.theme);
      await persist();
      window.dispatchEvent(
        new CustomEvent("dreams-themes-changed", { detail: r.theme.id }),
      );
      draw();
    });
    button(body, "Exportar apariencia actual", async () => {
      const r = await api.advanced("theme.export", {
        name: "Mi tema",
        settings: DreamsThemes.snapshot(config.settings),
      });
      if (r?.error) throw Error(r.error);
    });
    button(body, "Restaurar apariencia anterior", async () => {
      Object.assign(config.settings, structuredClone(before));
      if (beforeId) config.settings.currentThemeId = beforeId;
      else delete config.settings.currentThemeId;
      await save();
    });
  };
  button(appearance, "Temas", window.openDreamsThemes);
  window.openDreamsMulticolor = () => {
    const { body, d } = dialog("Corrector multicolor", "multicolor-dialog"),
      input = el("textarea"),
      palette = el("div", "classic-palette"),
      preview = el("div", "format-preview"),
      warning = el("p", "note");
    input.setAttribute("aria-label", "Texto IRC multicolor");
    input.spellcheck = true;
    input.lang = "es";
    input.rows = 5;
    input.value = $("message-input").value;
    preview.setAttribute("aria-label", "Vista previa multicolor");
    body.append(palette, input, warning, preview);
    let start = 0,
      end = 0;
    const remember = () => {
      start = input.selectionStart;
      end = input.selectionEnd;
    };
    for (const type of ["select", "keyup", "click", "input"])
      input.addEventListener(type, remember);
    const update = () => {
      const valid = DreamsClassicEditor.valid(input.value);
      warning.textContent = valid
        ? "Seleccioná una posición o texto y elegí un color 00–15. Ctrl+K abre la paleta. Los códigos IRC se conservan al editar, copiar y pegar."
        : "Solo se admiten códigos IRC clásicos 00–15. Quitá los códigos RGB o extendidos antes de aplicar.";
      DreamsFormatting.render(preview, input.value);
      apply.disabled = copy.disabled = !valid;
    };
    for (let index = 0; index < 16; index++) {
      const b = button(palette, String(index).padStart(2, "0"), () => {
        const result = DreamsClassicEditor.color(
          input.value,
          start,
          end,
          index,
        );
        input.value = result.value;
        input.focus();
        input.setSelectionRange(result.start, result.end);
        remember();
        update();
      });
      b.style.background = DreamsFormatting.colors[index];
      b.style.color = DreamsFormatting.readableColor(
        "#ffffff",
        DreamsFormatting.colors[index],
      );
      b.onpointerdown = (e) => e.preventDefault();
    }
    input.oninput = update;
    input.onkeydown = (e) => {
      if (e.ctrlKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        remember();
        palette.querySelector("button").focus();
      }
    };
    const copy = button(body, "Copiar con códigos IRC", async () =>
      api.copy(input.value),
    );
    const apply = button(body, "Aplicar al mensaje", () => {
      if (!DreamsClassicEditor.valid(input.value)) return;
      $("message-input").value = input.value;
      $("message-input").dispatchEvent(new Event("input", { bubbles: true }));
      d.close();
      $("message-input").focus();
    });
    update();
  };
  button(
    chat.lastElementChild,
    "Corrector multicolor",
    window.openDreamsMulticolor,
  );
  applySettings();
  render(true);
})();
