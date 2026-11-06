"use strict";
(() => {
  const call = async (name, data) => {
    if (!api.advanced) throw new Error("Función no disponible.");
    const r = await api.advanced(name, data);
    if (r?.error) throw new Error(r.error);
    return r;
  };
  const run = (fn) =>
    Promise.resolve()
      .then(fn)
      .catch((e) => notify(e.message, true));
  const tools = document.querySelector(".chat-tools"),
    topic = $("conversation-subtitle");
  const toggle = el("button", "small-button");
  toggle.id = "topic-toggle";
  toggle.type = "button";
  tools.append(toggle);
  const divider = el("div", "topic-height-resizer");
  divider.id = "topic-height-resizer";
  divider.tabIndex = 0;
  divider.setAttribute("role", "separator");
  divider.setAttribute("aria-label", "Altura del topic");
  divider.setAttribute("aria-orientation", "horizontal");
  divider.setAttribute("aria-valuemin", "32");
  divider.setAttribute("aria-valuemax", "320");
  document.querySelector(".chat-heading").after(divider);
  function topicSettings() {
    const shown = config.settings.showTopic !== false;
    document.body.classList.toggle("topic-hidden", !shown);
    toggle.textContent = shown ? "▴ Topic" : "▾ Topic";
    toggle.setAttribute(
      "aria-label",
      shown ? "Ocultar topic" : "Mostrar topic",
    );
    toggle.setAttribute("aria-pressed", String(shown));
    divider.hidden = !shown;
    topic.style.height = Number.isFinite(config.settings.topicHeight)
      ? config.settings.topicHeight + "px"
      : "";
    divider.setAttribute(
      "aria-valuenow",
      String(
        Number.isFinite(config.settings.topicHeight)
          ? config.settings.topicHeight
          : Math.round(topic.getBoundingClientRect().height) || 32,
      ),
    );
  }
  const originalApply = applySettings;
  applySettings = function () {
    originalApply();
    topicSettings();
  };
  toggle.onclick = () => {
    config.settings.showTopic = config.settings.showTopic === false;
    applySettings();
    renderHeader();
    persist().catch((e) => notify(e.message, true));
  };
  let dragging = false;
  divider.onpointerdown = (event) => {
    dragging = true;
    divider.setPointerCapture(event.pointerId);
    document.body.classList.add("dragging-topic");
    event.preventDefault();
  };
  divider.onpointermove = (event) => {
    if (!dragging) return;
    config.settings.topicHeight = Math.round(
      Math.max(
        32,
        Math.min(320, event.clientY - topic.getBoundingClientRect().top),
      ),
    );
    topicSettings();
  };
  function finish() {
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove("dragging-topic");
    persist().catch((e) => notify(e.message, true));
  }
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
    divider.addEventListener(event, finish);
  divider.ondblclick = () => {
    config.settings.topicHeight = null;
    topicSettings();
    persist().catch((e) => notify(e.message, true));
  };
  divider.onkeydown = (event) => {
    if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const height =
      config.settings.topicHeight ?? topic.getBoundingClientRect().height;
    config.settings.topicHeight =
      event.key === "Home"
        ? 32
        : event.key === "End"
          ? 320
          : Math.max(
              32,
              Math.min(320, height + (event.key === "ArrowUp" ? -10 : 10)),
            );
    topicSettings();
    persist().catch((e) => notify(e.message, true));
  };
  const dialog = el("dialog", "feature-dialog");
  dialog.id = "notify-dialog";
  const header = el("header", "dialog-header"),
    title = el("h2", "", "Notify · Usuarios en línea"),
    close = el("button", "icon-button", "×");
  close.type = "button";
  close.setAttribute("aria-label", "Cerrar Notify");
  close.onclick = () => dialog.close();
  header.append(title, close);
  const body = el("div", "form-content");
  dialog.append(header, body);
  document.body.append(dialog);
  const trigger = el("button", "small-button", "Notify");
  trigger.id = "notify-button";
  trigger.type = "button";
  trigger.setAttribute("aria-label", "Notify: usuarios en línea");
  tools.append(trigger);
  let notifyNetwork = null;
  const states = new Map();
  function action(parent, text, fn) {
    const b = el("button", "secondary", text);
    b.type = "button";
    b.onclick = () => run(fn);
    parent.append(b);
    return b;
  }
  async function saveNames(id, names) {
    const p = profile(id);
    if (!p) throw new Error("Seleccioná una red.");
    const previous = p.notifyNicks;
    p.notifyNicks = [...new Map(names.map((n) => [fold(n), n])).values()];
    try {
      await persist();
    } catch (e) {
      p.notifyNicks = previous;
      throw e;
    }
    if (api.advanced) await call("presence.sync", { network: id });
  }
  window.followDreamsUser = async (id, nick) => {
    const p = profile(id);
    if (!p) return;
    const names = p.notifyNicks || [],
      followed = names.some((n) => fold(n) === fold(nick));
    await saveNames(
      id,
      followed ? names.filter((n) => fold(n) !== fold(nick)) : [...names, nick],
    );
    notify(
      followed ? nick + " se quitó de Notify." : nick + " se agregó a Notify.",
    );
  };
  function renderList() {
    const list = $("notify-list");
    if (!list) return;
    list.replaceChildren();
    const names = profile(notifyNetwork)?.notifyNicks || [],
      current = states.get(notifyNetwork) || {};
    if (!names.length)
      list.append(
        el(
          "p",
          "muted",
          "Agregá apodos para recibir avisos cuando se conecten o desconecten.",
        ),
      );
    for (const nick of names) {
      const row = el("div", "notify-row"),
        online = current[fold(nick)],
        status =
          online === true
            ? "En línea"
            : online === false
              ? "Desconectado"
              : network(notifyNetwork).state === "connected"
                ? "Consultando…"
                : "Red desconectada";
      const name = el("strong", "", nick),
        label = el("span", "notify-status" + (online ? " online" : ""), status);
      row.append(name, label);
      action(row, "Abrir privado", () => {
        dialog.close();
        choose(notifyNetwork, nick);
      });
      action(row, "Quitar", async () => {
        await saveNames(
          notifyNetwork,
          names.filter((n) => fold(n) !== fold(nick)),
        );
        renderList();
      });
      list.append(row);
    }
  }
  function option(text, key) {
    const label = el("label", "checkbox-label"),
      input = el("input");
    input.type = "checkbox";
    input.checked = config.settings[key] !== false;
    input.setAttribute("aria-label", text);
    input.onchange = () => {
      config.settings[key] = input.checked;
      persist().catch((e) => notify(e.message, true));
    };
    label.append(input, document.createTextNode(text));
    body.append(label);
  }
  async function openNotify() {
    if (!active) {
      notify("Añadí una red primero.", true);
      return;
    }
    notifyNetwork = active.id;
    title.textContent = "Notify · " + profile(notifyNetwork).name;
    body.replaceChildren();
    const form = el("form", "notify-add"),
      input = el("input");
    input.placeholder = "Nick a seguir";
    input.setAttribute("aria-label", "Nick para Notify");
    input.maxLength = 40;
    input.required = true;
    const add = el("button", "primary", "Añadir");
    add.type = "submit";
    form.append(input, add);
    form.onsubmit = (event) => {
      event.preventDefault();
      run(async () => {
        const nick = input.value.trim();
        if (!nick || /^[#&+!~@%]|[\s\x00-\x1f:,]/.test(nick))
          throw new Error("Escribí un nick sin espacios.");
        await saveNames(notifyNetwork, [
          ...(profile(notifyNetwork).notifyNicks || []),
          nick,
        ]);
        input.value = "";
        renderList();
      });
    };
    body.append(form);
    const list = el("div", "notify-list");
    list.id = "notify-list";
    body.append(list);
    option("Avisar cambios de conexión", "notifyPresence");
    option("Avisar también desconexiones", "notifyPresenceOffline");
    option("Sonido de Notify", "notifyPresenceSound");
    body.append(
      el(
        "p",
        "note",
        "La lista es independiente por red. Si la red no ofrece avisos inmediatos, el estado se consulta cada 30 segundos.",
      ),
    );
    if (!dialog.open) dialog.showModal();
    renderList();
    if (api.advanced) {
      const id = notifyNetwork,
        rows = await call("presence.status", { network: id });
      states.set(
        id,
        Object.fromEntries(rows.map((row) => [fold(row.nick), row.online])),
      );
      if (id === notifyNetwork) renderList();
    }
  }
  trigger.onclick = () => run(openNotify);
  if (api.advanced)
    api.onEvent((event) => {
      if (event.type === "presence") {
        const current = states.get(event.id) || {};
        current[fold(event.nick)] = event.online;
        states.set(event.id, current);
        if (event.id === notifyNetwork && dialog.open) renderList();
      }
      if (event.type === "presence-alert") notify(event.text);
      if (event.type === "status" && event.state === "disconnected") {
        states.delete(event.id);
        if (event.id === notifyNetwork && dialog.open) renderList();
      }
    });
  topicSettings();
})();
