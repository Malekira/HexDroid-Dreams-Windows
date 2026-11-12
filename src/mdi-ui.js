"use strict";
// Keep one live set of the ID-based composer/profile controls. Inactive windows
// render independent views of their conversation models; selecting one moves
// the live controls into that window without duplicating DOM IDs or listeners.
(() => {
  const desktop = document.querySelector("main.chat"),
    live = el("div", "chat mdi-live-chat"),
    parking = el("div", "mdi-parking");
  for (const child of [...desktop.childNodes]) live.append(child);
  desktop.classList.remove("chat");
  desktop.classList.add("mdi-desktop");
  desktop.setAttribute("aria-label", "Escritorio de conversaciones");
  parking.append(live);
  desktop.append(parking);
  const windows = new Map(),
    minimizedBar = el("div", "mdi-minimized-bar");
  minimizedBar.hidden = true;
  minimizedBar.setAttribute("aria-label", "Conversaciones minimizadas");
  desktop.append(minimizedBar);
  function tasks() {
    minimizedBar.replaceChildren();
    for (const w of windows.values())
      if (w.minimized) {
        const b = el(
          "button",
          "",
          w.target + " · " + (profile(w.id)?.name || ""),
        );
        b.type = "button";
        b.setAttribute("aria-label", "Restaurar conversación " + w.target);
        b.onclick = () => {
          w.minimized = false;
          activate(w);
          render();
        };
        minimizedBar.append(b);
      }
    minimizedBar.hidden = !minimizedBar.children.length;
  }

  let z = 1,
    rendering = false;
  const key = (id, target) => id + "\0" + fold(target),
    isActive = (w) =>
      active?.id === w.id && fold(active.target) === fold(w.target);
  function area() {
    return {
      w: Math.max(1, desktop.clientWidth),
      h: Math.max(
        1,
        desktop.clientHeight -
          ([...windows.values()].some((w) => w.minimized) ? 28 : 0),
      ),
    };
  }
  function normal(index = 0) {
    const a = area(),
      offset = (index % 6) * 24;
    return {
      x: Math.min(offset, Math.max(0, a.w - 420)),
      y: Math.min(offset, Math.max(0, a.h - 260)),
      w: Math.min(780, a.w - offset),
      h: Math.min(580, a.h - offset),
    };
  }
  function bounds(w, a = area()) {
    if (w.maximized) return { x: 0, y: 0, w: a.w, h: a.h };
    const b = w.bounds;
    b.w = Math.max(w.tiled ? 0 : Math.min(420, a.w), Math.min(a.w, b.w));
    b.h = Math.max(w.tiled ? 0 : Math.min(240, a.h), Math.min(a.h, b.h));
    b.x = Math.max(0, Math.min(a.w - b.w, b.x));
    b.y = Math.max(0, Math.min(a.h - b.h, b.y));
    return b;
  }
  function apply(w, dimensions) {
    w.node.hidden = !!(w.minimized || w.covered);
    const b = bounds(w, dimensions);
    Object.assign(w.node.style, {
      left: "0px",
      top: "0px",
      transform: `translate(${b.x}px,${b.y}px)`,
      width: b.w + "px",
      height: b.h + "px",
    });
    w.node.classList.toggle("maximized", w.maximized);
    w.maxButton.textContent = w.maximized ? "▣" : "□";
    w.maxButton.setAttribute(
      "aria-label",
      (w.maximized ? "Restaurar" : "Maximizar") + " ventana " + w.target,
    );
  }
  function raise(w) {
    w.node.style.zIndex = String(++z);
    for (const item of windows.values())
      item.node.classList.toggle("mdi-active", item === w);
  }
  function activate(w, focus = true) {
    if (!isActive(w)) {
      choose(w.id, w.target, focus);
    } else if (
      focus &&
      !$("message-input").disabled &&
      !document.querySelector("dialog[open]")
    )
      $("message-input").focus({ preventScroll: true });
    raise(w);
  }
  function toggle(w) {
    w.maximized = !w.maximized;
    apply(w);
    activate(w);
    render(true);
  }
  function drag(w, node, direction) {
    let start = null,
      geometryFrame = null;
    node.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || e.target.closest("button")) return;
      e.preventDefault();
      raise(w);
      w.tiled = false;
      if (w.maximized) {
        w.maximized = false;
        w.bounds = normal();
        const a = desktop.getBoundingClientRect();
        w.bounds.x = e.clientX - a.left - w.bounds.w * 0.4;
        w.bounds.y = e.clientY - a.top - 12;
        apply(w);
        render(true);
      }
      start = { x: e.clientX, y: e.clientY, b: { ...bounds(w) }, area: area() };
      node.setPointerCapture(e.pointerId);
    });
    node.addEventListener("pointermove", (e) => {
      if (!start) return;
      const dx = e.clientX - start.x,
        dy = e.clientY - start.y,
        b = { ...start.b },
        a = start.area;
      if (!direction) {
        b.x += dx;
        b.y += dy;
      } else {
        const minW = Math.min(420, a.w),
          minH = Math.min(240, a.h);
        if (direction.includes("e"))
          b.w = Math.max(minW, Math.min(a.w - b.x, b.w + dx));
        if (direction.includes("s"))
          b.h = Math.max(minH, Math.min(a.h - b.y, b.h + dy));
        if (direction.includes("w")) {
          b.x = Math.max(
            0,
            Math.min(start.b.x + start.b.w - minW, start.b.x + dx),
          );
          b.w = start.b.w + start.b.x - b.x;
        }
        if (direction.includes("n")) {
          b.y = Math.max(
            0,
            Math.min(start.b.y + start.b.h - minH, start.b.y + dy),
          );
          b.h = start.b.h + start.b.y - b.y;
        }
      }
      w.bounds = b;
      if (geometryFrame === null)
        geometryFrame = requestAnimationFrame(() => {
          geometryFrame = null;
          apply(w, start?.area);
        });
    });
    for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
      node.addEventListener(event, () => {
        if (!start) return;
        if (geometryFrame !== null) {
          cancelAnimationFrame(geometryFrame);
          geometryFrame = null;
          apply(w, start.area);
        }
        start = null;
        activate(w);
      });
  }
  function create(id, c) {
    const w = {
      id,
      target: c.name,
      bounds: normal(windows.size),
      maximized: true,
      signature: null,
    };
    w.node = el("section", "mdi-window");
    w.node.setAttribute("aria-label", "Ventana " + c.name);
    w.node.dataset.network = id;
    w.node.dataset.target = c.name;
    w.header = el("header", "mdi-titlebar");
    w.title = el("strong", "mdi-title");
    w.maxButton = el("button", "mdi-window-control", "▣");
    w.maxButton.type = "button";
    const close = el("button", "mdi-window-control", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Cerrar ventana " + c.name);
    w.minButton = el("button", "mdi-window-control", "−");
    w.minButton.type = "button";
    w.minButton.setAttribute("aria-label", "Minimizar ventana " + c.name);
    w.usersButton = el("button", "mdi-window-control mdi-users-button", "♙");
    w.usersButton.type = "button";
    w.usersButton.onclick = (e) => {
      e.stopPropagation();
      activate(w, false);
      togglePanel("showUsers");
    };
    w.minButton.onclick = (e) => {
      e.stopPropagation();
      captureConversation();
      w.minimized = true;
      if (isActive(w)) {
        const next = [...windows.values()].find(
          (other) => other !== w && !other.minimized,
        );
        if (next) choose(next.id, next.target);
        else {
          active = null;
          workspace.active = null;
          $("message-input").value = "";
        }
      }
      render();
      persist().catch(() => {});
    };
    w.header.append(w.title, w.usersButton, w.minButton, w.maxButton, close);
    w.host = el("div", "mdi-window-content");
    w.mirror = el("div", "mdi-mirror");
    w.host.append(w.mirror);
    w.node.append(w.header, w.host);
    w.node.style.zIndex = "1";
    desktop.append(w.node);
    windows.set(key(id, c.name), w);
    w.maxButton.onclick = (e) => {
      e.stopPropagation();
      toggle(w);
    };
    close.onclick = (e) => {
      e.stopPropagation();
      closeConversation(id, w.target).catch((err) => notify(err.message, true));
    };
    w.header.ondblclick = (e) => {
      if (!e.target.closest("button")) toggle(w);
    };
    drag(w, w.header);
    for (const direction of ["n", "s", "e", "w", "ne", "nw", "se", "sw"]) {
      const grip = el("div", "mdi-grip mdi-grip-" + direction);
      grip.dataset.direction = direction;
      if (direction === "se") {
        grip.tabIndex = 0;
        grip.setAttribute("role", "separator");
        grip.setAttribute("aria-label", "Tamaño de ventana " + c.name);
        grip.onkeydown = (e) => {
          if (
            !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
          )
            return;
          e.preventDefault();
          w.maximized = false;
          w.bounds.w +=
            e.key === "ArrowRight" ? 20 : e.key === "ArrowLeft" ? -20 : 0;
          w.bounds.h +=
            e.key === "ArrowDown" ? 20 : e.key === "ArrowUp" ? -20 : 0;
          apply(w);
        };
      }
      drag(w, grip, direction);
      w.node.append(grip);
    }
    w.node.addEventListener("pointerdown", () => raise(w));
    w.node.addEventListener(
      "click",
      (e) => {
        if (e.target.closest(".mdi-window-control")) return;
        if (
          isActive(w) &&
          (e.target.closest(
            "button,a,input,textarea,select,[contenteditable],[role=separator]",
          ) ||
            window.getSelection()?.toString())
        )
          return;
        const user = e.target.closest("[data-mdi-user]")?.dataset.mdiUser;
        activate(w);
        if (user) window.openDreamsUser?.(w.id, user);
      },
      true,
    );
    w.node.addEventListener("focusin", (e) => {
      if (!isActive(w) && e.target.matches("textarea")) activate(w);
    });
    apply(w);
    return w;
  }
  function fillMirror(w, c) {
    const s = config.settings,
      contentKey = JSON.stringify([
        c.revision,
        c.messages.length,
        c.messages.at(-1),
        c.muted,
        network(w.id).avatarRevision,
      ]);
    if (w.contentKey === contentKey) return;
    w.contentKey = contentKey;
    const messages = w.messageSurface,
      events = w.eventSurface,
      split = c.kind === "channel" && s.roomView === "split";
    const context = window.getDreamsMessageContext(w.id, c);

    messages.style.setProperty(
      "--room-own",
      DreamsFormatting.readableColor(
        profile(w.id)?.ownNickColor || s.ownNickColor || "#c0adf1",
        context.background,
      ),
    );
    messages.style.setProperty(
      "--own-nick-color",
      profile(w.id)?.ownNickColor || s.ownNickColor || "#c0adf1",
    );
    messages.style.setProperty(
      "--mention-background",
      "color-mix(in srgb, var(--mention-border) 26%, " +
        context.background +
        ")",
    );
    const messageNodes = [],
      eventNodes = [];
    let day = "";
    for (const m of c.messages) {
      if (
        (c.kind === "server" &&
          window.DreamsStatus &&
          !DreamsStatus.visible(m, s.statusFilters)) ||
        (m.event &&
          !s.showEvents &&
          c.kind !== "queries" &&
          c.kind !== "server" &&
          m.eventType !== "presence" &&
          !m.error) ||
        (m.eventType === "clones" && s.showClones === false)
      )
        continue;
      const destination = split && m.event ? eventNodes : messageNodes,
        date = new Date(m.time),
        label = window.dreamsMessageDay(date);
      if (destination === messageNodes && label && label !== day) {
        day = label;
        messageNodes.push(el("div", "message-day", label));
      }
      const row = window.getDreamsMessageRow(w.id, c, m, context);
      row.querySelector(".message-text")?.classList.add("mdi-text");
      destination.push(row);
    }
    window.syncDreamsMessageChildren(messages, messageNodes);
    window.syncDreamsMessageChildren(events, eventNodes);
    if (c.follow && s.autoScroll !== false)
      messages.scrollTop = messages.scrollHeight;
    else messages.scrollTop = c.scrollTop || 0;
  }
  function mirror(w, c) {
    if (isActive(w) || w.minimized || w.covered) return;
    w.mirror.hidden = false;
    const s = config.settings,
      n = network(w.id),
      signature = JSON.stringify([
        c.showUsers,
        c.searchOpen,
        c.searchQuery,
        c.profileVisible,
        profile(w.id)?.ownNickColor,
        profile(w.id)?.mentionHighlightColor,
        c.users,
        c.topic,
        c.modes,
        n.state,
        c.joined,
        c.muted,
        { ...s, dictionary: undefined, nickCompletion: undefined },
      ]);
    if (signature === w.signature) {
      if (w.avatarRevision !== n.avatarRevision) {
        for (const button of w.mirror.querySelectorAll(
          ".mdi-user[data-nick]",
        )) {
          const nick = button.dataset.nick,
            photo = avatarFor(w.id, nick);
          if (button._photo === photo) continue;
          button._photo = photo;
          const picture = button.querySelector(".user-avatar");
          picture.replaceChildren();
          if (photo) {
            const img = el("img");
            img.src = photo;
            img.alt = nick;
            picture.append(img);
          } else picture.textContent = nick.slice(0, 2).toUpperCase();
        }
        w.avatarRevision = n.avatarRevision;
      }
      fillMirror(w, c);
      const field = w.mirror.querySelector("textarea");
      if (field && document.activeElement !== field) field.value = c.draft;
      return;
    }
    w.signature = signature;
    w.avatarRevision = n.avatarRevision;
    w.mirror.replaceChildren();
    w.mirror.hidden = false;
    if (c.topic && s.showTopic !== false) {
      const topic = el("section", "topic-panel mdi-topic"),
        text = el("p", "mdi-topic-text");
      DreamsFormatting.render(text, c.topic);
      if (Number.isFinite(s.topicHeight))
        text.style.height = s.topicHeight + "px";
      topic.append(text);
      w.mirror.append(topic);
      const divider = el("div", "topic-height-resizer");
      divider.tabIndex = 0;
      divider.setAttribute("role", "separator");
      divider.setAttribute("aria-label", "Altura del topic de " + c.name);
      divider.setAttribute("aria-orientation", "horizontal");
      for (const event of ["pointerdown", "keydown", "dblclick"])
        divider["on" + event] = (e) => {
          activate(w);
          $("topic-height-resizer")["on" + event]?.(e);
        };
      w.mirror.append(divider);
    }
    const body = el("div", "mdi-body"),
      timeline = el("div", "mdi-timeline"),
      messages = el("div", "mdi-messages");
    messages.setAttribute("role", "log");
    messages.setAttribute("aria-label", "Mensajes de " + c.name);
    const a = s.roomAppearance || {};
    messages.style.cssText = $("messages").style.cssText;
    messages.style.setProperty(
      "--mention-border",
      profile(w.id)?.mentionHighlightColor ||
        s.mentionHighlightColor ||
        "#7650aa",
    );
    messages.style.background = a.background || "var(--bg)";
    messages.style.color = $("messages").style.color || a.text || "var(--text)";
    messages.style.fontFamily = getComputedStyle($("messages")).fontFamily;
    messages.style.fontSize = (s.fontSize || 14) + "px";
    const events = el("div", "mdi-events"),
      split = c.kind === "channel" && s.roomView === "split";
    if (split) {
      events.setAttribute("role", "log");
      events.setAttribute("aria-label", "Eventos de " + c.name);
      events.style.flex = "0 0 " + (s.eventsPanePercent || 25) + "%";
      events.append(el("header", "", "Eventos de sala"));
    }
    messages.classList.add("messages");
    events.classList.add("event-message-list");
    w.messageSurface = messages;
    w.eventSurface = events;
    w.contentKey = null;
    fillMirror(w, c);
    const form = el("form", "mdi-composer"),
      input = el("textarea"),
      send = el("button", "", "↑");
    const writing = effectiveComposerSettings(w.id),
      inputBackground =
        a.inputBackground ||
        getComputedStyle($("message-input")).backgroundColor;
    input.style.background = inputBackground;
    input.style.color = DreamsFormatting.readableColor(
      a.inputText ||
        writing.textColor ||
        getComputedStyle(document.documentElement)
          .getPropertyValue("--text")
          .trim(),
      inputBackground,
    );
    input.style.fontWeight = writing.composerBold ? "700" : "";
    input.style.fontStyle = writing.composerItalic ? "italic" : "";
    input.style.textDecoration = writing.composerUnderline ? "underline" : "";
    input.style.fontFamily = getComputedStyle($("message-input")).fontFamily;
    input.style.fontSize = (s.fontSize || 14) + "px";
    input.value = c.draft;
    input.rows = 1;
    input.spellcheck = true;
    input.lang = "es";
    input.setAttribute("aria-label", "Escribir en " + c.name);
    input.placeholder = "Mensaje a " + c.name + "…";
    input.disabled =
      n.state !== "connected" || (c.kind === "channel" && !c.joined);
    send.type = "submit";
    send.setAttribute("aria-label", "Enviar a " + c.name);
    send.disabled = input.disabled;
    input.oninput = () => (c.draft = input.value);
    form.onsubmit = (e) => {
      e.preventDefault();
      c.draft = input.value;
      activate(w);
      $("composer").requestSubmit();
    };
    const styleButton = el(
      "button",
      "mdi-style-button mdi-window-control",
      "A✎",
    );
    styleButton.type = "button";
    styleButton.setAttribute("aria-label", "Estilos de escritura de " + c.name);
    styleButton.title = "Estilos de escritura";
    styleButton.disabled = input.disabled;
    styleButton.onclick = () => {
      activate(w);
      window.openDreamsComposerStyles?.();
    };
    form.append(input, styleButton, send);
    const search = window.createDreamsConversationSearch?.(w.id, c);
    if (search) timeline.append(search);
    timeline.append(messages);
    if (split) timeline.append(events);
    timeline.append(form);
    body.append(timeline);
    if (conversationShowsUsers(c)) {
      const users = el("aside", "mdi-users");
      users.style.width = users.style.flexBasis =
        DreamsWorkspace.panelSizes(innerWidth, { ...s, showUsers: true })
          .right + "px";
      users.setAttribute("aria-label", "Usuarios de " + c.name);
      users.append(
        el(
          "div",
          "mdi-users-title",
          c.kind === "private" ? "Usuario" : "Usuarios · " + c.users.length,
        ),
      );
      const search = el("input");
      search.placeholder = "Buscar usuario…";
      search.setAttribute("aria-label", "Buscar usuarios de " + c.name);
      search.hidden = !c.userSearchOpen;
      search.value = c.userQuery || "";
      const magnify = el("button", "user-search-toggle", "⌕");
      magnify.type = "button";
      magnify.setAttribute("aria-label", "Buscar en usuarios de " + c.name);
      magnify.onclick = (e) => {
        e.stopPropagation();
        c.userSearchOpen = !c.userSearchOpen;
        search.hidden = !c.userSearchOpen;
        if (c.userSearchOpen) search.focus();
        else {
          c.userQuery = "";
          search.value = "";
          search.dispatchEvent(new Event("input"));
        }
      };
      users.firstElementChild.append(magnify);
      users.append(search);
      search.oninput = () => {
        c.userQuery = search.value;
        for (const b of users.querySelectorAll(".mdi-user"))
          b.hidden = !fold(b.dataset.nick).includes(fold(search.value));
      };
      const usersList = el("div", "user-list");
      users.append(usersList);
      const rank = (user) => {
        const i = n.prefixes.indexOf(user[0]);
        return i < 0 ? 999 : i;
      };
      const names = [...c.users].sort(
        (a, b) => rank(a) - rank(b) || a.localeCompare(b),
      );
      for (const raw of names) {
        const name = bareNick(raw, n),
          b = el("button", "mdi-user");
        b.type = "button";
        b.dataset.mdiUser = name;
        b.classList.toggle("operator", !!statusPrefix(raw, n));
        b.setAttribute("aria-label", "Perfil de " + name + " en " + c.name);
        const picture = el(
            "span",
            "user-avatar",
            name.slice(0, 2).toUpperCase(),
          ),
          source = avatarFor(w.id, name);
        b.dataset.nick = name;
        b.hidden = !!c.userQuery && !fold(name).includes(fold(c.userQuery));
        b._photo = source;
        if (source) {
          const img = el("img");
          img.src = source;
          img.alt = name;
          picture.replaceChildren(img);
        }
        b.append(picture, el("span", "user-name", raw));
        usersList.append(b);
      }
      body.append(users);
      usersList.scrollTop = c.userScroll || 0;
      usersList.onscroll = () => {
        c.userScroll = usersList.scrollTop;
      };
    }
    w.mirror.append(body);
    messages.scrollTop = c.follow ? messages.scrollHeight : c.scrollTop;
    if (split) {
      events.scrollTop =
        c.eventsFollow === false ? c.eventScrollTop || 0 : events.scrollHeight;
      events.onscroll = () => {
        c.eventScrollTop = events.scrollTop;
        c.eventsFollow =
          events.scrollHeight - events.scrollTop - events.clientHeight < 60;
      };
    }
    messages.onscroll = () => {
      c.scrollTop = messages.scrollTop;
      c.follow =
        messages.scrollHeight - messages.scrollTop - messages.clientHeight < 60;
    };
  }
  function sync() {
    if (active && profile(active.id)) conversation(active.id, active.target);
    tasks();
    const dimensions = area();
    const desired = new Set(),
      activeMaximized = active
        ? (windows.get(key(active.id, active.target))?.maximized ?? true)
        : false;
    for (const [id, n] of networks)
      for (const c of n.conversations.values()) {
        const k = key(id, c.name);
        if (
          c.kind === "server" &&
          !windows.has(k) &&
          !(active?.id === id && fold(active.target) === fold(c.name))
        )
          continue;
        desired.add(k);
        let w = windows.get(k);
        if (!w) w = create(id, c);
        w.covered = activeMaximized && !isActive(w);
        w.host.style.background =
          config.settings.roomAppearance?.windowBackground || "var(--bg)";
        w.title.textContent =
          (c.kind === "server" ? "Status" : c.name) +
          (c.modes ? " " + c.modes : "") +
          " · " +
          (profile(id)?.name || "");
        w.usersButton.hidden = c.kind !== "channel" && !c.profileVisible;
        const shown = conversationShowsUsers(c);
        w.usersButton.setAttribute(
          "aria-label",
          (shown ? "Ocultar" : "Mostrar") +
            " usuarios" +
            (isActive(w) ? "" : " de " + c.name),
        );
        w.usersButton.setAttribute("aria-pressed", String(shown));
        if (isActive(w)) {
          w.minimized = false;
          w.mirror.hidden = true;
          w.contentKey = null;
          if (live.parentElement !== w.host) w.host.append(live);
          w.node.classList.add("mdi-active");
        } else {
          w.node.classList.remove("mdi-active");
          if (live.parentElement === w.host) parking.append(live);
        }
        apply(w, dimensions);
      }
    for (const [k, w] of windows)
      if (!desired.has(k)) {
        if (w.host.contains(live)) parking.append(live);
        w.node.remove();
        windows.delete(k);
      }
    tasks();

    if (!active) {
      parking.hidden = [...windows.values()].some((w) => w.minimized);
      if (live.parentElement !== parking) parking.append(live);
    } else {
      parking.hidden = true;
      const w = windows.get(key(active.id, active.target));
      if (w) {
        w.mirror.hidden = true;
        if (live.parentElement !== w.host) w.host.append(live);
        if (w.node.style.zIndex === "1") raise(w);
      }
    }
  }
  const baseRender = render;
  render = function (...args) {
    if (rendering) return baseRender(...args);
    rendering = true;
    try {
      sync();
      baseRender(...args);
      for (const [id, n] of networks)
        for (const c of n.conversations.values()) {
          const w = windows.get(key(id, c.name));
          if (w) mirror(w, c);
        }
    } finally {
      rendering = false;
    }
  };
  const baseApply = applySettings;
  applySettings = function (...args) {
    const r = baseApply(...args);
    requestAnimationFrame(() => render(true));
    return r;
  };
  const baseChoose = choose;
  choose = function (...args) {
    const result = baseChoose(...args);
    const w = active && windows.get(key(active.id, active.target));
    if (w) raise(w);
    return result;
  };
  window.closeDreamsNetworkWindows = (id) => {
    for (const [k, w] of windows)
      if (w.id === id) {
        if (w.host.contains(live)) parking.append(live);
        w.node.remove();
        windows.delete(k);
      }
  };
  window.arrangeDreamsWindows = (mode) => {
    const list = [...windows.values()].filter(
        (w) => mode === "maximize-all" || !w.minimized,
      ),
      a = area();
    if (!list.length) return;
    if (mode === "maximize-all") {
      for (const w of list) {
        w.maximized = true;
        w.minimized = false;
        apply(w);
      }
      render(true);
      return;
    }
    if (mode === "maximize") {
      const w = active && windows.get(key(active.id, active.target));
      if (w) {
        w.maximized = true;
        apply(w);
      }
      render(true);
      return;
    }
    const tile = ["tile", "vertical", "horizontal"].includes(mode),
      cols =
        mode === "vertical"
          ? list.length
          : mode === "horizontal"
            ? 1
            : Math.min(
                list.length,
                Math.max(
                  1,
                  Math.ceil(Math.sqrt((list.length * a.w) / Math.max(1, a.h))),
                ),
              ),
      rows = Math.ceil(list.length / cols);
    list.forEach((w, i) => {
      w.maximized = false;
      w.tiled = tile;
      w.bounds = tile
        ? {
            x: ((i % cols) * a.w) / cols,
            y: (Math.floor(i / cols) * a.h) / rows,
            w: a.w / cols,
            h: a.h / rows,
          }
        : normal(i);
      apply(w);
      raise(w);
    });
    if (active) {
      const w = windows.get(key(active.id, active.target));
      if (w) raise(w);
    }
    render(true);
  };
  const view = [...document.querySelectorAll(".menubar .menu")].find(
      (m) => m.querySelector("summary")?.textContent === "Ver",
    ),
    menu = el("details", "mdi-layout-menu");
  menu.append(el("summary", "", "Ventanas"));
  for (const [label, mode] of [
    ["Mosaico en cuadrícula", "tile"],
    ["Mosaico vertical", "vertical"],
    ["Mosaico horizontal", "horizontal"],
    ["Cascada", "cascade"],
    ["Maximizar actual", "maximize"],
    ["Maximizar todo", "maximize-all"],
  ]) {
    const b = el("button", "", label);
    b.type = "button";
    b.onclick = () => {
      window.arrangeDreamsWindows(mode);
      view.open = false;
    };
    menu.append(b);
  }
  view.querySelector(".menu-popup").append(menu);
  new ResizeObserver(() => {
    for (const w of windows.values()) apply(w);
  }).observe(desktop);
  render();
})();
