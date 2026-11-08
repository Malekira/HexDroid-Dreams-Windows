"use strict";
// Desktop interactions shared by the room, identity editor and user sidebar.
(() => {
  const DEFAULT_PHOTOS =
    "https://chat-avatars.chateagratis.net/avatar/Chat/{Nick}.png";
  const call = async (name, data = {}) => {
    if (!api.advanced) throw new Error("Función no disponible.");
    const r = await api.advanced(name, data);
    if (r?.error) throw new Error(r.error);
    return r;
  };
  const run = (fn) =>
    Promise.resolve()
      .then(fn)
      .catch((e) => notify(e.message, true));
  function button(text, fn, parent) {
    const b = el("button", "secondary", text);
    b.type = "button";
    b.onclick = () => run(fn);
    parent.append(b);
    return b;
  }
  function floating(id, title, small = false) {
    const d = el("dialog", small ? "utility-dialog" : "feature-dialog");
    d.id = id;
    const h = el("header", "dialog-header");
    h.append(el("h2", "", title));
    button("Cerrar", () => d.close(), h);
    const body = el("div", "form-content");
    d.append(h, body);
    document.body.append(d);
    return { dialog: d, body };
  }
  function field(parent, text, type, value) {
    if (type === "color" && /^#[a-f\d]{3}$/i.test(value || ""))
      value =
        "#" +
        value
          .slice(1)
          .split("")
          .map((c) => c + c)
          .join("");
    const label = el("label", "feature-field", text),
      i = el(type === "select" ? "select" : "input");
    i.setAttribute("aria-label", text);
    if (type !== "select") i.type = type;
    if (type === "checkbox") i.checked = !!value;
    else if (type !== "select") i.value = value ?? "";
    label.append(i);
    parent.append(label);
    return i;
  }
  function photoSource(id, nick) {
    return avatarFor(id, nick);
  }
  const full = floating("photo-dialog", "Foto completa", true);
  let fullRequest = 0;
  async function showPhoto(id, nick, url) {
    const request = ++fullRequest;
    full.body.replaceChildren(el("p", "muted", "Cargando foto…"));
    if (!full.dialog.open) full.dialog.showModal();
    try {
      const r = await call("photo.load", { network: id, nick, url });
      if (request !== fullRequest || !full.dialog.open) return;
      if (r.cancelled) {
        full.dialog.close();
        return;
      }
      const img = el("img", "full-photo");
      img.src = r.image;
      img.alt = "Foto de " + nick;
      full.body.replaceChildren(img);
      button(
        "Guardar foto",
        () => call("media.save", { cacheId: r.cacheId }),
        full.body,
      );
    } catch (e) {
      if (request === fullRequest)
        full.body.replaceChildren(el("p", "form-error", e.message));
    }
  }
  full.dialog.addEventListener("close", () => fullRequest++);
  const whoisWindow = floating("whois-profile-dialog", "WHOIS", true);
  const userPanel = el("section", "user-profile");
  userPanel.id = "user-profile";
  userPanel.hidden = true;
  $("users-panel").append(userPanel);
  let viewing = null;
  function closeProfile() {
    if (whoisWindow.dialog.open) whoisWindow.dialog.close();
    $("users-panel").append(userPanel);
    viewing = null;
    userPanel.hidden = true;
    $("user-list").hidden = false;
    document.querySelector(".user-search").hidden = false;
    document.querySelector(".users-hint").hidden = false;
  }
  function showProfile() {
    if (!viewing) return;
    const { id, nick, details } = viewing;
    userPanel.replaceChildren();
    button("← Usuarios", closeProfile, userPanel);
    userPanel.append(el("h3", "", nick));
    const photo = el("button", "profile-photo-button"),
      img = el("img", "profile-photo"),
      src = photoSource(id, nick);
    photo.type = "button";
    photo.setAttribute("aria-label", "Ampliar foto de " + nick);
    if (src) {
      img.src = src;
      img.alt = "Foto de " + nick;
      photo.append(img);
    } else photo.textContent = nick.slice(0, 2);
    photo.onclick = () => run(() => showPhoto(id, nick));
    userPanel.append(photo);
    if (viewing.floating && (details.error || !details.complete))
      userPanel.append(el("p", "muted", details.error || "Consultando WHOIS…"));
    if (viewing.floating && details.realName?.includes("\ufffd"))
      userPanel.append(
        el(
          "p",
          "note",
          "El servidor entregó caracteres incompletos en el nombre real. Vuelve a guardar la identidad y reconectar; el límite del servidor puede cortar emojis o formato.",
        ),
      );
    const list = el("dl", "user-details");
    for (const [key, label] of Object.entries({
      realName: "Nombre real",
      idle: "Inactividad (idle)",
      ident: "Ident",
      host: "Host",
      server: "Servidor",
      channels: "Salas",
      account: "Cuenta",
      away: "Ausente",
    })) {
      const term = el("dt", "", label),
        value = el("dd");
      DreamsFormatting.render(
        value,
        details[key] ||
          (key === "idle"
            ? details.complete
              ? "No facilitado por el servidor"
              : "Consultando…"
            : "—"),
      );
      if (key === "channels" && details.channels) {
        value.replaceChildren();
        for (const channel of details.channels.split(/\s+/)) {
          const target = channel.replace(/^[~&@%+]+(?=[#&!+])/, "");
          if (/^[#&!+]/.test(target))
            button(
              channel,
              () =>
                api.send({
                  id,
                  target: active?.target || "*",
                  text: "/join " + target,
                }),
              value,
            );
        }
      }
      list.append(term, value);
    }
    const own = network(id).nick && fold(network(id).nick) === fold(nick),
      saved = profile(id)?.realName;
    if (
      viewing.floating &&
      own &&
      details.complete &&
      saved &&
      details.realName &&
      DreamsFormatting.plain(saved) !== DreamsFormatting.plain(details.realName)
    )
      userPanel.append(
        el(
          "p",
          "note",
          "El nombre recibido no coincide con el guardado. Si lo acabas de cambiar, vuelve a conectar; el servidor puede aplicar su propio límite.",
        ),
      );
    // Put actions before long WHOIS fields so they remain easy to reach.
    button(
      "Mencionar",
      () => {
        const input = $("message-input");
        input.value += (input.value ? " " : "") + nick + ": ";
        input.dispatchEvent(new Event("input"));
        input.focus();
      },
      userPanel,
    );
    const ignored = (config.settings.ignoredUsers?.[id] || []).some(
      (n) => fold(n) === fold(nick),
    );
    button(
      ignored ? "Dejar de ignorar" : "Ignorar",
      async () => {
        const r = await api.send({
          id,
          target: active?.target || "*",
          text: (ignored ? "/unignore " : "/ignore ") + nick,
        });
        if (r?.error) throw new Error(r.error);
        config.settings = (await api.load()).settings;
        showProfile();
      },
      userPanel,
    );
    const muted = (config.settings.mutedUsers?.[id] || []).some(
      (n) => fold(n) === fold(nick),
    );
    button(
      muted ? "Activar notificaciones" : "Silenciar notificaciones",
      async () => {
        config.settings.mutedUsers ||= {};
        const nicks = new Set(config.settings.mutedUsers[id] || []);
        for (const n of nicks) if (fold(n) === fold(nick)) nicks.delete(n);
        if (!muted) nicks.add(nick);
        config.settings.mutedUsers[id] = [...nicks];
        await persist();
        showProfile();
      },
      userPanel,
    );
    button("Abrir privado", () => choose(id, nick), userPanel);
    button(
      (profile(id)?.notifyNicks || []).some((n) => fold(n) === fold(nick))
        ? "Dejar de seguir conexión"
        : "Seguir conexión",
      async () => {
        await window.followDreamsUser?.(id, nick);
        showProfile();
      },
      userPanel,
    );
    button("Hacer WHOIS", () => window.openDreamsWhois(id, nick), userPanel);
    const actions = el("div", "profile-action-buttons");
    for (const b of [...userPanel.children].filter(
      (n) =>
        n.tagName === "BUTTON" &&
        n !== userPanel.firstElementChild &&
        !n.classList.contains("profile-photo-button"),
    ))
      actions.append(b);
    userPanel.append(actions);
    if (viewing.floating) userPanel.append(list);
  }
  window.refreshDreamsUserPhoto = () => {
    if (!viewing) return;
    const src = photoSource(viewing.id, viewing.nick),
      b = userPanel.querySelector(".profile-photo-button");
    if (src && b) {
      let img = b.querySelector("img");
      if (!img) {
        img = el("img", "profile-photo");
        img.alt = "Foto de " + viewing.nick;
        b.replaceChildren(img);
      }
      if (img.getAttribute("src") !== src) img.src = src;
    }
  };
  window.openDreamsUser = (id, nick, options = {}) => {
    if (!options.floating && whoisWindow.dialog.open)
      whoisWindow.dialog.close();
    (options.floating ? whoisWindow.body : $("users-panel")).append(userPanel);
    if (!options.floating && !config.settings.showUsers) {
      config.settings.showUsers = true;
      applySettings();
      persist().catch(() => {});
    }
    viewing = { id, nick, details: {}, floating: !!options.floating };
    userPanel.hidden = false;
    $("user-list").hidden = true;
    document.querySelector(".user-search").hidden = true;
    document.querySelector(".users-hint").hidden = true;
    showProfile();
    if (options.floating && options.request !== false)
      call("user.whois", { network: id, nick }).catch((e) => {
        if (viewing?.id === id && viewing.nick === nick) {
          viewing.details.error = e.message;
          showProfile();
        }
      });
  };
  window.openDreamsWhois = (id, nick, options = {}) => {
    whoisWindow.dialog.querySelector("h2").textContent = "WHOIS · " + nick;
    window.openDreamsUser(id, nick, { ...options, floating: true });
    if (!whoisWindow.dialog.open) whoisWindow.dialog.showModal();
  };
  whoisWindow.dialog.addEventListener("close", () => {
    if (viewing?.floating) closeProfile();
  });
  const originalChoose = choose;
  choose = function (...args) {
    closeProfile();
    const result = originalChoose(...args);
    if (selected()?.kind === "private")
      window.openDreamsUser(args[0], selected().name);
    return result;
  };
  // Keep IRC controls out of the editable surface; serialize only supported styles.
  const realEditor = $("profile-realName");
  let realRange;
  function colorHex(value) {
    if (!value || value === "transparent") return;
    const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(value);
    if (m)
      return m
        .slice(1)
        .map((n) => Number(n).toString(16).padStart(2, "0"))
        .join("");
    if (/^#[a-f\d]{6}$/i.test(value)) return value.slice(1);
    if (/^#[a-f\d]{3}$/i.test(value))
      return value
        .slice(1)
        .split("")
        .map((c) => c + c)
        .join("");
  }
  function serializeReal(node, state = {}) {
    if (node.nodeType === Node.TEXT_NODE) {
      const fg = state.color
          ? DreamsFormatting.colors.indexOf("#" + state.color)
          : -1,
        bg = state.background
          ? DreamsFormatting.colors.indexOf("#" + state.background)
          : -1;
      const color =
        fg >= 0 && (!state.background || bg >= 0)
          ? "\x03" +
            String(fg).padStart(2, "0") +
            (bg >= 0 ? "," + String(bg).padStart(2, "0") : "")
          : state.color
            ? "\x04" +
              state.color +
              (state.background ? "," + state.background : "")
            : state.background
              ? "\x04000000," + state.background
              : "";
      const prefix =
        (state.bold ? "\x02" : "") +
        (state.italic ? "\x1d" : "") +
        (state.underline ? "\x1f" : "") +
        color;
      return prefix + node.textContent + (prefix ? "\x0f" : "");
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    if (node.tagName === "BR") return " ";
    const style = { ...state },
      css = node.style;
    if (
      ["B", "STRONG"].includes(node.tagName) ||
      ["bold", "bolder"].includes(css.fontWeight) ||
      Number(css.fontWeight) >= 600
    )
      style.bold = true;
    if (css.fontWeight === "normal" || css.fontWeight === "400")
      style.bold = false;
    if (["I", "EM"].includes(node.tagName) || css.fontStyle === "italic")
      style.italic = true;
    if (css.fontStyle === "normal") style.italic = false;
    if (node.tagName === "U" || css.textDecoration.includes("underline"))
      style.underline = true;
    const color = colorHex(css.color || node.getAttribute("color")),
      background = colorHex(css.backgroundColor);
    if (color) style.color = color;
    if (background) style.background = background;
    return (
      [...node.childNodes]
        .map((child) => serializeReal(child, style))
        .join("") +
      (["DIV", "P"].includes(node.tagName) && node !== realEditor ? " " : "")
    );
  }
  Object.defineProperty(realEditor, "value", {
    get() {
      return [...realEditor.childNodes]
        .map((n) => serializeReal(n))
        .join("")
        .trim();
    },
    set(value) {
      DreamsFormatting.render(realEditor, value);
      realRange = null;
    },
  });
  document.addEventListener("selectionchange", () => {
    const selection = getSelection();
    if (
      selection.rangeCount &&
      realEditor.contains(selection.anchorNode) &&
      realEditor.contains(selection.focusNode)
    )
      realRange = selection.getRangeAt(0).cloneRange();
  });
  function realPreview() {
    DreamsFormatting.render($("realname-preview"), realEditor.value);
  }
  function formatReal(command, value) {
    realEditor.focus();
    const selection = getSelection();
    if (realRange && realEditor.contains(realRange.commonAncestorContainer)) {
      selection.removeAllRanges();
      selection.addRange(realRange);
    } else {
      const range = document.createRange();
      range.selectNodeContents(realEditor);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    document.execCommand("styleWithCSS", false, true);
    document.execCommand(command, false, value);
    realPreview();
  }
  for (const [label, command] of [
    ["Negrita", "bold"],
    ["Cursiva", "italic"],
    ["Subrayado", "underline"],
  ]) {
    const b = button(label, () => formatReal(command), $("realname-tools"));
    b.onmousedown = (e) => e.preventDefault();
  }
  for (const [command, label] of [
    ["foreColor", "Color del nombre real"],
    ["hiliteColor", "Fondo del nombre real"],
  ]) {
    const picker = el("select");
    picker.setAttribute("aria-label", label);
    const empty = el("option", "", label);
    empty.value = "";
    picker.append(empty);
    DreamsFormatting.colors.forEach((color, index) => {
      const option = el("option", "", String(index).padStart(2, "0"));
      option.value = color;
      option.style.color = color;
      picker.append(option);
    });
    picker.onchange = () => {
      if (picker.value) formatReal(command, picker.value);
      picker.value = "";
    };
    $("realname-tools").append(picker);
  }
  realEditor.addEventListener("paste", (event) => {
    event.preventDefault();
    document.execCommand(
      "insertText",
      false,
      event.clipboardData.getData("text/plain").replace(/[\r\n]+/g, " "),
    );
  });
  realEditor.addEventListener("drop", (event) => event.preventDefault());
  realEditor.addEventListener("input", realPreview);
  const baseOpenNetwork = openNetwork;
  openNetwork = function (...args) {
    baseOpenNetwork(...args);
    realPreview();
    if (
      api.advanced &&
      config.settings.mediaEnabled !== false &&
      config.settings.showAvatars !== false
    )
      run(refreshIdentityPhoto);
  };
  let identityRequest = 0;
  async function refreshIdentityPhoto() {
    const request = ++identityRequest,
      nick = $("profile-nick").value.trim();
    if (!nick) return;
    try {
      const r = await call("photo.load", {
        network: $("profile-id").value,
        nick,
        url: $("profile-photoUrl").value || DEFAULT_PHOTOS,
      });
      if (request === identityRequest && $("network-dialog").open) {
        editingPhoto = "";
        $("profile-photo-preview").src = r.image;
        $("profile-photo-preview").hidden = false;
        if ($("network-error").textContent.startsWith("Foto:"))
          $("network-error").textContent = "";
      }
    } catch (e) {
      if (request === identityRequest)
        $("network-error").textContent = "Foto: " + e.message;
    }
  }
  for (const id of ["profile-photo-choose", "profile-photo-remove"]) {
    const original = $(id).onclick;
    $(id).onclick = (...args) => {
      identityRequest++;
      return original(...args);
    };
  }
  $("identity-photo-refresh").onclick = () => run(refreshIdentityPhoto);
  $("profile-photoUrl").addEventListener("change", () =>
    run(refreshIdentityPhoto),
  );
  $("profile-nick").addEventListener("change", () => run(refreshIdentityPhoto));
  $("network-dialog").addEventListener("close", () => identityRequest++);
  $("identity-photo-enlarge").onclick = () =>
    run(() =>
      showPhoto(
        $("profile-id").value,
        $("profile-nick").value,
        $("profile-photoUrl").value || DEFAULT_PHOTOS,
      ),
    );
  $("profile-photo-preview").onclick = $("identity-photo-enlarge").onclick;
  // Emoji insertion uses the current cursor and preserves the message draft.
  const emoji = floating("emoji-dialog", "Emojis", true),
    search = field(emoji.body, "Buscar emojis", "search", ""),
    grid = el("div", "emoji-grid");
  emoji.body.append(grid);
  const groups = [
    [
      "Caras",
      "😀 😃 😄 😁 😆 😅 😂 🤣 😊 🙂 🙃 😉 😍 🥰 😘 😎 🤔 🙄 😢 😭 😡 🥳 😴 🤗 🤩 🫶",
    ],
    ["Animales", "🦆 🐥 🐣 🐤 🐔 🐧 🐦 🐶 🐱 🐈 🐕 🐼 🐻 🦊 🦋 🐝 🦄 🐸"],
    [
      "Corazones y gestos",
      "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💕 💖 💔 💋 👍 👎 👏 🙌 👋 🤝 💪 🙏",
    ],
    [
      "Naturaleza y objetos",
      "🌸 🌹 🌻 🌷 🌈 ☀️ 🌙 ⭐ ✨ 🔥 🎉 🎶 🎵 ☕ 🧉 🍕 🍰 🎂 🎁 🏠 🚗 💻 📷 ✅ ❌",
    ],
  ];
  function emojis() {
    grid.replaceChildren();
    for (const [name, items] of groups) {
      const filtered = items
        .split(" ")
        .filter(
          (e) =>
            !search.value ||
            fold(name).includes(fold(search.value)) ||
            e.includes(search.value),
        );
      if (!filtered.length) continue;
      grid.append(el("h3", "", name));
      for (const e of filtered) {
        const b = button(
          e,
          () => {
            const input = $("message-input");
            input.setRangeText(
              e,
              input.selectionStart,
              input.selectionEnd,
              "end",
            );
            input.dispatchEvent(new Event("input"));
            emoji.dialog.close();
            input.focus();
          },
          grid,
        );
        b.setAttribute("aria-label", "Insertar " + e);
      }
    }
  }
  search.oninput = emojis;
  emojis();
  const emojiButton = button(
    "☺",
    () => emoji.dialog.showModal(),
    document.querySelector("#composer .format-bar"),
  );
  emojiButton.id = "emoji-button";
  emojiButton.setAttribute("aria-label", "Abrir emojis");
  // Room appearance: use the same live preview in both themes.
  const appearance = floating("room-appearance-dialog", "Apariencia de sala"),
    appearanceForm = el("form");
  appearance.body.append(appearanceForm);
  const preview = el("div", "room-live-preview");
  appearance.body.prepend(preview);
  let appearanceFields = {};
  function fillAppearance() {
    appearanceForm.replaceChildren();
    const grid = el("div", "appearance-grid"),
      nickSettings = el("div", "appearance-nicks"),
      actions = el("div", "appearance-actions");
    appearanceForm.append(grid, nickSettings, actions);
    const a = config.settings.roomAppearance || {};
    appearanceFields = {};
    for (const [key, label, fallback] of [
      [
        "background",
        "Fondo de sala",
        getComputedStyle(document.documentElement)
          .getPropertyValue("--bg")
          .trim(),
      ],
      [
        "inputBackground",
        "Fondo del cuadro de texto",
        getComputedStyle(document.documentElement)
          .getPropertyValue("--surface")
          .trim(),
      ],
      [
        "text",
        "Color del texto",
        getComputedStyle(document.documentElement)
          .getPropertyValue("--text")
          .trim(),
      ],
    ])
      appearanceFields[key] = field(grid, label, "color", a[key] || fallback);
    const font = field(grid, "Fuente", "select");
    for (const name of ["Segoe UI", "Consolas", "Arial", "Cascadia Mono"])
      font.append(el("option", "", name));
    font.value = config.settings.fontFamily;
    appearanceFields.font = font;
    const size = field(
      grid,
      "Tamaño de letra",
      "number",
      config.settings.fontSize,
    );
    size.min = 11;
    size.max = 24;
    appearanceFields.size = size;
    const style = field(grid, "Estilo", "select");
    for (const [v, t] of [
      ["normal", "Normal"],
      ["bold", "Negrita"],
      ["italic", "Cursiva"],
      ["bold italic", "Negrita y cursiva"],
    ]) {
      const option = el("option", "", t);
      option.value = v;
      style.append(option);
    }
    style.value = a.style || "normal";
    appearanceFields.style = style;
    appearanceFields.nicks = field(
      nickSettings,
      "Nicks coloreados",
      "checkbox",
      config.settings.coloredNicks !== false,
    );
    const ownColor = field(
      nickSettings,
      "Color del propio nick",
      "color",
      config.settings.ownNickColor || "#c0adf1",
    );
    function update() {
      preview.style.backgroundColor = appearanceFields.background.value;
      preview.replaceChildren(
        el(
          "strong",
          "",
          "[12:34] {" + (active ? network(active.id).nick : "TuNick") + "}",
        ),
      );
      const text = el("p");
      DreamsFormatting.render(
        text,
        "\x0313Bienvenidos\x0f 🦆 Texto de ejemplo",
      );
      preview.append(text);
      const input = el("div", "preview-input", "Escribir mensaje…");
      input.style.backgroundColor = appearanceFields.inputBackground.value;
      preview.append(input);
      preview.style.backgroundColor = appearanceFields.background.value;
      preview.style.color = appearanceFields.text.value;
      preview.style.fontFamily = font.value + ", sans-serif";
      preview.style.fontSize = size.value + "px";
      preview.style.fontWeight = style.value.includes("bold") ? "700" : "400";
      preview.style.fontStyle = style.value.includes("italic")
        ? "italic"
        : "normal";
      preview.querySelector("strong").style.color = appearanceFields.nicks
        .checked
        ? ownColor.value
        : "inherit";
    }
    appearanceForm.oninput = update;
    update();
    button(
      "Guardar apariencia",
      async () => {
        config.settings.fontFamily = font.value;
        config.settings.fontSize = Math.max(
          11,
          Math.min(24, Number(size.value) || 14),
        );
        config.settings.coloredNicks = appearanceFields.nicks.checked;
        config.settings.ownNickColor = ownColor.value;
        config.settings.roomAppearance = {
          background: appearanceFields.background.value,
          inputBackground: appearanceFields.inputBackground.value,
          text: appearanceFields.text.value,
          style: style.value,
        };
        await persist();
        applySettings();
        render();
        appearance.dialog.close();
      },
      actions,
    );
    button(
      "Restaurar apariencia del tema",
      async () => {
        config.settings.roomAppearance = {};
        config.settings.coloredNicks = true;
        config.settings.fontFamily = "Segoe UI";
        config.settings.fontSize = 14;
        await persist();
        applySettings();
        render();
        fillAppearance();
      },
      actions,
    );
  }
  const baseApply = applySettings;
  applySettings = function () {
    baseApply();
    const a = config.settings.roomAppearance || {},
      messages = $("messages");
    document.body.classList.toggle(
      "plain-nicks",
      config.settings.coloredNicks === false,
    );
    for (const [k, v] of Object.entries({
      backgroundColor: a.background || "",
      color: a.text || "",
      fontWeight: a.style?.includes("bold") ? "700" : "",
      fontStyle: a.style?.includes("italic") ? "italic" : "",
    }))
      messages.style[k] = v;
    const background =
      a.background || getComputedStyle(messages).backgroundColor;
    messages.style.color = DreamsFormatting.readableColor(
      a.text ||
        getComputedStyle(document.documentElement)
          .getPropertyValue("--text")
          .trim(),
      background,
    );
    messages.style.setProperty(
      "--room-muted",
      DreamsFormatting.readableColor(
        getComputedStyle(document.documentElement)
          .getPropertyValue("--muted")
          .trim(),
        background,
      ),
    );
    messages.style.setProperty(
      "--room-own",
      DreamsFormatting.readableColor(
        config.settings.ownNickColor || "#c0adf1",
        background,
      ),
    );
    const composer = document.querySelector(".composer-input");
    composer.style.backgroundColor = a.inputBackground || "";
    composer.style.color = DreamsFormatting.readableColor(
      getComputedStyle(document.documentElement)
        .getPropertyValue("--text")
        .trim(),
      getComputedStyle(composer).backgroundColor,
    );
    applyComposerStyle();
    for (const [key, color] of Object.entries({
      join: "#6dc7a1",
      part: "#d8b541",
      quit: "#e07878",
    }))
      messages.style.setProperty(
        "--room-" + key,
        DreamsFormatting.readableColor(color, background, 3),
      );
  };
  const appearanceButton = button(
    "◐",
    () => {
      fillAppearance();
      appearance.dialog.showModal();
    },
    document.querySelector(".chat-tools"),
  );
  appearanceButton.id = "room-appearance-button";
  appearanceButton.setAttribute("aria-label", "Apariencia de sala");
  // LIST results are bounded and rendered as text, with a substring search.
  const rooms = el("section", "room-browser");
  const sorting = field(rooms, "Orden de salas", "select");
  for (const [value, text] of [
    ["members", "Más miembros"],
    ["name", "Alfabético"],
  ]) {
    const o = el("option", "", text);
    o.value = value;
    sorting.append(o);
  }
  const roomStatus = el("p", "muted"),
    roomList = el("div", "room-results");
  rooms.append(roomStatus, roomList);
  document.querySelector("#join-dialog .form-content").append(rooms);
  let roomNetwork = null,
    roomRows = new Map(),
    roomComplete = false,
    roomFrame = false;
  function renderRooms() {
    roomFrame = false;
    const query = fold($("join-channel").value.replace(/^#/, ""));
    const rows = [...roomRows.values()].filter((r) =>
      fold(r.name.replace(/^#/, "")).includes(query),
    );
    rows.sort(
      sorting.value === "name"
        ? (a, b) => a.name.localeCompare(b.name)
        : (a, b) => b.members - a.members || a.name.localeCompare(b.name),
    );
    roomList.replaceChildren();
    roomStatus.textContent =
      (roomComplete ? "Salas disponibles" : "Cargando salas…") +
      " · " +
      rows.length +
      (rows.length > 300 ? " · se muestran las primeras 300" : "");
    for (const r of rows.slice(0, 300)) {
      const row = el("div", "room-result"),
        b = button(
          r.name + " · " + r.members,
          async () => {
            const result = await api.send({
              id: roomNetwork,
              target: "*",
              text: "/join " + r.name,
            });
            if (result?.error) throw new Error(result.error);
            $("join-dialog").close();
          },
          row,
        );
      b.title = "Unirse a " + r.name;
      const topic = el("div", "room-result-topic");
      DreamsFormatting.render(topic, r.topic);
      row.append(topic);
      roomList.append(row);
    }
  }
  sorting.onchange = renderRooms;
  $("join-channel").addEventListener("input", renderRooms);
  const baseOpenJoin = openJoin;
  openJoin = function () {
    baseOpenJoin();
    if (!$("join-dialog").open) return;
    roomNetwork = active.id;
    roomRows = new Map();
    roomComplete = false;
    renderRooms();
    if (api.advanced)
      call("rooms.list", { network: roomNetwork }).catch((e) => {
        roomStatus.textContent = e.message;
      });
  };
  button(
    "Actualizar lista",
    () => call("rooms.list", { network: roomNetwork }),
    rooms,
  );
  $("join-channel").placeholder = "Buscar sala o escribir su nombre";
  $("join-button").textContent = "＋ Unirse a sala";
  const certificate = floating(
    "certificate-dialog",
    "Certificado TLS de la red",
  );
  function showCertificate(event) {
    certificate.body.replaceChildren();
    for (const [label, value] of [
      ["Servidor", event.host + ":" + event.port],
      ["Motivo", event.reason],
      ["Titular", JSON.stringify(event.subject || {})],
      ["Emisor", JSON.stringify(event.issuer || {})],
      ["Válido desde", event.validFrom],
      ["Válido hasta", event.validTo],
      ["Huella SHA-256", event.fingerprint],
    ])
      certificate.body.append(
        el("p", "certificate-detail", label + ": " + (value || "—")),
      );
    button(
      "Aceptar y guardar para esta red",
      async () => {
        await call("tls.accept", {
          network: event.id,
          fingerprint: event.fingerprint,
        });
        certificate.dialog.close();
      },
      certificate.body,
    );
    button("Cancelar", () => certificate.dialog.close(), certificate.body);
    if (!certificate.dialog.open) certificate.dialog.showModal();
  }
  if (api.advanced)
    api.onEvent((event) => {
      if(event.type==="status"&&event.state==="disconnected"&&viewing?.id===event.id)closeProfile();
      if (event.type === "certificate" && !event.trusted)
        showCertificate(event);
      if (
        event.type === "user-profile" &&
        viewing?.id === event.id &&
        fold(viewing.nick) === fold(event.nick)
      ) {
        const d = viewing.details,
          p = event.params;
        switch (event.code) {
          case "311":
            Object.assign(d, {
              ident: p[0],
              host: p[1],
              realName: event.realName ?? p[3],
            });
            break;
          case "312":
            d.server = p[0];
            break;
          case "317": {
            const seconds = Number(p[0]);
            d.idle = Number.isFinite(seconds)
              ? Math.floor(seconds / 3600) +
                " h " +
                Math.floor((seconds % 3600) / 60) +
                " min " +
                (seconds % 60) +
                " s"
              : "—";
            break;
          }
          case "319":
            d.channels = [d.channels, p[0]].filter(Boolean).join(" ");
            break;
          case "330":
            d.account = p[0];
            break;
          case "301":
            d.away = p[0];
            break;
          case "402":
            d.error = "El usuario o su servidor no está disponible.";
            d.complete = true;
            break;
          case "401":
            d.error = "El usuario no está conectado.";
            d.complete = true;
            break;
          case "318":
            d.complete = true;
            break;
        }
        showProfile();
      }
      if (event.type === "room-list" && event.id === roomNetwork) {
        if (event.reset) roomRows.clear();
        if (event.name && roomRows.size < 20000)
          roomRows.set(fold(event.name), event);
        if (event.complete) roomComplete = true;
        if (!roomFrame) {
          roomFrame = true;
          requestAnimationFrame(renderRooms);
        }
      }
      if (
        event.type === "nick" &&
        viewing?.id === event.id &&
        fold(viewing.nick) === fold(event.old)
      ) {
        viewing.nick = event.nick;
        showProfile();
      }
    });
  if (api.advanced)
    api
      .load()
      .then(async (c) => {
        if (!c.settings.photoDefaultsVersion) {
          config.settings.photoDefaultsVersion = 1;
          config.settings.autoAvatars = true;
          config.settings.mediaEnabled = true;
          config.settings.showAvatars = true;
          config.settings.avatarUrlTemplate = DEFAULT_PHOTOS;
          await persist();
          render();
        }
      })
      .catch((e) => notify(e.message, true));
  applySettings();
})();
