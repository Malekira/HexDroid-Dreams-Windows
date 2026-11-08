"use strict";
(() => {
  const roots = [...document.querySelectorAll(".menubar .menu")],
    branches = [
      ...document.querySelectorAll(
        ".command-category,.favorites-submenu,.mdi-layout-menu",
      ),
    ];
  const panels = new Map();
  for (const branch of branches) {
    branch.open = false;
    branch.classList.add("menu-submenu");
    let content = branch.querySelector(":scope > div");
    if (!content) {
      content = el("div");
      for (const child of [...branch.children])
        if (child.tagName !== "SUMMARY") content.append(child);
      branch.append(content);
    }
    content.classList.add("menu-flyout");
    content.setAttribute("popover", "manual");
    panels.set(branch, content);
    const summary = branch.querySelector("summary");
    summary.setAttribute("aria-haspopup", "menu");
    summary.setAttribute("aria-expanded", "false");
    branch.addEventListener("toggle", () => {
      summary.setAttribute("aria-expanded", String(branch.open));
      if (!branch.open) {
        if (content.matches(":popover-open")) content.hidePopover();
        return;
      }
      for (const other of branches) if (other !== branch) other.open = false;
      content.showPopover();
      position(branch);
    });
    summary.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        branch.open = true;
        requestAnimationFrame(() =>
          content.querySelector("button:not(:disabled)")?.focus(),
        );
      }
    });
    content.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        branch.open = false;
        summary.focus();
      }
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
        e.preventDefault();
        const buttons = [...content.querySelectorAll("button:not(:disabled)")],
          i = buttons.indexOf(document.activeElement);
        buttons[
          e.key === "Home"
            ? 0
            : e.key === "End"
              ? buttons.length - 1
              : (i + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) %
                buttons.length
        ]?.focus();
      }
    });
    content.addEventListener("click", (e) => {
      if (e.target.closest("button") && !e.target.closest("button").disabled) {
        branch.open = false;
        for (const r of roots) r.open = false;
      }
    });
  }
  function position(branch) {
    const box = branch.querySelector("summary").getBoundingClientRect(),
      p = panels.get(branch);
    p.style.maxHeight = Math.max(100, innerHeight - box.top - 4) + "px";
    const w = p.offsetWidth,
      h = p.offsetHeight;
    p.style.left =
      Math.max(4, Math.min(box.right + 3, innerWidth - w - 4)) + "px";
    p.style.top = Math.max(4, Math.min(box.top, innerHeight - h - 4)) + "px";
  }
  for (const root of roots)
    root.addEventListener("toggle", () => {
      if (!root.open)
        for (const branch of branches)
          if (root.contains(branch)) branch.open = false;
    });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") for (const b of branches) b.open = false;
  });
  window.addEventListener("resize", () => {
    for (const b of branches) b.open = false;
  });
  // Common actions first, then navigation, visibility and window arrangement.
  const view = roots.find(
      (r) => r.querySelector("summary").textContent === "Ver",
    ),
    popup = view.querySelector(".menu-popup");
  const settings = [...popup.children].find(
      (b) => b.textContent === "Configuración",
    ),
    history = [...popup.children].find((b) => b.textContent === "Historial"),
    favorites = $("favorites-menu"),
    windows = popup.querySelector(".mdi-layout-menu"),
    left = popup.querySelector("[data-action=toggle-privates]"),
    users = popup.querySelector("[data-action=toggle-users]");
  popup.replaceChildren(
    settings,
    el("hr"),
    history,
    favorites,
    el("hr"),
    left,
    users,
    el("hr"),
    windows,
  );
  const scripts = $("scripts-menu").querySelector(".menu-popup"),
    entries = [...scripts.querySelectorAll(":scope > button")];
  for (const prefix of ["Administrar", "Editor", "Importar", "Recargar"]) {
    const b = entries.find((b) => b.textContent.startsWith(prefix));
    if (b) scripts.append(b);
  }
})();
