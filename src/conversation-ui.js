"use strict";
(() => {
  document.querySelector(".statusbar").append($("transport-label"));
  const input = $("message-input"),
    wrap = document.querySelector(".composer-input");
  const styles = el("details", "composer-styles"),
    toggle = el("summary", "", "A✎");
  toggle.setAttribute("aria-label", "Estilos de escritura");
  toggle.title = "Estilos de escritura";
  const popup = el("div", "composer-style-popup");
  const bar = document.querySelector("#composer .format-bar");
  bar.querySelector("span")?.remove();
  popup.append(bar);
  const typingLabel = el("label", "typing-option"),
    typingCheck = el("input");
  typingCheck.type = "checkbox";
  typingLabel.append(
    typingCheck,
    document.createTextNode("Enviar «Estoy escribiendo»"),
  );
  popup.append(typingLabel);
  styles.append(toggle, popup);
  wrap.insertBefore(styles, $("send-button"));
  window.openDreamsComposerStyles=()=>{styles.open=true;toggle.focus();};
  const baseApply = applySettings;
  applySettings = function () {
    baseApply();
    typingCheck.checked = config.settings.sendTyping !== false;
  };
  typingCheck.onchange = () => {
    config.settings.sendTyping = typingCheck.checked;
    if (!typingCheck.checked && active && api.advanced)
      api
        .advanced("typing", {
          network: active.id,
          target: active.target,
          state: "done",
        })
        .catch(() => {});
    persist().catch((e) => notify(e.message, true));
  };
  const resize = () => {
    input.style.height = "auto";
    if(!input.value){input.style.height=Math.max(32,parseFloat(getComputedStyle(input).lineHeight)+12)+"px";return;}
    input.style.height = Math.min(150, Math.max(24, input.scrollHeight)) + "px";
  };
  input.addEventListener("input", resize);
  const baseChoose = choose;
  choose = function (...args) {
    const result = baseChoose(...args);
    styles.open = false;
    resize();
    return result;
  };
  $("composer").addEventListener("submit", () => {
    if (active && api.advanced && config.settings.sendTyping !== false)
      api
        .advanced("typing", {
          network: active.id,
          target: active.target,
          state: "done",
        })
        .catch(() => {});
    setTimeout(resize, 0);
  });
  document.addEventListener("pointerdown", (e) => {
    if (
      styles.open &&
      !styles.contains(e.target) &&
      !e.target.closest("#context-menu")
    )
      styles.open = false;
  });
  styles.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      styles.open = false;
      input.focus();
    }
  });

  const bell = el("button", "notification-bell", "♧");
  bell.id = "notification-bell";
  bell.type = "button";
  const bellIcon = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "svg",
  );
  bellIcon.setAttribute("viewBox", "0 0 24 24");
  bellIcon.setAttribute("width", "16");
  bellIcon.setAttribute("height", "16");
  bellIcon.setAttribute("aria-hidden", "true");
  const bellPath = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path",
  );
  bellPath.setAttribute(
    "d",
    "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
  );
  bellPath.setAttribute("fill", "none");
  bellPath.setAttribute("stroke", "currentColor");
  bellPath.setAttribute("stroke-width", "2");
  bellPath.setAttribute("stroke-linecap", "round");
  bellIcon.append(bellPath);
  bell.replaceChildren(bellIcon);
  bell.setAttribute("aria-label", "Notificaciones");
  bell.title = "Menciones y NOTICE";
  document.querySelector(".network-picker").after(bell);
  const dialog = el("dialog", "feature-dialog notification-dialog");
  dialog.id = "notification-dialog";
  const header = el("header", "dialog-header"),
    title = el("h2", "", "Notificaciones"),
    close = el("button", "secondary", "Cerrar");
  close.type = "button";
  close.onclick = () => dialog.close();
  header.append(title, close);
  const body = el("div", "form-content"),
    actions = el("div", "notification-actions"),
    clear = el("button", "secondary", "Vaciar registro");
  clear.type = "button";
  actions.append(clear);
  const log = el("div", "notification-list");
  body.append(
    el(
      "p",
      "note",
      "Menciones y NOTICE recibidos durante esta sesión, también en la conversación activa.",
    ),
    actions,
    log,
  );
  dialog.append(header, body);
  document.body.append(dialog);
  let entries = [];
  const call = async (name, data = {}) => {
    if (!api.advanced) return name === "notifications.list" ? [] : {};
    const result = await api.advanced(name, data);
    if (result?.error) throw new Error(result.error);
    return result;
  };
  function badge() {
    const count = entries.filter((e) => !e.read).length;
    bell.classList.toggle("has-unread",count>0);
    bell.replaceChildren(
      bellIcon,
      document.createTextNode(count ? " " + count : ""),
    );
    bell.setAttribute(
      "aria-label",
      "Notificaciones" + (count ? ": " + count + " sin leer" : ""),
    );
  }
  async function mark() {
    const keys = entries.filter((e) => !e.read).map((e) => e.key);
    if (!keys.length) return;
    await call("notifications.read", { keys });
    for (const e of entries) if (keys.includes(e.key)) e.read = true;
    badge();
  }
  function draw() {
    log.replaceChildren();
    if (!entries.length)
      log.append(el("p", "muted", "Sin menciones ni NOTICE."));
    for (const entry of [...entries].reverse()) {
      const row = el("article", "notification-entry"),
        head = el(
          "strong",
          "",
          (entry.kind === "notice" ? "NOTICE" : "Mención") + " · " + entry.nick,
        );
      const time = el(
        "time",
        "",
        new Date(entry.time).toLocaleString("es", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
      time.title = new Date(entry.time).toLocaleString("es");
      const where = el(
          "span",
          "notification-location muted",
          (profile(entry.network)?.name || entry.network) +
            " · " +
            entry.target,
        ),
        text = el("span", "notification-text", entry.text),
        go = el("button", "secondary", "↗");
      go.setAttribute("aria-label", "Abrir conversación");
      go.title = "Abrir conversación";
      go.type = "button";
      go.disabled = !profile(entry.network);
      go.onclick = () => {
        choose(entry.network, entry.target);
        dialog.close();
      };
      row.append(time, head, where, text, go);
      log.append(row);
    }
    badge();
  }
  bell.onclick = async () => {
    try {
      entries = await call("notifications.list");
      draw();
      dialog.showModal();
      await mark();
    } catch (e) {
      notify(e.message, true);
    }
  };
  clear.onclick = async () => {
    try {
      await call("notifications.clear");
      entries = [];
      draw();
    } catch (e) {
      notify(e.message, true);
    }
  };
  api.onEvent((event) => {
    if (event.type !== "notification-entry") return;
    if (!entries.some((e) => e.key === event.entry.key))
      entries.push(event.entry);
    entries = entries.slice(-500);
    badge();
    if (dialog.open) {
      draw();
      mark().catch((e) => notify(e.message, true));
    }
  });
  call("notifications.list")
    .then((rows) => {
      const known = new Set(entries.map((e) => e.key));
      entries = [...rows.filter((e) => !known.has(e.key)), ...entries].slice(
        -500,
      );
      badge();
    })
    .catch(() => {});
  applySettings();
  resize();
})();
