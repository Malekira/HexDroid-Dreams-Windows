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
  const addUser = el("button", "icon-button", "+");
  addUser.id = "notify-add-user";
  addUser.type = "button";
  addUser.setAttribute("aria-label", "Agregar usuario a Notify");
  addUser.onclick = () => window.addDreamsNotifyUser?.();
  notifyHeader.append(addUser);
  const separator = el("hr", "sidebar-section-divider"),
    connectionsHeader = el(
      "div",
      "notify-sidebar-title connections-sidebar-title",
    );
  plus.textContent = "🌐";
  plus.title = "Agregar red";
  connectionsHeader.append(el("strong", "", "Conexiones"), plus);
  const connections = el("div", "sidebar-connections");
  connections.id = "sidebar-connections";
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
    separator,
    connectionsHeader,
    connections,
    searchLabel,
    sortLabel,
    tree,
    footer,
  );
  sidebar.setAttribute("aria-label", "Notify y conversaciones");
  function node(c, kind) {
    const id = active.id;
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
    b.replaceChildren(
      el("span", "tree-label", c.kind === "queries" ? "WHOIS / WHO" : c.name),
    );
    row.dataset.target = fold(c.name);
    row.dataset.network = id;
    b.setAttribute(
      "aria-current",
      String(fold(active.target) === fold(c.name)),
    );
    b.onclick = () => choose(id, c.name);
    row.append(b);
    const close = el("button", "tree-close", "×");
    close.type = "button";
    close.setAttribute(
      "aria-label",
      (kind === "private" ? "Cerrar privado " : "Cerrar nodo ") + c.name,
    );
    close.onclick = () => closeConversation(id, c.name);
    row.append(close);
    row.oncontextmenu = (e) => conversationMenu(e, id, c);
    if (kind === "channel") dragOrder(row, id, c.name);
    return row;
  }
  function group(title, id, key, entries, query) {
    const details = el("details", "tree-group");
    details.id = id;
    details.open = !!query || config.settings[key] !== false;
    details.dataset.initial = String(details.open);
    details.ontoggle = () => {
      if (details.dataset.initial === String(details.open) || $("search").value)
        return;
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
  let notifyView = "";
  window.renderDreamsNotify = () => {
    const id = active?.id,
      allOnline = (id ? window.getDreamsNotify?.(id) || [] : [])
        .filter((p) => p.online === true)
        .sort((a, b) =>
          (a.currentNick || a.nick).localeCompare(
            b.currentNick || b.nick,
            "es",
            { sensitivity: "base" },
          ),
        );
    const people = new Map();
    for (const person of allOnline) {
      const key = fold(person.currentNick || person.nick);
      if (!people.has(key) || fold(person.nick) === key)
        people.set(key, person);
    }
    const online = [...people.values()];
    const signature = JSON.stringify([
      id,
      online.map((p) => [p.nick, p.currentNick]),
    ]);
    if (signature === notifyView) return;
    notifyView = signature;
    onlineList.replaceChildren();
    for (const person of online) {
      const nick = person.currentNick || person.nick;
      const b = el("button", "notify-online-row");
      b.type = "button";
      b.title =
        person.nick !== nick
          ? "Seguimiento de " + person.nick + " → " + nick
          : nick;
      b.setAttribute("aria-label", "Notify " + nick + " en línea");
      b.append(el("span", "online-dot", "●"), el("span", "", nick));
      b.onclick = () => choose(id, nick);
      b.oncontextmenu = (e) =>
        contextMenu.show(e, person.nick, [
          { label: "Abrir privado", action: () => choose(id, nick) },
          {
            label: "Dejar de seguir conexión",
            action: async () => {
              await window.followDreamsUser(id, person.nick);
              window.renderDreamsNotify();
            },
          },
        ]);
      onlineList.append(b);
    }
    if (!online.length)
      onlineList.append(el("span", "tree-empty", "Sin contactos en línea"));
  };
  let treeNetwork;
  window.renderDreamsTree = () => {
    window.renderDreamsNotify();
    const ids = new Set(config.profiles.map((p) => p.id));
    for (const b of connections.children)
      if (!ids.has(b.dataset.network)) b.remove();
    for (const p of config.profiles) {
      let b = [...connections.children].find((b) => b.dataset.network === p.id);
      if (!b) {
        b = el("button", "connection-tree-row");
        b.dataset.network = p.id;
        b.type = "button";
        b.setAttribute("aria-label", "Red " + p.name);
        b.onclick = () => {
          const n = network(p.id);
          choose(
            p.id,
            n.lastTarget && n.conversations.has(fold(n.lastTarget))
              ? n.lastTarget
              : "*",
          );
        };
        connections.append(b);
      }
      b.setAttribute("aria-label", "Red " + p.name);
      b.textContent =
        (network(p.id).state === "connected" ? "● " : "○ ") + p.name;
      b.classList.toggle("active", active?.id === p.id);
    }
    if (treeNetwork !== active?.id) {
      list.replaceChildren();
      treeNetwork = active?.id;
    }
    const all = active ? [...network(active.id).conversations.values()] : [],
      query = fold($("search").value);
    const rooms = all.filter((c) => c.kind === "channel"),
      privates = all
        .filter((c) => c.kind === "private")
        .sort((a, b) =>
          a.name.localeCompare(b.name, "es", { sensitivity: "base" }),
        );
    const desired = new Set();
    function reconcile(parent, entries) {
      let previous = null;
      for (const c of entries) {
        const key = fold(c.name);
        desired.add(key);
        let row = [...list.querySelectorAll(".tree-row")].find(
          (r) => r.dataset.target === key,
        );
        if (!row) row = node(c, c.kind);
        const expected = previous
          ? previous.nextElementSibling
          : parent.querySelector(":scope > .tree-row");
        if (row.parentElement !== parent || expected !== row) {
          if (previous) previous.after(row);
          else if (parent.tagName === "DETAILS")
            parent.querySelector("summary").after(row);
          else parent.append(row);
        }
        previous = row;
        row.hidden = !!query && !key.includes(query);
        row.classList.toggle("active", fold(active?.target || "") === key);
        row.classList.toggle("is-muted", !!c.muted);
        row.classList.toggle(
          "has-activity",
          config.settings.highlightActivity !== false &&
            !c.muted &&
            !!(c.unread || c.activityUntil > Date.now()),
        );
        row.classList.toggle(
          "has-mention",
          !c.muted && !!(c.mentions || c.mentionUntil > Date.now()),
        );
        const b = row.firstElementChild;
        b.setAttribute(
          "aria-current",
          String(fold(active?.target || "") === key),
        );
        let count = b.querySelector(".badge");
        if (c.unread) {
          if (!count) {
            count = el("span", "badge");
            b.append(count);
          }
          count.textContent = String(c.unread);
        } else count?.remove();
      }
    }
    for (const [title, id, key, entries] of [
      ["Salas", "tree-rooms", "treeRoomsOpen", rooms],
      ["Privados", "tree-privates", "treePrivatesOpen", privates],
    ]) {
      let g = $(id);
      if (!g) {
        g = group(title, id, key, [], "");
        g.querySelector(".tree-empty")?.remove();
        list.append(g);
      }
      const visible = entries.filter(
        (c) => !query || fold(c.name).includes(query),
      );
      g.querySelector("summary").textContent =
        title + " (" + visible.length + ")";
      if (query) g.open = true;
      reconcile(g, entries);
    }
    reconcile(
      list,
      all.filter((c) => c.kind === "queries"),
    );
    for (const row of list.querySelectorAll(".tree-row"))
      if (!desired.has(row.dataset.target)) row.remove();
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
