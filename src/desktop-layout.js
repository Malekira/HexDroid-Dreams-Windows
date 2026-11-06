"use strict";
(() => {
  document.body.classList.add("desktop-compact");
  const bar = document.querySelector(".menubar"),
    tools = document.querySelector(".chat-tools"),
    heading = document.querySelector(".chat-heading"),
    headingText = $("conversation-title").parentElement;
  const nameLine = el("div", "heading-name-line");
  nameLine.append($("conversation-title"), $("channel-modes"));
  headingText.prepend(nameLine);
  const topicPanel = el("section", "topic-panel");
  topicPanel.id = "topic-panel";
  topicPanel.setAttribute("aria-label", "Tema de la sala");
  topicPanel.append($("conversation-subtitle"));
  heading.after(topicPanel);
  bar.append(tools);
  tools.classList.add("network-actions");
  tools.setAttribute("aria-label", "Acciones de la red");
  if ($("theme-toggle")) tools.append($("theme-toggle"));
  tools.append(document.querySelector(".settings-top"));
  const sidebar = $("private-panel"),
    footer = document.querySelector(".sidebar-footer"),
    plus = document.querySelector(".sidebar-title [data-action=add-network]"),
    searchLabel = $("search").closest("label"),
    sortLabel = $("private-sort").closest("label"),
    list = $("network-list");
  const notifyHeader = el("div", "notify-sidebar-title");
  notifyHeader.append(el("strong", "", "Notify"));
  const configure = el("button", "icon-button", "⚙");
  configure.type = "button";
  configure.setAttribute("aria-label", "Configurar Notify");
  configure.onclick = () => $("notify-button").click();
  notifyHeader.append(configure, plus);
  const onlineList = el("div", "sidebar-notify-list");
  onlineList.id = "sidebar-notify-list";
  const tree = el("nav", "conversation-tree");
  tree.setAttribute("aria-label", "Árbol de salas y privados");
  tree.append(list);
  sortLabel.hidden = true;
  $("search").placeholder = "Buscar sala o privado…";
  sidebar.replaceChildren(
    notifyHeader,
    onlineList,
    searchLabel,
    sortLabel,
    tree,
    footer,
  );
  sidebar.setAttribute("aria-label", "Notify y conversaciones");
  function badge(c, parent) {
    if (c.unread) parent.append(el("span", "badge", String(c.unread)));
  }
  function node(c, kind) {
    const row = el(
        "div",
        "tree-row" +
          (kind === "private" ? " conversation" : "") +
          (active?.target && fold(active.target) === fold(c.name)
            ? " active"
            : "") +
          (c.muted ? " is-muted" : "") +
          (c.unread && !c.muted ? " has-activity" : ""),
      ),
      b = el(
        "button",
        kind === "private" ? "conversation-name" : "tree-name",
        c.kind === "queries" ? "WHOIS / WHO" : c.name,
      );
    b.type = "button";
    b.setAttribute(
      "aria-label",
      (kind === "private"
        ? "Privado "
        : kind === "channel"
          ? "Sala "
          : "Consulta ") + c.name,
    );
    badge(c, b);
    b.onclick = () => choose(active.id, c.name);
    row.append(b);
    const close = el("button", "tree-close", "×");
    close.type = "button";
    close.setAttribute(
      "aria-label",
      (kind === "private" ? "Cerrar privado " : "Cerrar nodo ") + c.name,
    );
    close.onclick = () => closeConversation(active.id, c.name);
    row.append(close);
    row.oncontextmenu = (e) => conversationMenu(e, active.id, c);
    return row;
  }
  function group(title, id, key, entries, query) {
    const details = el("details", "tree-group");
    details.id = id;
    details.open = !!query || config.settings[key] !== false;
    details.dataset.initial = String(details.open);
    details.ontoggle = () => {
      if (details.dataset.initial === String(details.open) || query) return;
      details.dataset.initial = String(details.open);
      config.settings[key] = details.open;
      persist().catch(() => {});
    };
    details.append(el("summary", "", title + " (" + entries.length + ")"));
    for (const c of entries) details.append(node(c, c.kind));
    if (!entries.length)
      details.append(el("span", "tree-empty", "Sin conversaciones"));
    return details;
  }
  window.renderDreamsNotify = () => {
    onlineList.replaceChildren();
    const people = active ? window.getDreamsNotify?.(active.id) || [] : [];
    const online = people.filter((p) => p.online === true);
    for (const person of online) {
      const b = el("button", "notify-online-row");
      b.type = "button";
      b.setAttribute("aria-label", "Notify " + person.nick + " en línea");
      b.append(el("span", "online-dot", "●"), el("span", "", person.nick));
      b.onclick = () => choose(active.id, person.nick);
      b.oncontextmenu = (e) =>
        contextMenu.show(e, person.nick, [
          {
            label: "Abrir privado",
            action: () => choose(active.id, person.nick),
          },
          {
            label: "Dejar de seguir conexión",
            action: async () => {
              await window.followDreamsUser(active.id, person.nick);
              window.renderDreamsNotify();
            },
          },
        ]);
      onlineList.append(b);
    }
    if (!online.length)
      onlineList.append(el("span", "tree-empty", "Sin contactos en línea"));
  };
  window.renderDreamsTree = () => {
    window.renderDreamsNotify();
    list.replaceChildren();
    const all = active ? [...network(active.id).conversations.values()] : [],
      query = fold($("search").value),
      matches = (c) => !query || fold(c.name).includes(query);
    const rooms = all.filter((c) => c.kind === "channel" && matches(c)),
      privates = all
        .filter((c) => c.kind === "private" && matches(c))
        .sort((a, b) =>
          a.name.localeCompare(b.name, "es", { sensitivity: "base" }),
        );
    list.append(
      group("Salas", "tree-rooms", "treeRoomsOpen", rooms, query),
      group("Privados", "tree-privates", "treePrivatesOpen", privates, query),
    );
    for (const c of all.filter((c) => c.kind === "queries" && matches(c)))
      list.append(node(c, "queries"));
    window.updateDreamsCommandMenu?.();
  };
  window.renderDreamsChannelEvent = (row, m, time) => {
    row.replaceChildren();
    row.classList.add("channel-event", "event-" + m.eventType);
    if (config.settings.timestamps) row.append(time);
    const arrow = el("span", "event-arrow", m.eventType === "join" ? "→" : "←");
    arrow.setAttribute("role", "img");
    arrow.setAttribute(
      "aria-label",
      m.eventType === "join"
        ? "Entrada"
        : m.eventType === "part"
          ? "Salida de sala"
          : "Desconexión",
    );
    const nick = el("button", "event-nick", m.nick);
    nick.type = "button";
    nick.setAttribute("aria-label", "Perfil de " + m.nick);
    nick.onclick = () => {
      if (!config.settings.showUsers) {
        config.settings.showUsers = true;
        applySettings();
        persist().catch(() => {});
      }
      window.openDreamsUser?.(active.id, m.nick);
    };
    nick.oncontextmenu = (e) => userMenu(e, active.id, selected(), m.nick);
    row.append(arrow, nick);
    if (config.settings.eventShowHost && (m.ident || m.host))
      row.append(
        el(
          "span",
          "event-mask",
          " (" + (m.ident || "?") + "@" + (m.host || "?") + ")",
        ),
      );
    const verb =
      {
        join: "ha entrado en la sala",
        part: "ha salido de la sala",
        quit: "se ha desconectado",
        kick: "ha sido expulsado",
      }[m.eventType] || m.eventType;
    row.append(
      document.createTextNode(
        " " + verb + (m.reason ? " · " + DreamsFormatting.plain(m.reason) : ""),
      ),
    );
  };
  const nav = document.querySelector(".menubar nav"),
    menus = [...nav.querySelectorAll(".menu")],
    view = menus.find((n) => n.querySelector("summary")?.textContent === "Ver"),
    networkMenu = menus.find(
      (n) => n.querySelector("summary")?.textContent === "Red",
    );
  function menu(id, text) {
    const d = el("details", "menu");
    d.id = id;
    d.append(el("summary", "", text));
    const popup = el("div", "menu-popup");
    d.append(popup);
    return { node: d, popup };
  }
  const commands = menu("commands-menu", "Comandos");
  view.after(commands.node);
  const commandButtons = [];
  for (const group of DreamsCommands.groups) {
    const category = el("details", "command-category");
    category.open = group.id === "user";
    category.append(el("summary", "", group.label));
    const items = el("div", "command-items");
    for (const item of group.items) {
      const b = el("button", "", "/" + item.command + " · " + item.label);
      b.type = "button";
      b.setAttribute("role", "menuitem");
      b.setAttribute(
        "aria-label",
        group.label + ": /" + item.command + " · " + item.label,
      );
      b.title = "/" + item.command + (item.args ? " " + item.args : "");
      b.onclick = () => {
        const input = $("message-input");
        input.value = "/" + item.command + (item.args ? " " : "");
        input.dispatchEvent(new Event("input"));
        commands.node.open = false;
        input.focus();
      };
      items.append(b);
      commandButtons.push({ b, item, group: group.id });
    }
    category.append(items);
    commands.popup.append(category);
  }
  commands.popup.append(
    el(
      "p",
      "menu-note",
      "Elegí el comando, completá sus argumentos y presioná Enter para enviarlo.",
    ),
  );
  window.updateDreamsCommandMenu = () => {
    const n = active && network(active.id),
      c = selected(),
      connected = n?.state === "connected",
      channel = c?.kind === "channel" && c.joined,
      own = c?.users.find((u) => fold(bareNick(u, n)) === fold(n.nick)) || "",
      ranks = [...statusPrefix(own, n || { prefixes: "" })].map(
        (symbol) => n.prefixModes[n.prefixes.indexOf(symbol)],
      ),
      operator = ranks.some((r) => "oaq".includes(r)),
      moderator = ranks.some((r) => "hoaq".includes(r));
    for (const { b, item, group } of commandButtons) {
      let enabled = !!connected;
      if (group === "channel")
        enabled =
          connected &&
          channel &&
          (item.rule === "operator" ? operator : moderator);
      if (group === "oper")
        enabled = connected && (item.rule === "login" || n.ircOper === true);
      if (item.rule === "channel") enabled = enabled && channel;
      if (item.rule === "local") enabled = !!active;
      if (item.command === "metadata")
        enabled = enabled && n?.capabilities?.includes("draft/metadata-2");
      b.disabled = !enabled;
    }
  };
  commands.node.addEventListener("toggle", () => {
    if (commands.node.open) window.updateDreamsCommandMenu();
  });
  const scripts = menu("scripts-menu", "Scripts");
  networkMenu.after(scripts.node);
  const execute = async (name, data = {}) => {
    if (!api.advanced) throw new Error("Función no disponible.");
    const r = await api.advanced(name, data);
    if (r?.error) throw new Error(r.error);
    return r;
  };
  function scriptButton(text, fn) {
    const b = el("button", "", text);
    b.type = "button";
    b.onclick = () =>
      Promise.resolve()
        .then(fn)
        .catch((e) => notify(e.message, true));
    scripts.popup.append(b);
    return b;
  }
  const openScripts = () =>
    window.openDreamsAdvanced
      ? window.openDreamsAdvanced("scripts")
      : openSettings("diagnostics");
  scriptButton("Administrar scripts .hex", openScripts);
  scriptButton("Importar script .hex…", async () => {
    await execute("script.import");
    openScripts();
  });
  scriptButton("Recargar scripts activos", () => execute("script.reload"));
  const launchers = document.querySelector(".script-launchers");
  if (launchers) scripts.popup.append(launchers);
  scripts.popup.addEventListener("click", (e) => {
    if (e.target.closest("button")) scripts.node.open = false;
  });
  const scriptsInfo = el("div", "scripts-menu-info");
  scripts.popup.append(scriptsInfo);
  scripts.node.addEventListener("toggle", () => {
    if (scripts.node.open && api.advanced)
      execute("status")
        .then((state) => {
          scriptsInfo.replaceChildren();
          for (const alias of state.aliases || []) {
            const b = el("button", "", "/" + alias);
            b.type = "button";
            b.disabled = $("message-input").disabled;
            b.onclick = () => {
              $("message-input").value = "/" + alias + " ";
              $("message-input").dispatchEvent(new Event("input"));
              $("message-input").focus();
              scripts.node.open = false;
            };
            scriptsInfo.append(b);
          }
          for (const script of (state.scripts || []).filter((s) => s.enabled))
            scriptsInfo.append(el("span", "", script.name || script.id));
          if (!scriptsInfo.childElementCount)
            scriptsInfo.append(el("span", "muted", "Sin scripts activos"));
        })
        .catch((e) => notify(e.message, true));
  });
  const formatBar = document.querySelector("#composer .format-bar");
  if ($("emoji-button"))
    formatBar.insertBefore($("emoji-button"), formatBar.querySelector("span"));
  render();
})();
