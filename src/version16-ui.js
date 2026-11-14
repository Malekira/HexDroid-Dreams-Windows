"use strict";
(() => {
  const run = (fn) =>
      Promise.resolve()
        .then(fn)
        .catch((e) => notify(e.message, true)),
    save = async (values) => {
      Object.assign(config.settings, values);
      await persist();
      applySettings();
      render();
    };
  const labels = {
    general: "General",
    away: "Away",
    notice: "NOTICE",
    notifications: "Notificaciones",
    highlight: "Resaltado",
    sound: "Sonido",
  };
  window.renderDreamsChatPreferences = (host, key, commit = save) => {
    host.replaceChildren(el("h3", "", labels[key]));
    const s = config.settings,
      fields = {};
    function field(name, label, type = "checkbox", value = s[name]) {
      const l = el("label", "setting-row", label),
        i = el(type === "select" ? "select" : "input");
      if (type !== "select") i.type = type;
      if (type === "color") i.dataset.ircColor = "";
      i.setAttribute("aria-label", label);
      if (type === "checkbox") i.checked = value !== false;
      else i.value = value ?? "";
      l.append(i);
      host.append(l);
      fields[name] = i;
      return i;
    }
    if (key === "general") {
      field(
        "minimizeToTray",
        "Minimizar a la bandeja",
        "checkbox",
        s.minimizeToTray === true,
      );
      field(
        "closeToTray",
        "Cerrar ventana mantiene conexiones en la bandeja",
        "checkbox",
        s.closeToTray === true,
      );
      field(
        "highlightWords",
        "Palabras destacadas (separadas por comas)",
        "text",
        (s.highlightWords || []).join(", "),
      );
    }
    if (key === "away") {
      field(
        "autoAwayEnabled",
        "Activar Autoaway",
        "checkbox",
        s.autoAwayEnabled === true,
      );
      const minutes = field(
        "autoAwayMinutes",
        "Inactividad para Autoaway (minutos)",
        "number",
        s.autoAwayMinutes || 10,
      );
      minutes.min = 1;
      minutes.max = 1440;
      field(
        "autoAwayMessage",
        "Mensaje de Autoaway",
        "text",
        s.autoAwayMessage || "Ausente por inactividad",
      ).maxLength = 100;
      field("autoAwayReturn", "Quitar Autoaway al volver");
    }
    if (key === "notice") {
      const row = el("div", "notice-destinations"),
        title = el("span", "", "Mostrar NOTICE en:");
      row.append(title);
      host.append(row);
      for (const [value, label] of [
        ["original", "Destino original"],
        ["private", "PV"],
        ["room", "Sala"],
        ["status", "Status"],
      ]) {
        const l = el("label", "compact-check"),
          i = el("input");
        i.type = "checkbox";
        i.checked = (s.noticeDestinations || ["original"]).includes(value);
        i.dataset.route = value;
        i.setAttribute("aria-label", "NOTICE en " + label);
        l.append(i, document.createTextNode(label));
        row.append(l);
      }
      host.append(
        el(
          "p",
          "note",
          "Puedes elegir varios destinos. Sala utiliza la sala de origen o la sala activa de esa red. Si no hay una sala activa o el aviso no tiene PV, se utiliza Status.",
        ),
      );
      field("noticePopup", "Enviar notificación emergente de Windows");
      const useColor = field(
          "useNoticeColor",
          "Personalizar color del NOTICE",
          "checkbox",
          !!s.noticeColor,
        ),
        color = field(
          "noticeColor",
          "Color del NOTICE",
          "color",
          s.noticeColor || "#bca0ff",
        ),
        useBg = field(
          "useNoticeBackground",
          "Personalizar fondo del NOTICE",
          "checkbox",
          !!s.noticeBackground,
        ),
        bg = field(
          "noticeBackground",
          "Fondo del NOTICE",
          "color",
          s.noticeBackground || "#191b3a",
        ),
        style = field("noticeStyle", "Estilo del NOTICE", "select");
      for (const [v, t] of [
        ["normal", "Normal"],
        ["bold", "Negrita"],
        ["italic", "Cursiva"],
        ["bold-italic", "Negrita y cursiva"],
      ]) {
        const o = el("option", "", t);
        o.value = v;
        style.append(o);
      }
      style.value = s.noticeStyle || "normal";
      const sample = el(
        "p",
        "writing-preview",
        "NOTICE · Ejemplo de aviso recibido",
      );
      host.append(sample);
      const preview = () => {
        color.disabled = !useColor.checked;
        bg.disabled = !useBg.checked;
        sample.style.background = useBg.checked ? bg.value : "var(--bg)";
        sample.style.color = useColor.checked
          ? DreamsFormatting.readableColor(
              color.value,
              useBg.checked
                ? bg.value
                : getComputedStyle(sample).backgroundColor,
            )
          : useBg.checked
            ? DreamsFormatting.readableColor(
                getComputedStyle(document.documentElement)
                  .getPropertyValue("--text")
                  .trim(),
                bg.value,
              )
            : "var(--text)";
        sample.style.fontWeight = style.value.includes("bold") ? "700" : "";
        sample.style.fontStyle = style.value.includes("italic") ? "italic" : "";
      };
      for (const i of [useColor, color, useBg, bg, style]) i.oninput = preview;
      preview();
    }
    if (key === "notifications") {
      field(
        "notifyPrivates",
        "Notificar privados",
        "checkbox",
        s.notifications !== false && s.notifyPrivates !== false,
      );
      field(
        "notifyMentions",
        "Notificar menciones",
        "checkbox",
        s.notifications !== false && s.notifyMentions !== false,
      );
      field("sendTyping", "Enviar aviso «Estoy escribiendo»");
      field("notifyWhileFocused", "Avisar con la ventana activa");
      field(
        "notifyInCurrentRoom",
        "Avisar también en la sala que estoy viendo",
      );
      field("flashOnMention", "Destacar la ventana");
      field(
        "notificationPreview",
        "Mostrar contenido en la notificación",
        "checkbox",
        s.notificationPreview === true,
      );
    }
    let scope;
    if (key === "highlight") {
      field("highlightMentions", "Resaltar mensajes que mencionen mi nick");
      const color = field(
        "mentionHighlightColor",
        "Color del resaltado de menciones",
        "color",
        s.mentionHighlightColor || "#7650aa",
      );
      scope = el("select");
      scope.setAttribute("aria-label", "Red del color de menciones");
      const common = el("option", "", "Todas las redes");
      common.value = "";
      scope.append(common);
      for (const p of config.profiles) {
        const o = el("option", "", p.name);
        o.value = p.id;
        scope.append(o);
      }
      color.parentElement.append(scope);
      scope.onchange = () =>
        (color.value =
          profile(scope.value)?.mentionHighlightColor ||
          s.mentionHighlightColor ||
          "#7650aa");
      field("highlightActivity", "Resaltar conversaciones con mensajes nuevos");
      field(
        "highlightEvents",
        "Resaltar conversaciones por entradas y salidas",
        "checkbox",
        s.highlightEvents === true,
      );
    }
    if (key === "sound") {
      field("mentionSound", "Sonido al mencionar mi nick");
      field("privateSound", "Sonido de mensajes privados");
      field(
        "channelSound",
        "Sonido de todos los mensajes de sala",
        "checkbox",
        s.channelSound === true,
      );
    }
    const button = el("button", "primary", "Guardar");
    button.type = "button";
    button.onclick = () =>
      run(async () => {
        const values = Object.fromEntries(
          Object.entries(fields).map(([k, i]) => [
            k,
            i.type === "checkbox"
              ? i.checked
              : i.type === "number"
                ? Number(i.value)
                : i.value,
          ]),
        );
        if (key === "general")
          values.highlightWords = values.highlightWords
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);
        if (key === "notifications")
          values.notifications = values.notifyPrivates || values.notifyMentions;
        if (key === "notice") {
          values.noticeDestinations = [
            ...host.querySelectorAll("[data-route]:checked"),
          ].map((i) => i.dataset.route);
          if (!values.useNoticeColor) values.noticeColor = null;
          if (!values.useNoticeBackground) values.noticeBackground = null;
          delete values.useNoticeColor;
          delete values.useNoticeBackground;
        }
        if (scope?.value) {
          profile(scope.value).mentionHighlightColor =
            values.mentionHighlightColor;
          delete values.mentionHighlightColor;
        }
        await commit(values);
        notify("Configuración guardada.");
      });
    host.append(button);
  };
  const nav = document.querySelector(".settings-nav"),
    chat = el("details", "settings-group"),
    children = el("div", "settings-children");
  chat.open = true;
  chat.append(el("summary", "", "Chat y notificaciones"), children);
  nav.insertBefore(chat, nav.querySelectorAll(".settings-group")[2]);
  for (const [key, label] of Object.entries(labels)) {
    let b = nav.querySelector('[data-advanced-section="' + key + '"]');
    if (!b) {
      b = el("button", "", label);
      b.dataset.section = key;
      const section = el("section");
      section.dataset.panel = key;
      section.hidden = true;
      document.querySelector(".settings-content").append(section);
      b.onclick = () => window.renderDreamsChatPreferences(section, key);
    }
    children.append(b);
  }
  const writingButton = el("button", "", "Diccionario y nick completion"),
    writingPanel = el("section");
  writingButton.dataset.section = "writing";
  writingPanel.dataset.panel = "writing";
  writingPanel.hidden = true;
  document.querySelector(".settings-content").append(writingPanel);
  children.append(writingButton);
  writingButton.onclick = () =>
    window.renderDreamsWritingSettings(writingPanel);
  // Keep a single nick-palette control in appearance.
  for (const label of document.querySelectorAll(
    "[data-panel=appearance] label",
  ))
    if (label.textContent.trim().startsWith("Colores de los nicks"))
      label.remove();
  const bar = document.querySelector(".menubar"),
    roots = [...bar.querySelectorAll(".menu")],
    file = roots.find(
      (r) => r.querySelector("summary")?.textContent === "Archivo",
    ),
    view = roots.find((r) => r.querySelector("summary")?.textContent === "Ver");
  roots
    .find((r) => r.querySelector("summary")?.textContent === "Red")
    ?.remove();
  const action = (text, name, fn) => {
    const b = el("button", "", text);
    b.type = "button";
    if (name) b.dataset.action = name;
    if (fn) b.onclick = () => run(fn);
    return b;
  };
  const favorites = $("favorites-menu"),
    windows = view.querySelector(".mdi-layout-menu");
  file.querySelector(".menu-popup").replaceChildren(
    action("Conectar / desconectar red", "connection"),
    action("Nueva red", "add-network"),
    action("Administrar redes", "networks"),
    el("hr"),
    action("Entrar a una sala", "join"),
    favorites,
    action("Listado de salas", null, () => {
      openJoin();
      if ($("join-dialog").open)
        $("join-dialog").querySelector("h2").textContent = "Listado de salas";
    }),
    el("hr"),
    action("Configuración", "settings"),
    action("Abrir carpeta de diagnóstico", "logs"),
    el("hr"),
    action("Salir", "quit"),
  );
  view.querySelector(".menu-popup").replaceChildren(
    action("Historial", null, () =>
      window.openDreamsAdvanced
        ? window.openDreamsAdvanced("history")
        : openSettings("diagnostics"),
    ),
    action("Visor de logs", null, () => window.openDreamsHistory()),
    el("hr"),
    windows,
    el("hr"),
    action("Mostrar / ocultar panel lateral izquierdo", "toggle-privates"),
    action("Mostrar / ocultar panel lateral derecho", "toggle-users"),
  );
  const baseJoin = openJoin;
  openJoin = function (...args) {
    $("join-dialog").querySelector("h2").textContent = "Entrar en una sala";
    return baseJoin(...args);
  };
  const quick = el("label", "network-picker theme-picker", "Tema"),
    themeSelect = el("select");
  themeSelect.id = "theme-quick-select";
  themeSelect.setAttribute("aria-label", "Tema rápido");
  quick.append(themeSelect);
  let themeSignature = "";
  function themes() {
    const choices = [
        ["__settings__", "Ir a temas…"],
        ["dark", "Oscuro"],
        ["light", "Claro"],
        ["system", "Sistema"],
        ["matrix", "Matrix"],
        ["violet", "Morado y azul marino"],
        ["purple-light", "PurpleDreamsLight"],
        ...(config.settings.savedThemes || []).map((t) => [t.id, t.name]),
      ],
      signature = JSON.stringify(choices);
    if (signature !== themeSignature) {
      themeSignature = signature;
      themeSelect.replaceChildren();
      for (const [v, t] of choices) {
        const o = el("option", "", t);
        o.value = v;
        themeSelect.append(o);
      }
    }
    themeSelect.value =
      config.settings.currentThemeId || config.settings.theme || "dark";
    if (!themeSelect.value) themeSelect.value = config.settings.theme || "dark";
  }
  themeSelect.onchange = () => {
    const id = themeSelect.value;
    if (id === "__settings__") {
      themes();
      openSettings("appearance");
      return;
    }
    themeSelect.disabled = true;
    run(async () => {
      try {
        const style =
          (config.settings.savedThemes || []).find((t) => t.id === id)
            ?.settings ||
          (id === "violet"
            ? DreamsThemes.violet
            : id === "purple-light"
              ? DreamsThemes.purpleLight
              : { theme: id, customColors: {}, roomAppearance: {} });
        await save({ ...structuredClone(style), currentThemeId: id });
      } finally {
        themeSelect.disabled = false;
        themes();
      }
    });
  };
  const applyBeforeThemePicker = applySettings;
  applySettings = function (...args) {
    const r = applyBeforeThemePicker(...args);
    themes();
    return r;
  };
  window.addEventListener("dreams-themes-changed", themes);
  themes();
  $("theme-toggle")?.remove();
  const strip = el("div", "network-strip");
  bar.append(strip);
  for (const node of [
    bar.querySelector(".network-picker"),
    $("connection-button"),
    $("server-button"),
    $("join-button"),
    $("topic-toggle"),
    $("notify-button"),
    quick,
    bar.querySelector(".settings-top"),
    $("notification-bell"),
  ])
    if (node) strip.append(node);
  $("join-button").textContent = "Salas";
  $("join-button").title = "Entrar en una sala o ver el listado";
  $("server-button").title = "Consola de red";
  $("connection-button").title = "Conectar o desconectar la red";
  const legacy = $("users-toggle");
  legacy.hidden = true;
  legacy.classList.add("legacy-users-toggle");
  document.querySelector(".mdi-live-chat").append(legacy);
  $("privates-toggle").hidden = true;
  document.querySelector(".mdi-live-chat").append($("privates-toggle"));
  if ($("room-appearance-button"))
    document
      .querySelector(".message-toolbar")
      .append($("room-appearance-button"));
  bar.querySelector(".chat-tools")?.remove();
  const brand = bar.querySelector(".mini-brand");
  if (brand) {
    let image = brand.querySelector("img");
    if (!image) {
      image = el("img");
      image.src = "assets/logo.png";
      image.alt = "HexDreams IRC";
      brand.prepend(image);
    }
    image.alt = "HexDreams IRC";
    image.classList.add("toolbar-logo");
  }
  const editor = $("profile-realName"),
    counter = $("identity-length");
  function count() {
    const plain = DreamsFormatting.plain(editor.value || ""),
      characters = [...plain].length,
      bytes = new TextEncoder().encode(editor.value || "").length,
      user = $("profile-username").value || $("profile-nick").value || "",
      budget = 510 - new TextEncoder().encode("USER " + user + " 0 * :").length,
      limit = networks.get($("profile-id").value || active?.id)?.realNameLimit,
      over =
        bytes > budget ||
        (Number.isFinite(Number(limit)) &&
          Number(limit) > 0 &&
          characters > Number(limit));
    counter.textContent =
      characters +
      " caracteres · " +
      bytes +
      "/" +
      budget +
      " bytes" +
      (limit
        ? " · límite anunciado por el servidor: " + limit
        : " · el servidor puede aplicar un límite propio") +
      (over ? " · Límite superado: reduce el nombre o su formato." : "");
    counter.classList.toggle("form-error", !!over);
    editor.setAttribute("aria-describedby", "identity-length");
  }
  for (const i of [editor, $("profile-username"), $("profile-nick")])
    i.addEventListener("input", count);
  $("network-dialog").addEventListener("toggle", count);
})();
