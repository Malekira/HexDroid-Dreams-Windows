"use strict";
(() => {
  const call = async (name, data = {}) => {
    if (!api.advanced) return name === "script.commands" ? [] : {};
    const r = await api.advanced(name, data);
    if (r?.error) throw Error(r.error);
    return r;
  };
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.ctrlKey && e.shiftKey && !e.altKey && e.code === "KeyZ") {
        e.preventDefault();
        call("app.hide").catch((err) => notify(err.message, true));
      }
    },
    true,
  );
  const help = el("dialog", "feature-dialog script-help-dialog");
  help.id = "script-help-dialog";
  document.body.append(help);
  window.openDreamsScriptHelp = async (id) => {
    try {
      const data = await call("script.help", { id });
      help.replaceChildren();
      const header = el("header", "dialog-header"),
        close = el("button", "secondary", "Cerrar");
      header.append(el("h2", "", "Ayuda · " + data.name), close);
      close.onclick = () => help.close();
      const body = el("div", "form-content"),
        search = el("input"),
        list = el("div", "script-command-list");
      search.placeholder = "Buscar comando…";
      search.setAttribute("aria-label", "Buscar comando del script");
      body.append(search, list);
      function draw() {
        list.replaceChildren();
        for (const c of data.commands || []) {
          if (!fold(c.name + " " + c.description).includes(fold(search.value)))
            continue;
          const row = el("article", "script-help-command");
          row.append(
            el("code", "", c.usage || "/" + c.name),
            el("p", "muted", c.description),
          );
          if (c.internal) row.append(el("small", "muted", "Uso interno"));
          list.append(row);
        }
        if (!list.children.length)
          list.append(el("p", "muted", "Sin comandos coincidentes."));
      }
      search.oninput = draw;
      help.append(header, body);
      draw();
      help.showModal();
    } catch (e) {
      notify(e.message, true);
    }
  };
  const input = $("message-input"),
    popup = el("div", "completion-popup"),
    cycle = new DreamsCompletion.Cycle();
  popup.id = "composer-suggestions";
  popup.hidden = true;
  popup.setAttribute("role", "listbox");
  popup.setAttribute("aria-label", "Sugerencias de comandos y apodos");
  document.querySelector(".composer-input").append(popup);
  input.setAttribute("aria-controls", popup.id);
  input.setAttribute("aria-autocomplete", "list");
  let commands = [],
    lastFetch = 0,
    items = [],
    index = -1,
    applying = false;
  const baseCommands = DreamsCommands.groups.flatMap((g) =>
    g.items.map((c) => ({
      name: "/" + c.command,
      description: c.label,
      kind: "Comando",
    })),
  );
  async function refresh() {
    if (Date.now() - lastFetch < 1500) return;
    lastFetch = Date.now();
    try {
      const rows = await call("script.commands");
      commands = (Array.isArray(rows) ? rows : []).map((c) => ({
        name: "/" + c.name,
        description: c.description,
        kind: "Script · " + c.script,
      }));
    } catch {}
    if (document.activeElement === input) show();
  }
  window.refreshDreamsCompletions = () => {
    lastFetch = 0;
    return refresh();
  };
  function hide() {
    popup.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    index = -1;
  }
  function nickValues() {
    const c = selected(),
      n = active && network(active.id);
    return c && n
      ? (c.kind === "private" ? [c.name, n.nick, ...c.users] : c.users).concat(profile(active.id)?.notifyNicks||[],[...n.conversations.values()].filter(c=>c.kind==="channel"&&c.joined!==false).map(c=>c.name)).map(
          (u) => bareNick(u, n),
        )
      : [];
  }
  function candidates(t) {
    if (t.command) {
      const map = new Map();
      for (const c of [...baseCommands, ...commands]) map.set(fold(c.name), c);
      return [...map.values()]
        .filter((c) => fold(c.name).startsWith(fold(t.word)))
        .sort((a, b) => a.name.localeCompare(b.name));
    }
    return DreamsCompletion.matches(nickValues(), t.word).map((name) => ({
      name,
      description: "",
      kind: "Nick",
    }));
  }
  function draw() {
    popup.replaceChildren();
    for (let i = 0; i < items.length; i++) {
      const c = items[i],
        b = el("button", "completion-option");
      b.type = "button";
      b.id = "completion-option-" + i;
      b.setAttribute("role", "option");
      b.setAttribute("aria-selected", String(i === index));
      b.append(
        el("strong", "", c.name),
        el(
          "small",
          "muted",
          c.kind + (c.description ? " · " + c.description : ""),
        ),
      );
      b.onpointerdown = (e) => e.preventDefault();
      b.onclick = () => accept(i);
      popup.append(b);
    }
    if (index >= 0)
      input.setAttribute("aria-activedescendant", "completion-option-" + index);
    else input.removeAttribute("aria-activedescendant");
  }
  function show() {
    if (
      applying ||
      !active ||
      input.disabled ||
      input.selectionStart !== input.selectionEnd
    ) {
      hide();
      return;
    }
    const t = DreamsCompletion.token(input.value, input.selectionStart);
    if (!t.word) {
      hide();
      return;
    }
    items = candidates(t).slice(0, 40);
    index = -1;
    if (!items.length) {
      hide();
      return;
    }
    draw();
    popup.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }
  function replace(value, caret) {
    applying = true;
    input.value = value;
    input.setSelectionRange(caret, caret);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    applying = false;
  }
  function accept(i) {
    const c = items[i];
    if (!c) return;
    const t = DreamsCompletion.token(input.value, input.selectionStart),
      value =
        input.value.slice(0, t.start) +
        (t.command ? c.name : c.name.startsWith("#")||c.name.startsWith("&")?c.name:window.dreamsNickText(c.name, t.start)) +
        " " +
        input.value.slice(input.selectionEnd),
      caret = value.length - input.value.slice(input.selectionEnd).length;
    cycle.reset();
    replace(value, caret);
    if (!t.command && !/^[#&]/.test(c.name)) window.markDreamsNick?.(t.start, caret - 1,c.name);
    hide();
    input.focus();
  }
  input.addEventListener("input", () => {
    if (!applying) {
      cycle.reset();
      show();
    }
  });
  input.addEventListener("focus", () => {
    refresh();
    show();
  });
  input.addEventListener("blur", () =>
    setTimeout(() => {
      if (
        document.activeElement !== input &&
        !popup.contains(document.activeElement)
      )
        hide();
    }, 100),
  );
  input.addEventListener(
    "keydown",
    (e) => {
      if (e.isComposing) return;
      if (e.key === "Tab" && !e.ctrlKey && !e.altKey) {
        const t = DreamsCompletion.token(input.value, input.selectionStart),
          values =
            t.command || cycle.state?.candidates[0]?.startsWith("/")
              ? [...baseCommands, ...commands].map((c) => c.name)
              : nickValues();
        const r = cycle.next(
          input.value,
          input.selectionStart,
          input.selectionEnd,
          active?.id + "|" + active?.target,
          values,
          e.shiftKey ? -1 : 1,
          (name, start) =>
            /^[/#&]/.test(name) ? name : window.dreamsNickText(name, start),
        );
        if (r) {
          e.preventDefault();
          e.stopImmediatePropagation();
          replace(r.value, r.caret);
          if (!/^[/#&]/.test(r.name)) window.markDreamsNick?.(r.start, r.end,r.name);
          hide();
        }
        return;
      }
      if (
        !popup.hidden &&
        ["ArrowDown", "ArrowUp", "Escape", "Enter"].includes(e.key)
      ) {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopImmediatePropagation();
          cycle.reset();
          hide();
          return;
        }
        if (e.key === "Enter") {
          if (index >= 0) {
            e.preventDefault();
            e.stopImmediatePropagation();
            accept(index);
          } else hide();
          return;
        }
        e.preventDefault();
        e.stopImmediatePropagation();
        index =
          (index + (e.key === "ArrowDown" ? 1 : -1) + items.length) %
          items.length;
        draw();
        popup.children[index]?.scrollIntoView({ block: "nearest" });
      }
    },
    true,
  );
  const baseChoose = choose;
  choose = function (...args) {
    cycle.reset();
    hide();
    const result = baseChoose(...args);
    if (!$("message-input").disabled && !document.querySelector("dialog[open]"))
      input.focus({ preventScroll: true });
    return result;
  };
  api.onEvent((event) => {
    if (event.type === "script-commands") {
      lastFetch = 0;
      commands = (event.commands || []).map((c) => ({
        name: "/" + c.name,
        description: c.description,
        kind: "Script · " + c.script,
      }));
      if (document.activeElement === input) show();
    }
  });
  refresh();
})();
