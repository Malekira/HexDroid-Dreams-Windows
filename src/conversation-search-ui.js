"use strict";
(() => {
  const states = new WeakMap();
  function draw(id, c, root) {
    if (!root) return [];
    const query = c.searchOpen ? (c.searchQuery || "").toLocaleLowerCase() : "";
    const signature = JSON.stringify([
      id,
      fold(c.name),
      query,
      c.revision,
      c.messages.length,
    ]);
    let state = states.get(root);
    if (!query && !state?.matches?.length) return [];
    if (state?.signature === signature) return state.matches;
    for (const mark of root.querySelectorAll("mark.chat-match"))
      mark.replaceWith(document.createTextNode(mark.textContent));
    root.normalize();
    const matches = [];
    if (query) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
          acceptNode(node) {
            return node.parentElement.closest(
              ".message-text,.message-nick,.event-text,.event-nick,.action-nick",
            ) && !node.parentElement.closest("button.message-media")
              ? NodeFilter.FILTER_ACCEPT
              : NodeFilter.FILTER_REJECT;
          },
        }),
        nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const node of nodes) {
        const text = node.textContent,
          lower = text.toLocaleLowerCase();
        let at = 0,
          index = lower.indexOf(query),
          fragment = document.createDocumentFragment();
        if (index < 0) continue;
        while (index >= 0) {
          fragment.append(document.createTextNode(text.slice(at, index)));
          const mark = el(
            "mark",
            "chat-match",
            text.slice(index, index + query.length),
          );
          fragment.append(mark);
          matches.push(mark);
          at = index + query.length;
          index = lower.indexOf(query, at);
        }
        fragment.append(document.createTextNode(text.slice(at)));
        node.replaceWith(fragment);
      }
    }
    states.set(root, { signature, matches });
    return matches;
  }
  function roots(id, c) {
    if (active?.id === id && fold(active.target) === fold(c.name))
      return [$("messages"), $("channel-events")].filter(Boolean);
    const w = [...document.querySelectorAll(".mdi-window")].find(
      (w) =>
        w.dataset.network === id && fold(w.dataset.target) === fold(c.name),
    );
    return w ? [...w.querySelectorAll(".mdi-messages,.mdi-events")] : [];
  }
  function refresh(id, c, navigate = false) {
    const marks = roots(id, c).flatMap((root) => draw(id, c, root));
    if (!marks.length) c.searchIndex = -1;
    else
      c.searchIndex = Math.max(
        0,
        Math.min(marks.length - 1, c.searchIndex || 0),
      );
    marks.forEach((mark, i) =>
      mark.classList.toggle("current-match", i === c.searchIndex),
    );
    const text = marks.length
      ? c.searchIndex + 1 + " / " + marks.length
      : "0 coincidencias";
    if (active?.id === id && fold(active.target) === fold(c.name))
      $("search-count").textContent = text;
    else {
      const root = roots(id, c)[0]?.closest(".mdi-window");
      if (root?.querySelector(".chat-search-count"))
        root.querySelector(".chat-search-count").textContent = text;
    }
    if (navigate && marks[c.searchIndex])
      marks[c.searchIndex].scrollIntoView({
        block: "center",
        inline: "nearest",
      });
    return marks;
  }
  function step(direction) {
    const c = selected();
    if (!c) return;
    const marks = refresh(active.id, c);
    if (marks.length) {
      c.searchIndex =
        ((c.searchIndex || 0) + direction + marks.length) % marks.length;
      refresh(active.id, c, true);
    }
  }
  const bar = $("chat-search"),
    input = $("message-search");
  input.placeholder = "Buscar en esta conversación…";
  for (const [label, direction] of [
    ["Coincidencia anterior", -1],
    ["Coincidencia siguiente", 1],
  ]) {
    const b = el("button", "search-step", direction < 0 ? "↑" : "↓");
    b.type = "button";
    b.setAttribute("aria-label", label);
    b.onclick = () => step(direction);
    $("search-count").before(b);
  }
  function close() {
    const c = selected();
    if (c) {
      c.searchOpen = false;
      c.searchQuery = "";
      c.searchIndex = -1;
    }
    input.value = "";
    bar.hidden = true;
    if (c) refresh(active.id, c);
    render(true);
    $("message-input").focus();
  }
  bar.querySelector("button[data-action=search-messages]").onclick = (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
    close();
  };
  input.oninput = () => {
    const c = selected();
    if (!c) return;
    c.searchQuery = input.value;
    c.searchIndex = 0;
    render(true);
  };
  input.onkeydown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      step(e.shiftKey ? -1 : 1);
    }
  };
  actions["search-messages"] = () => {
    const c = selected();
    if (!c) return;
    c.searchOpen = true;
    bar.hidden = false;
    input.value = c.searchQuery || "";
    input.focus();
    input.select();
    refresh(active.id, c);
  };
  document.addEventListener(
    "keydown",
    (e) => {
      if (
        e.ctrlKey &&
        !e.altKey &&
        e.key.toLowerCase() === "f" &&
        !document.querySelector("dialog[open]")
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        actions["search-messages"]();
      } else if (
        e.key === "Escape" &&
        selected()?.searchOpen &&
        !document.querySelector("dialog[open]")
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        close();
      }
    },
    true,
  );
  window.createDreamsConversationSearch = (id, c) => {
    if (!c.searchOpen) return null;
    const box = el("div", "chat-search"),
      field = el("input"),
      count = el("span", "chat-search-count");
    field.value = c.searchQuery || "";
    field.placeholder = "Buscar en esta conversación…";
    field.setAttribute("aria-label", "Buscar en " + c.name);
    box.append(field, count);
    const activate = () => {
      choose(id, c.name, false);
      $("message-search").focus();
    };
    field.onfocus = activate;
    field.oninput = () => {
      c.searchQuery = field.value;
      c.searchIndex = 0;
      refresh(id, c);
    };
    for (const [label, direction] of [
      ["Coincidencia anterior", -1],
      ["Coincidencia siguiente", 1],
      ["Cerrar búsqueda", 0],
    ]) {
      const b = el(
        "button",
        "",
        direction < 0 ? "↑" : direction > 0 ? "↓" : "×",
      );
      b.type = "button";
      b.setAttribute("aria-label", label + " de " + c.name);
      b.onclick = () => {
        choose(id, c.name, false);
        if (direction) step(direction);
        else close();
      };
      box.append(b);
    }
    return box;
  };
  const baseRender = render;
  render = function (...args) {
    const c = selected();
    if (c) {
      input.value = c.searchQuery || "";
      bar.hidden = !c.searchOpen;
    } else bar.hidden = true;
    const result = baseRender(...args);
    for (const [id, n] of networks)
      for (const c of n.conversations.values())
        if (c.searchOpen) refresh(id, c);
    return result;
  };
})();
