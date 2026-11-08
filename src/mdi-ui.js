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
  function bounds(w) {
    const a = area();
    if (w.maximized) return { x: 0, y: 0, w: a.w, h: a.h };
    const b = w.bounds;
    b.w = Math.max(w.tiled ? 0 : Math.min(420, a.w), Math.min(a.w, b.w));
    b.h = Math.max(w.tiled ? 0 : Math.min(240, a.h), Math.min(a.h, b.h));
    b.x = Math.max(0, Math.min(a.w - b.w, b.x));
    b.y = Math.max(0, Math.min(a.h - b.h, b.y));
    return b;
  }
  function apply(w) {
    w.node.hidden = !!w.minimized;
    const b = bounds(w);
    Object.assign(w.node.style, {
      left: b.x + "px",
      top: b.y + "px",
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
  }
  function drag(w, node, direction) {
    let start = null;
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
      }
      start = { x: e.clientX, y: e.clientY, b: { ...bounds(w) } };
      node.setPointerCapture(e.pointerId);
    });
    node.addEventListener("pointermove", (e) => {
      if (!start) return;
      const dx = e.clientX - start.x,
        dy = e.clientY - start.y,
        b = { ...start.b },
        a = area();
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
      apply(w);
    });
    for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
      node.addEventListener(event, () => {
        if (!start) return;
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
        if (isActive(w) || e.target.closest(".mdi-window-control")) return;
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
  function mirror(w, c) {
    if (isActive(w)) return;
    w.mirror.hidden = false;
    const s = config.settings,
      n = network(w.id),
      signature = JSON.stringify([
        c.revision,
        c.showUsers,
        profile(w.id)?.ownNickColor,
        profile(w.id)?.mentionHighlightColor,
        c.messages.length,
        c.messages.at(-1)?.id,
        c.users,
        c.topic,
        c.modes,
        n.avatarRevision,
        n.state,
        c.joined,
        c.muted,
        { ...s, dictionary: undefined, nickCompletion: undefined },
      ]);
    if (signature === w.signature) {
      const field = w.mirror.querySelector("textarea");
      if (field && document.activeElement !== field) field.value = c.draft;
      return;
    }
    w.signature = signature;
    w.mirror.replaceChildren();
    w.mirror.hidden = false;
    if (c.topic && s.showTopic !== false) {
      const topic = el("div", "mdi-topic");
      DreamsFormatting.render(topic, c.topic);
      w.mirror.append(topic);
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
    messages.style.fontFamily =
      (s.fontFamily || "Segoe UI") + ', "Segoe UI Emoji", sans-serif';
    messages.style.fontSize = (s.fontSize || 14) + "px";
    const events = el("div", "mdi-events"),
      split = c.kind === "channel" && s.roomView === "split";
    if (split) {
      events.setAttribute("role", "log");
      events.setAttribute("aria-label", "Eventos de " + c.name);
      events.style.flex = "0 0 " + (s.eventsPanePercent || 25) + "%";
      events.append(el("header", "", "Eventos de sala"));
    }
    for (const m of c.messages) {
      if (m.event && !s.showEvents && c.kind !== "queries" && !m.error)
        continue;
      if (m.eventType === "clones" && s.showClones === false) continue;
      const row = el(
        "div",
        "mdi-message" +
          (m.own ? " own" : "") +
          (m.mention && !c.muted && s.highlightMentions !== false
            ? " mention"
            : "") +
          (m.event ? " event" : ""),
      );
      if (s.timestamps)
        row.append(
          el(
            "time",
            "",
            new Date(m.time).toLocaleTimeString([], { hour12: false }),
          ),
          document.createTextNode(" "),
        );
      if (!m.event) {
        if (s.showMessageAvatars !== false && s.mediaEnabled !== false) {
          const src = avatarFor(w.id, m.nick, "messages");
          if (src) {
            const img = el("img", "mdi-avatar");
            img.src = src;
            img.alt = m.nick;
            row.append(img);
          }
        }
        const nick = el("button", "mdi-nick", "{" + m.nick + "} ");
        nick.type = "button";
        nick.dataset.mdiUser = m.nick;
        nick.setAttribute(
          "aria-label",
          "Perfil de " + m.nick + " en " + c.name,
        );
        if (m.own)
          nick.style.color = profile(w.id)?.ownNickColor || s.ownNickColor;
        else if (s.coloredNicks !== false) {
          let hash = 0;
          for (const ch of fold(m.nick))
            hash = (hash * 31 + ch.charCodeAt(0)) | 0;
          nick.style.color = `hsl(${Math.abs(hash) % 360} ${s.nickPalette === "pastel" ? 48 : 78}% ${DreamsFormatting.luminance(a.background || getComputedStyle($("messages")).backgroundColor) > 0.4 ? (s.nickPalette === "pastel" ? 36 : 28) : s.nickPalette === "pastel" ? 78 : 68}%)`;
        }
        row.append(nick);
      }
      const text = el("span", "mdi-text");
      DreamsFormatting.render(
        text,
        (m.action ? "* " + m.nick + " " : "") +
          m.text +
          (m.reason ? " · " + m.reason : ""),
      );
      row.append(text);
      if (m.notice) {
        if (s.noticeBackground) row.style.backgroundColor = s.noticeBackground;
        if (s.noticeColor || s.noticeBackground)
          text.style.color = DreamsFormatting.readableColor(
            s.noticeColor || getComputedStyle($("messages")).color,
            s.noticeBackground ||
              getComputedStyle($("messages")).backgroundColor,
          );
        row.style.fontWeight = s.noticeStyle?.includes("bold") ? "700" : "";
        row.style.fontStyle = s.noticeStyle?.includes("italic") ? "italic" : "";
      }
      if (m.event) {
        if (m.eventType === "nick")
          row.style.color = "var(--event-nick,#f06a78)";
        const arrows = {
          join: ["→", "#45bd85"],
          quit: ["←", "#ed6678"],
          part: ["←", "#e4bc46"],
          kick: ["←", "#ed6678"],
        };
        if (arrows[m.eventType]) {
          const arrow = el("span", "", arrows[m.eventType][0] + " ");
          arrow.style.color = arrows[m.eventType][1];
          row.prepend(arrow);
        }
        if (m.nick) {
          const nick = el("button", "mdi-nick", m.nick);
          nick.type = "button";
          nick.dataset.mdiUser = m.nick;
          nick.setAttribute(
            "aria-label",
            "Perfil de " + m.nick + " en " + c.name,
          );
          text.replaceChildren(
            nick,
            document.createTextNode(
              " " +
                m.text.replace(m.nick, "").trim() +
                (m.reason ? " · " + m.reason : ""),
            ),
          );
        }
        if ((s.eventShowIdent && m.ident) || (s.eventShowHost && m.host))
          row.append(
            document.createTextNode(
              " (" +
                (s.eventShowIdent ? m.ident || "" : "") +
                (s.eventShowHost ? "@" + (m.host || "") : "") +
                ")",
            ),
          );
      }
      (split && m.event ? events : messages).append(row);
    }
    const form = el("form", "mdi-composer"),
      input = el("textarea"),
      send = el("button", "", "↑");
    input.style.background = a.inputBackground || "var(--bg)";
    input.style.fontSize = (s.fontSize || 14) + "px";
    input.value = c.draft;
    input.rows = 1;
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
    form.append(input, send);
    timeline.append(messages);
    if (split) timeline.append(events);
    timeline.append(form);
    body.append(timeline);
    if (conversationShowsUsers(c)) {
      const users = el("aside", "mdi-users");
      users.setAttribute("aria-label", "Usuarios de " + c.name);
      users.append(
        el(
          "div",
          "mdi-users-title",
          c.kind === "private" ? "Usuario" : "Usuarios · " + c.users.length,
        ),
      );
      const names = c.kind === "private" ? [c.name] : c.users;
      for (const raw of names) {
        const name = bareNick(raw, n),
          b = el("button", "mdi-user");
        b.type = "button";
        b.dataset.mdiUser = name;
        b.setAttribute("aria-label", "Perfil de " + name + " en " + c.name);
        const src = avatarFor(w.id, name);
        if (src) {
          const img = el("img", "mdi-avatar");
          img.src = src;
          img.alt = name;
          b.append(img);
        }
        b.append(el("span", "", raw));
        users.append(b);
      }
      body.append(users);
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
    const desired = new Set();
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
        w.title.textContent =
          c.name +
          (c.modes ? " " + c.modes : "") +
          " · " +
          (profile(id)?.name || "");
        w.usersButton.hidden = c.kind === "server";
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
          if (live.parentElement !== w.host) w.host.append(live);
          w.node.classList.add("mdi-active");
        } else {
          w.node.classList.remove("mdi-active");
          if (live.parentElement === w.host) parking.append(live);
        }
        apply(w);
      }
    for (const [k, w] of windows)
      if (!desired.has(k)) {
        if (w.host.contains(live)) parking.append(live);
        w.node.remove();
        windows.delete(k);
      }
    tasks();
    for (const w of windows.values()) apply(w);
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
    const list = [...windows.values()].filter((w) => !w.minimized),
      a = area();
    if (!list.length) return;
    if (mode === "maximize") {
      const w = active && windows.get(key(active.id, active.target));
      if (w) {
        w.maximized = true;
        apply(w);
      }
      return;
    }
    const tile = ["tile", "vertical", "horizontal"].includes(mode),
      cols =
        mode === "vertical"
          ? list.length
          : mode === "horizontal"
            ? 1
            : Math.ceil(Math.sqrt((list.length * a.w) / Math.max(1, a.h))),
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
  };
  const view = [...document.querySelectorAll(".menubar .menu")].find(
      (m) => m.querySelector("summary")?.textContent === "Ver",
    ),
    menu = el("details", "mdi-layout-menu");
  menu.append(el("summary", "", "Ventanas"));
  for (const [label, mode] of [
    ["Mosaico vertical", "vertical"],
    ["Mosaico horizontal", "horizontal"],
    ["Cascada", "cascade"],
    ["Maximizar actual", "maximize"],
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
