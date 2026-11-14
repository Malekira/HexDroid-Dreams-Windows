"use strict";
(() => {
  const form = $("network-form"),
    body = form.querySelector(".form-content"),
    old = [...body.children],
    label = (id) => $(id).closest("label");
  form.classList.add("network-editor");
  body.classList.add("network-editor-body");
  function icon(kind) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    for (const d of {
      network: [
        "M12 8v5M5 17v-4h14v4",
        "M9 2h6v6H9zM2 17h6v5H2zM9 17h6v5H9zM16 17h6v5h-6z",
      ],
      user: [
        "M17 7a5 5 0 1 1-10 0 5 5 0 0 1 10 0",
        "M3 23v-3a9 9 0 0 1 18 0v3z",
      ],
      photo: ["M2 3h20v18H2z", "M2 17l6-6 4 4 3-3 7 7", "M17 7h.01"],
      settings: [
        "M9 2h6l1 4 4 1 2 5-3 3 1 5-5 2-3-3-5 1-2-5 3-3-1-5 4-1z",
        "M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
      ],
    }[kind]) {
      const p = document.createElementNS(svg.namespaceURI, "path");
      p.setAttribute("d", d);
      svg.append(p);
    }
    return svg;
  }
  function card(id, title, kind) {
    const s = el("section", "network-card");
    s.id = id;
    const h = el("h3");
    h.append(icon(kind), document.createTextNode(title));
    s.append(h);
    body.append(s);
    return s;
  }
  const settings = card(
      "network-card-settings",
      "Configuración de la red",
      "network",
    ),
    identity = card("network-card-identity", "Identidad de esta red", "user"),
    avatar = card("network-card-avatar", "Foto / Avatar", "photo"),
    connection = card(
      "network-card-connection",
      "Conexión y comandos",
      "settings",
    );
  settings.append(
    $("profile-id"),
    label("profile-name"),
    $("profile-host").closest(".form-grid"),
    label("profile-tls"),
  );
  const names = el("div", "network-name-grid");
  names.append(
    label("profile-nick"),
    label("profile-username"),
    label("profile-alternateNick"),
  );
  identity.append(
    names,
    $("profile-realName").closest(".realname-field"),
    label("profile-customText"),
  );
  const styles = $("profile-ownNickColor").closest(".identity-style-grid");
  styles.classList.add("network-style-row");
  identity.append(styles);
  const photoSource = label("profile-photoUrl"),
    publish = label("profile-publishPhoto"),
    photoNotes = old.filter(
      (n) => n.matches("p.note") && /foto|dirección HTTPS/.test(n.textContent),
    ),
    photo = el("div", "network-photo-grid"),
    visual = el("div", "network-photo-visual"),
    placeholder = el("div", "network-photo-placeholder", "✦"),
    options = el("div", "network-photo-options"),
    buttons = el("div", "network-photo-buttons");
  placeholder.setAttribute("aria-label", "Sin foto seleccionada");
  visual.append($("profile-photo-preview"), placeholder);
  buttons.append(
    $("identity-photo-refresh"),
    $("identity-photo-enlarge"),
    $("profile-photo-choose"),
    $("profile-photo-remove"),
  );
  options.append(photoSource, publish, ...photoNotes, buttons);
  const localNote = body.querySelector(".identity-photo .note");
  if (localNote) options.append(localNote);
  photo.append(visual, options);
  avatar.append(photo);
  const columns = el("div", "network-connection-grid"),
    commands = el("div", "network-commands"),
    fields = el("div", "network-connection-fields");
  commands.append(label("profile-commands"));
  fields.append(
    label("profile-channels"),
    label("profile-password"),
    label("profile-commandDelay"),
  );
  columns.append(commands, fields);
  connection.append(columns);
  const error = $("network-error");
  body.append(error);
  // Keep any additional controls introduced by another feature in this form.
  const extra = el("div", "network-extra-fields");
  for (const n of old) {
    if (n.parentElement !== body || n === error) continue;
    if (n.matches("h3")) {
      n.remove();
      continue;
    }
    if (
      !n.querySelector("input,select,textarea,button,[contenteditable]") &&
      !n.matches("input,select,textarea,button,p.note")
    ) {
      n.remove();
      continue;
    }
    if (n !== error) extra.append(n);
  }
  if (extra.children.length) connection.append(extra);
  const rooms = $("join-button"),
    menu = el("div", "menu-flyout rooms-quick-popup");
  menu.id = "rooms-quick-popup";
  menu.setAttribute("popover", "auto");
  menu.setAttribute("role", "menu");
  document.body.append(menu);
  rooms.removeAttribute("data-action");
  rooms.setAttribute("popovertarget", menu.id);
  rooms.setAttribute("aria-haspopup", "menu");
  rooms.setAttribute("aria-label", "Salas");
  rooms.title = "Favoritas, entrar a otra sala y listado de salas";
  const run = (fn) =>
    Promise.resolve()
      .then(fn)
      .catch((e) => notify(e.message, true));
  function action(text, fn) {
    const b = el("button", "", text);
    b.type = "button";
    b.setAttribute("role", "menuitem");
    b.onclick = () => {
      menu.hidePopover();
      run(fn);
    };
    menu.append(b);
    return b;
  }
  menu.addEventListener("beforetoggle", (e) => {
    if (e.newState !== "open") return;
    menu.replaceChildren();
    const id = active?.id || selectedNetworkId,
      entries = (config.settings.favoriteRooms || [])
        .filter((r) => r.network === id)
        .sort((a, b) => a.name.localeCompare(b.name));
    menu.append(el("div", "menu-section-label", "Favoritas"));
    if (!entries.length)
      menu.append(el("div", "menu-note", "Sin favoritas en esta red"));
    for (const r of entries)
      action(r.name, async () => {
        const result = await api.send({
          id: r.network,
          target: "*",
          text: "/join " + r.name,
        });
        if (result?.error) throw Error(result.error);
      });
    menu.append(el("hr"));
    action("Entrar a otra sala…", () => openJoin());
    action("Listado de salas", () => {
      openJoin();
      if ($("join-dialog").open)
        $("join-dialog").querySelector("h2").textContent = "Listado de salas";
    });
    action("Configurar favoritas…", () => window.openDreamsFavorites());
    const r = rooms.getBoundingClientRect();
    menu.style.left = Math.max(4, Math.min(r.left, innerWidth - 290)) + "px";
    menu.style.top = r.bottom + 3 + "px";
    menu.style.maxHeight = Math.max(100, innerHeight - r.bottom - 8) + "px";
  });
})();
