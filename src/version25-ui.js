"use strict";
(() => {
  const panel = (key) => document.querySelector('[data-panel="' + key + '"]'),
    nav = document.querySelector(".settings-nav"),
    run = (fn) =>
      Promise.resolve()
        .then(fn)
        .catch((e) => notify(e.message, true));
  const button = (host, label, fn) => {
    const b = el("button", "secondary", label);
    b.type = "button";
    b.onclick = () => run(fn);
    host.append(b);
    return b;
  };
  const save = () => {
    applySettings();
    render(true);
    return persist();
  };
  // Keep the room-list action once, under Salas.
  const menus = [...document.querySelectorAll(".menubar nav>.menu")],
    root = (name) =>
      menus.find(
        (m) => m.querySelector(":scope>summary").textContent.trim() === name,
      ),
    rooms = root("Salas"),
    view = root("Ver"),
    chatMenu = root("Chat");
  for (const b of document.querySelectorAll(".menubar .menu-popup button"))
    if (b.textContent.trim() === "Listado de salas")
      rooms.querySelector(":scope>.menu-popup").append(b);
  const oldWindows = $("windows-menu"),
    windows = el("details", "mdi-layout-menu menu-submenu"),
    summary = el("summary", "", "Ventanas"),
    fly = el("div", "menu-flyout");
  windows.id = "windows-menu";
  fly.setAttribute("popover", "manual");
  windows.append(summary, fly);
  for (const b of oldWindows.querySelectorAll("button")) {
    b.setAttribute("role", "menuitem");
    fly.append(b);
  }
  oldWindows.remove();
  view.querySelector(".menu-popup").append(windows);
  const hide = () => {
    windows.open = false;
    if (fly.matches(":popover-open")) fly.hidePopover();
    summary.setAttribute("aria-expanded", "false");
  };
  summary.setAttribute("aria-haspopup", "menu");
  windows.addEventListener("toggle", () => {
    summary.setAttribute("aria-expanded", String(windows.open));
    if (!windows.open) {
      if (fly.matches(":popover-open")) fly.hidePopover();
      return;
    }
    for (const d of document.querySelectorAll(".menu-submenu[open]"))
      if (d !== windows) d.open = false;
    fly.showPopover();
    const r = summary.getBoundingClientRect();
    fly.style.left =
      Math.max(4, Math.min(r.right + 3, innerWidth - fly.offsetWidth - 4)) +
      "px";
    fly.style.top =
      Math.max(4, Math.min(r.top, innerHeight - fly.offsetHeight - 4)) + "px";
  });
  fly.addEventListener("click", (e) => {
    if (e.target.closest("button")) {
      hide();
      view.open = false;
    }
  });
  view.addEventListener("toggle", () => {
    if (!view.open) hide();
  });
  summary.onkeydown = (e) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      windows.open = true;
      requestAnimationFrame(() => fly.querySelector("button")?.focus());
    }
  };
  fly.onkeydown = (e) => {
    if (e.key === "ArrowLeft" || e.key === "Escape") {
      e.preventDefault();
      hide();
      summary.focus();
    } else if (["ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      const buttons = [...fly.querySelectorAll("button")],
        index = buttons.indexOf(document.activeElement);
      buttons[
        e.key === "Home"
          ? 0
          : e.key === "End"
            ? buttons.length - 1
            : (index + (e.key === "ArrowUp" ? -1 : 1) + buttons.length) %
              buttons.length
      ]?.focus();
    }
  };
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !document.querySelector("dialog[open]")) {
      hide();
      for (const m of document.querySelectorAll(".menubar nav>.menu"))
        m.open = false;
    }
  });
  document.addEventListener("pointerdown", (e) => {
    if (!windows.contains(e.target) && !fly.contains(e.target)) hide();
  });
  window.addEventListener("resize", hide);
  // A single compact Chat view owns spacing and presentation of NOTICE/ACTION.
  const chat = panel("chat"),
    appearance = panel("appearance"),
    layout = panel("layout");
  for (const row of [...chat.querySelectorAll(":scope>label")]) {
    if (
      row.querySelector(
        '[aria-label="Vista de eventos de sala"],[aria-label="Mostrar posibles clones"]',
      )
    )
      layout.append(row);
  }
  const line = $("setting-lineHeight").closest("label"),
    gap = $("setting-messageSpacing").closest("label"),
    spacingPreview = document.querySelector(".chat-spacing-preview");
  chat.replaceChildren(
    el("h3", "", "Chat"),
    el(
      "p",
      "note",
      "Cada conversación conserva su borrador y posición durante esta sesión.",
    ),
  );
  const spacing = el("section", "chat-format-block"),
    spacingRow = el("div", "chat-format-row");
  spacing.append(
    el("h4", "", "Espaciado del chat"),
    spacingRow,
    spacingPreview,
  );
  spacingRow.append(line, gap);
  chat.append(spacing);
  const controls = {};
  function field(host, label, type, value, key) {
    const l = el("label", "chat-format-field", label),
      i = el(type === "select" ? "select" : "input");
    if (type !== "select") i.type = type;
    i.setAttribute("aria-label", label);
    if (type === "checkbox") i.checked = !!value;
    else i.value = value ?? "";
    l.append(i);
    host.append(l);
    if (key) controls[key] = i;
    return i;
  }
  function normalNickColor(name, bg) {
    if (config.settings.coloredNicks === false)
      return (
        config.settings.roomAppearance?.text ||
        getComputedStyle(document.documentElement).getPropertyValue("--text")
      );
    let hash = 0;
    for (const ch of fold(name)) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
    const pastel = config.settings.nickPalette === "pastel",
      light = DreamsFormatting.luminance(bg) > 0.4;
    return `hsl(${Math.abs(hash) % 360} ${pastel ? 48 : 78}% ${light ? (pastel ? 36 : 28) : pastel ? 78 : 68}%)`;
  }
  const updates = [];
  function format(kind) {
    const action = kind === "action",
      s = config.settings,
      prefixKey = action ? "actionPrefix" : "noticePrefix",
      colorKey = action ? "actionColor" : "noticeColor",
      block = el("section", "chat-format-block"),
      head = el("div", "chat-format-heading"),
      row = el("div", "chat-format-row"),
      preview = el("div", "chat-format-preview");
    preview.setAttribute(
      "aria-label",
      action ? "Vista previa de /me" : "Vista previa de NOTICE",
    );
    head.append(el("h4", "", action ? "Formato de /me" : "Formato de NOTICE"));
    block.append(head, row, preview);
    chat.append(block);
    const prefix = field(
        row,
        "Prefijo:",
        "text",
        s[prefixKey] ?? (action ? "*" : ""),
        prefixKey,
      ),
      use = field(row, "Usar color propio", "checkbox", !!s[colorKey]),
      color = field(row, "Color:", "color", s[colorKey] || "#a050cf", colorKey);
    prefix.maxLength = 60;
    prefix.setAttribute(
      "aria-label",
      action ? "Prefijo de /me" : "Prefijo de NOTICE",
    );
    color.setAttribute(
      "aria-label",
      action ? "Color de /me" : "Color de NOTICE",
    );
    use.setAttribute(
      "aria-label",
      action ? "Usar color propio de /me" : "Usar color propio de NOTICE",
    );
    let extra;
    if (action) {
      extra = field(
        row,
        "Estilo:",
        "select",
        s.actionStyle || "normal",
        "actionStyle",
      );
      extra.setAttribute("aria-label", "Estilo de /me");
      for (const [v, t] of [
        ["normal", "Normal"],
        ["bold", "Negrita"],
        ["italic", "Cursiva"],
        ["bold italic", "Negrita y cursiva"],
      ]) {
        const o = el("option", "", t);
        o.value = v;
        extra.append(o);
      }
      extra.value = s.actionStyle || "normal";
    } else {
      extra = field(
        row,
        "Espacios:",
        "number",
        s.noticePrefixGap ?? 1,
        "noticePrefixGap",
      );
      extra.setAttribute("aria-label", "Espacios del NOTICE");
      extra.min = 0;
      extra.max = 8;
      extra.step = 1;
    }
    function update() {
      const settings = config.settings,
        bg =
          (!action && settings.noticeBackground) ||
          settings.roomAppearance?.background ||
          getComputedStyle(document.documentElement)
            .getPropertyValue("--bg")
            .trim();
      if (document.activeElement !== prefix)
        prefix.value = settings[prefixKey] ?? (action ? "*" : "");
      use.checked = !!settings[colorKey];
      if (settings[colorKey]) color.value = settings[colorKey];
      color.disabled = !use.checked;
      if (document.activeElement !== extra)
        extra.value = action
          ? settings.actionStyle || "normal"
          : (settings.noticePrefixGap ?? 1);
      preview.style.background = bg;
      preview.style.color = settings[colorKey]
        ? DreamsFormatting.readableColor(settings[colorKey], bg)
        : DreamsFormatting.readableColor(
            settings.roomAppearance?.text ||
              getComputedStyle(document.documentElement)
                .getPropertyValue("--text")
                .trim(),
            bg,
          );
      preview.replaceChildren(
        document.createTextNode(
          (settings[prefixKey] ?? (action ? "*" : "")) +
            " ".repeat(action ? 1 : (settings.noticePrefixGap ?? 1)),
        ),
      );
      if (action) {
        const nick = el("span", "", "Nora");
        nick.style.color = normalNickColor("Nora", bg);
        preview.append(nick, document.createTextNode(" saluda a la sala"));
        preview.style.fontWeight = settings.actionStyle?.includes("bold")
          ? "700"
          : "";
        preview.style.fontStyle = settings.actionStyle?.includes("italic")
          ? "italic"
          : "";
      } else preview.append(document.createTextNode("Aviso de ejemplo"));
    }
    const commit = () => {
      const s = config.settings;
      s[prefixKey] = prefix.value;
      s[colorKey] = use.checked ? color.value : null;
      if (action) s.actionStyle = extra.value;
      else
        s.noticePrefixGap = Math.max(0, Math.min(8, Number(extra.value) || 0));
      run(save);
    };
    for (const i of [prefix, use, color, extra])
      i.addEventListener("input", commit);
    const reset = button(head, "↺", () => {
      const s = config.settings;
      s[prefixKey] = action ? "*" : "";
      s[colorKey] = null;
      if (action) {
        s.actionStyle = "normal";
        extra.value = "normal";
      } else {
        s.noticePrefixGap = 1;
        extra.value = "1";
      }
      return save();
    });
    reset.className = "format-reset";
    reset.setAttribute(
      "aria-label",
      action ? "Restaurar formato de /me" : "Restaurar formato de NOTICE",
    );
    reset.title = reset.getAttribute("aria-label");
    updates.push(update);
    update();
  }
  format("notice");
  format("action");
  const baseApply = applySettings;
  applySettings = function (...args) {
    const r = baseApply(...args);
    for (const update of updates) update();
    return r;
  };
  window.openDreamsMessageFormat = () => {
    openSettings("chat");
  };
  for (const b of [...chatMenu.querySelectorAll(".menu-popup>button")]) {
    if (b.textContent.includes("Status") || b.textContent.startsWith("/me"))
      b.remove();
    else if (b.textContent.startsWith("NOTICE")) {
      b.textContent = "Formato de mensajes";
      b.onclick = () => {
        chatMenu.open = false;
        openSettings("chat");
      };
    }
  }
  // Status and dictionary/nick completion are separate entries in the requested group.
  const group = [...nav.querySelectorAll(".settings-group")].find(
      (g) => g.querySelector("summary").textContent === "Chat y notificaciones",
    ),
    children = group.querySelector(".settings-children");
  const statusPanel = el("section");
  statusPanel.dataset.panel = "status";
  statusPanel.hidden = true;
  document.querySelector(".settings-content").append(statusPanel);
  const statusButton = el("button", "", "Status");
  statusButton.dataset.section = "status";
  statusButton.onclick = () => {
    statusPanel.replaceChildren(el("h3", "", "Status"));
    const fields = {};
    for (const [key, g] of Object.entries(DreamsStatus.groups)) {
      const section = el("section", "status-filter-group");
      fields[key] = field(
        section,
        g.label,
        "checkbox",
        config.settings.statusFilters?.[key] !== false,
      );
      for (const [k, label] of Object.entries(g.items))
        if (k !== key)
          fields[k] = field(
            section,
            label,
            "checkbox",
            config.settings.statusFilters?.[k] !== false,
          );
      statusPanel.append(section);
    }
    button(statusPanel, "Guardar filtros", () => {
      config.settings.statusFilters = Object.fromEntries(
        Object.entries(fields).map(([k, i]) => [k, i.checked]),
      );
      return save();
    });
  };
  children.append(statusButton);
  for (const b of children.querySelectorAll("button")) {
    const text = b.textContent.replace(/^Configuración(?: de)? /, "");
    b.textContent = text.charAt(0).toUpperCase() + text.slice(1);
  }

  const dict = nav.querySelector("[data-section=writing]");
  dict.textContent = "Diccionario";
  dict.onclick = () =>
    window.renderDreamsWritingSettings(panel("writing"), "dictionary");
  children.append(dict);
  const nickPanel = el("section");
  nickPanel.dataset.panel = "nickCompletion";
  nickPanel.hidden = true;
  document.querySelector(".settings-content").append(nickPanel);
  const nick = el("button", "", "Nick completion");
  nick.dataset.section = "nickCompletion";
  nick.onclick = () => window.renderDreamsWritingSettings(nickPanel, "nick");
  children.append(nick);
  // General appearance tools remain available through navigation, not footer buttons in Chat.
  for (const [label, fn] of [
    ["Apariencia de sala", () => $("room-appearance-button").click()],
    ["Temas", () => window.openDreamsThemes()],
  ]) {
    for (const b of appearance.querySelectorAll(":scope>button"))
      if (b.textContent === label) b.remove();
    const b = el("button", "", label);
    b.onclick = fn;
    const look = [...nav.querySelectorAll(".settings-group")].find(
      (g) => g.querySelector("summary").textContent === "Apariencia",
    );
    look.querySelector(".settings-children").append(b);
  }
  // Add the same classic IRC formatting controls to substitution editing.
  window.attachDreamsDictionaryFormat = (form, input) => {
    const tools = el("div", "dictionary-format-tools"),
      preview = el("div", "dictionary-format-preview");
    preview.setAttribute("aria-label", "Vista previa del reemplazo");
    let start = 0,
      end = 0;
    const remember = () => {
      start = input.selectionStart;
      end = input.selectionEnd;
    };
    for (const name of ["select", "keyup", "click", "input"])
      input.addEventListener(name, remember);
    function apply(result) {
      input.value = result.value;
      input.focus();
      input.setSelectionRange(result.start, result.end);
      remember();
      input.dispatchEvent(new Event("input"));
    }
    for (const [label, key] of [
      ["Negrita", "bold"],
      ["Cursiva", "italic"],
      ["Subrayado", "underline"],
    ]) {
      const b = button(tools, label, () =>
        apply(DreamsClassicEditor.style(input.value, start, end, key)),
      );
      b.onpointerdown = (e) => e.preventDefault();
    }
    const colors = el("select");
    colors.setAttribute("aria-label", "Color IRC del reemplazo");
    const empty = el("option", "", "Color IRC");
    empty.value = "";
    colors.append(empty);
    DreamsFormatting.colors.slice(0, 16).forEach((color, index) => {
      const o = el("option", "", String(index).padStart(2, "0"));
      o.value = index;
      o.style.background = color;
      o.style.color = DreamsFormatting.readableColor("#ffffff", color);
      colors.append(o);
    });
    colors.onpointerdown = remember;
    colors.onchange = () => {
      if (colors.value !== "")
        apply(
          DreamsClassicEditor.color(
            input.value,
            start,
            end,
            Number(colors.value),
          ),
        );
      colors.value = "";
    };
    tools.append(colors);
    form.append(tools, preview);
    const update = () => {
      DreamsFormatting.render(preview, input.value);
      form.querySelector("button[type=submit]").disabled =
        !DreamsClassicEditor.valid(input.value);
    };
    input.addEventListener("input", update);
    update();
  };
  const sizes = new WeakMap();
  window.sizeDreamsComposer = (input) => {
    if (!input.isConnected || !input.clientWidth) return;
    const css = getComputedStyle(input),
      key = [
        input.value,
        input.clientWidth,
        css.fontSize,
        css.fontFamily,
        css.lineHeight,
      ].join("|");
    if (sizes.get(input) === key) return;
    sizes.set(input, key);
    input.style.height = "auto";
    input.style.height =
      Math.min(
        150,
        Math.max(
          26,
          (input.value
            ? input.scrollHeight
            : parseFloat(css.lineHeight) +
              parseFloat(css.paddingTop) +
              parseFloat(css.paddingBottom)) +
            (parseFloat(css.borderTopWidth) || 0) +
            (parseFloat(css.borderBottomWidth) || 0),
        ),
      ) + "px";
  };
  const baseRender = render;
  render = function (...args) {
    const r = baseRender(...args);
    for (const input of document.querySelectorAll(
      "#message-input,.mdi-composer textarea",
    ))
      window.sizeDreamsComposer(input);
    return r;
  };
  applySettings();
  render(true);
})();
