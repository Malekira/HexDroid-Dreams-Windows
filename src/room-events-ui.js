"use strict";
(() => {
  const messages = $("messages"),
    panes = el("div", "conversation-panes");
  panes.id = "conversation-panes";
  messages.before(panes);
  panes.append(messages);
  const divider = el("div", "channel-events-divider");
  divider.id = "channel-events-divider";
  divider.tabIndex = 0;
  divider.setAttribute("role", "separator");
  divider.setAttribute("aria-label", "Altura de eventos de sala");
  divider.setAttribute("aria-orientation", "horizontal");
  const eventsPane = el("section", "channel-events-pane"),
    events = el("div");
  eventsPane.id = "channel-events-pane";
  events.id = "channel-events";
  events.setAttribute("role", "log");
  events.setAttribute("aria-label", "Eventos de la sala");
  events.tabIndex = 0;
  eventsPane.append(el("header", "", "Eventos de la sala"), events);
  panes.append(divider, eventsPane);
  const mode = el("select", "room-view-choice");
  mode.setAttribute("aria-label", "Vista de sala");
  for (const [value, text] of [
    ["unified", "Misma ventana"],
    ["split", "Ventana dividida"],
  ]) {
    const option = el("option", "", text);
    option.value = value;
    mode.append(option);
  }
  document.querySelector(".message-toolbar").append(mode);
  const settingsPanel = document.querySelector("[data-panel=chat]");
  const row = el("label", "setting-row", "Vista de eventos de sala"),
    setting = mode.cloneNode(true);
  setting.className = "";
  setting.setAttribute("aria-label", "Vista de eventos de sala");
  row.append(setting);
  settingsPanel.append(row);
  const clonesRow = el("label", "setting-row", "Mostrar posibles clones"),
    clones = el("input");
  clones.type = "checkbox";
  clones.setAttribute("aria-label", "Mostrar posibles clones");
  clonesRow.append(clones);
  settingsPanel.append(clonesRow);
  const mentionRow = el(
      "label",
      "setting-row",
      "Resaltar mensajes que mencionen mi nick",
    ),
    mention = el("input");
  mention.type = "checkbox";
  mention.setAttribute("aria-label", "Resaltar mensajes que mencionen mi nick");
  mentionRow.append(mention);
  settingsPanel.append(mentionRow);
  const colorRow = el(
      "label",
      "setting-row",
      "Color del resaltado de menciones",
    ),
    colorInput = el("input");
  colorInput.type = "color";
  colorInput.dataset.ircColor = "";
  colorInput.setAttribute("aria-label", "Color del resaltado de menciones");
  colorRow.append(colorInput);
  settingsPanel.append(colorRow);
  for (const control of [mention, colorInput])
    control.onchange = () => {
      config.settings.highlightMentions = mention.checked;
      config.settings.mentionHighlightColor = colorInput.value;
      applySettings();
      render();
      persist().catch((e) => notify(e.message, true));
    };
  function apply() {
    const s = config.settings;
    mention.checked = s.highlightMentions !== false;
    colorInput.value = s.mentionHighlightColor || "#7650aa";
    mode.value = setting.value = s.roomView || "unified";
    clones.checked = s.showClones !== false;
    panes.style.setProperty("--events-percent", s.eventsPanePercent || 25);
    const color = profile(active?.id)?.mentionHighlightColor||s.mentionHighlightColor||"#7650aa";
    messages.style.setProperty("--mention-border", color);
    messages.style.setProperty(
      "--mention-background",
      "color-mix(in srgb, " +
        color +
        " 26%, " +
        (s.roomAppearance?.background ||
          getComputedStyle(messages).backgroundColor) +
        ")",
    );
    const bg =
      s.roomAppearance?.background ||
      getComputedStyle(messages).backgroundColor;
    messages.style.setProperty(
      "--room-red",
      DreamsFormatting.readableColor("#e65f6f", bg),
    );
    events.style.setProperty(
      "--room-red",
      DreamsFormatting.readableColor(
        "#e65f6f",
        getComputedStyle(eventsPane).backgroundColor,
      ),
    );
  }
  const baseApply = applySettings;
  applySettings = function () {
    baseApply();
    apply();
  };
  async function saveMode(value) {
    config.settings.roomView = value;
    apply();
    lastMessageView = "";
    render();
    await persist();
  }
  for (const select of [mode, setting])
    select.onchange = () =>
      saveMode(select.value).catch((e) => notify(e.message, true));
  clones.onchange = () => {
    config.settings.showClones = clones.checked;
    render();
    persist().catch((e) => notify(e.message, true));
  };
  window.prepareDreamsEventPane = (c) => {
    const split = c?.kind === "channel" && config.settings.roomView === "split";
    panes.hidden = !c;
    divider.hidden = eventsPane.hidden = !split;
    mode.hidden = c?.kind !== "channel";
    if (!split) {
      events.replaceChildren();
      return null;
    }
    return events;
  };
  events.addEventListener("scroll", () => {
    const c = selected();
    if (c) {
      c.eventScrollTop = events.scrollTop;
      c.eventsFollow =
        events.scrollHeight - events.scrollTop - events.clientHeight < 50;
    }
  });
  function size(value) {
    config.settings.eventsPanePercent = Math.max(12, Math.min(65, value));
    apply();
    divider.setAttribute(
      "aria-valuenow",
      Math.round(config.settings.eventsPanePercent),
    );
  }
  let drag = false;
  divider.onpointerdown = (e) => {
    drag = true;
    divider.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  divider.onpointermove = (e) => {
    if (drag) {
      const bounds = panes.getBoundingClientRect();
      size(((bounds.bottom - e.clientY) * 100) / bounds.height);
    }
  };
  const finish = () => {
    if (!drag) return;
    drag = false;
    persist().catch((e) => notify(e.message, true));
  };
  for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
    divider.addEventListener(name, finish);
  divider.ondblclick = () => {
    size(25);
    persist().catch(() => {});
  };
  divider.onkeydown = (e) => {
    if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    size(
      e.key === "Home"
        ? 12
        : e.key === "End"
          ? 65
          : (config.settings.eventsPanePercent || 25) +
            (e.key === "ArrowUp" ? 3 : -3),
    );
    persist().catch(() => {});
  };
  window.renderDreamsSpecialEvent = (row, m, time, id=active?.id) => {
    if (!["nick", "clones", "sanction"].includes(m.eventType)) return false;
    row.replaceChildren();
    row.classList.add(
      m.eventType === "nick" ? "event-nick-change" : "event-clones",
    );
    if (config.settings.timestamps) row.append(time);
    function nick(name) {
      const b = el("button", "event-nick", name);
      b.type = "button";
      b.setAttribute("aria-label", "Perfil de " + name);
      b.onclick = () => window.openDreamsUser?.(id, name);
      row.append(b);
    }
    if(m.eventType==="sanction"){row.append(el("span","event-text",m.text));return true;}
    if (m.eventType === "nick") {
      nick(m.oldNick);
      row.append(document.createTextNode(" → "));
      nick(m.nick);
      row.append(document.createTextNode(" cambió de nick"));
    } else {
      row.append(document.createTextNode("Posibles clones (mismo host): "));
      m.nicks.forEach((name, i) => {
        if (i) row.append(document.createTextNode(", "));
        nick(name);
      });
      if (config.settings.eventShowHost && m.host)
        row.append(document.createTextNode(" · " + m.host));
    }
    return true;
  };
  apply();
  render();
})();
