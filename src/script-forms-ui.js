"use strict";
(() => {
  const views = new Map();
  window.showDreamsScriptView = (event, call) => {
    const windowId = event.windowId || event.args?.[0] || "default",
      key = JSON.stringify([
        event.script,
        event.fields?.network || "",
        windowId,
      ]);
    let item = views.get(key);
    if ((event.subtype || event.type) === "view.close") {
      item?.dialog.close();
      return;
    }
    if (!item) {
      if (views.size >= 50) {
        notify("Máximo 50 ventanas de scripts abiertas.", true);
        return;
      }
      const dialog = el("dialog", "script-view"),
        header = el("header", "dialog-header"),
        title = el("h2"),
        close = el("button", "secondary", "Cerrar"),
        content = el("div", "form-content");
      header.append(title, close);
      dialog.append(header, content);
      document.body.append(dialog);
      let drag;
      header.addEventListener("pointerdown", (e) => {
        if (e.button !== 0 || e.target.closest("button")) return;
        const r = dialog.getBoundingClientRect();
        drag = { x: e.clientX, y: e.clientY, left: r.left, top: r.top };
        header.setPointerCapture(e.pointerId);
      });
      header.addEventListener("pointermove", (e) => {
        if (!drag) return;
        dialog.style.left =
          Math.max(
            0,
            Math.min(innerWidth - 80, drag.left + e.clientX - drag.x),
          ) + "px";
        dialog.style.top =
          Math.max(
            0,
            Math.min(innerHeight - 40, drag.top + e.clientY - drag.y),
          ) + "px";
      });
      header.addEventListener("pointerup", () => (drag = null));
      header.addEventListener("pointercancel", () => (drag = null));
      item = {
        dialog,
        title,
        content,
        values: new Map(),
        dirty: new Set(),
        event,
      };
      views.set(key, item);
      close.onclick = () => dialog.close();
      dialog.addEventListener("close", () => {
        views.delete(key);
        dialog.remove();
        call("script.signal", {
          script: event.script,
          network: item.event.fields?.network,
          target: item.event.fields?.buffer,
          signal: "view_closed",
          windowId,
          args: [windowId],
        }).catch((e) => notify(e.message, true));
      });
    }
    item.event = event;
    item.title.textContent = event.title || "Script";
    for (const [k, max] of [
      ["width", 1600],
      ["height", 1200],
    ])
      if (Number.isFinite(event[k]))
        item.dialog.style[k] = Math.max(200, Math.min(max, event[k])) + "px";
    const focused = document.activeElement?.dataset.hexControl,
      selection =
        focused && typeof document.activeElement.selectionStart === "number"
          ? [
              document.activeElement.selectionStart,
              document.activeElement.selectionEnd,
            ]
          : null,
      scroll = item.content.scrollTop;
    const fields = new Map(),
      ids = new Set();
    const send = (signal, node, interaction) => {
      if (!signal) return;
      for (const [id, n] of fields)
        item.values.set(
          id,
          ["checkbox", "radio"].includes(n.type) ? n.checked : n.value,
        );
      const form = Object.fromEntries(item.values);
      if (
        new TextEncoder().encode(JSON.stringify(form)).length > 65536 ||
        Object.keys(form).length > 200
      ) {
        notify("Formulario demasiado grande.", true);
        return;
      }
      call("script.signal", {
        script: event.script,
        network: event.fields?.network,
        target: event.fields?.buffer,
        windowId,
        signal,
        args: node.args || [],
        form,
        control: node.id || node.props?.id || "",
        selected: item.selected || "",
        interaction,
      }).catch((e) => notify(e.message, true));
    };
    function tree(nodes, parent, depth = 0) {
      if (depth > 40) return;
      for (const node of (nodes || []).slice(0, 2000)) {
        const p = node.props || {},
          type = node.type;
        let n;
        if (
          ["input", "textarea", "checkbox", "radio", "select", "list"].includes(
            type,
          )
        ) {
          if (!/^[a-zA-Z0-9_.-]{1,80}$/.test(node.id || "") || ids.has(node.id))
            continue;
          ids.add(node.id);
          n = el(
            ["select", "list"].includes(type)
              ? "select"
              : type === "textarea"
                ? "textarea"
                : "input",
          );
          if (["checkbox", "radio"].includes(type)) {
            n.type = type;
            n.name = key + "|" + (p.group || node.id);
          } else if (type === "input") n.type = "text";
          n.dataset.hexControl = node.id;
          n.setAttribute("aria-label", p.label || node.id);
          n.placeholder = p.placeholder || "";
          n.disabled = !!p.disabled;
          if (type === "list")
            n.size = Math.max(2, Math.min(20, Number(p.size) || 6));
          for (const o of (node.children || [])
            .filter((o) => o.type === "option")
            .slice(0, 1000)) {
            const option = el("option", "", o.text || o.value);
            option.value = o.value;
            n.append(option);
          }
          const value =
            item.dirty.has(node.id) && !p.reset
              ? item.values.get(node.id)
              : (node.value ?? "");
          if (["checkbox", "radio"].includes(type))
            n.checked = value === true || value === "true" || value === "1";
          else n.value = String(value);
          const read = () =>
            ["checkbox", "radio"].includes(type) ? n.checked : n.value;
          item.values.set(node.id, read());
          fields.set(node.id, n);
          if (type === "list" && !item.selected) item.selected = n.value;
          const change = () => {
            if (type === "radio" && n.checked)
              for (const [id, other] of fields)
                if (
                  other !== n &&
                  other.type === "radio" &&
                  other.name === n.name
                ) {
                  other.checked = false;
                  item.values.set(id, false);
                  item.dirty.add(id);
                }
            item.values.set(node.id, read());
            item.dirty.add(node.id);
            if (type === "list" || type === "select") item.selected = n.value;
          };
          n.oninput = change;
          n.onchange = () => {
            change();
            send(p.onchange, node, "change");
          };
          n.onclick = () => {
            change();
            send(p.onclick, node, "click");
          };
          n.ondblclick = () => {
            change();
            send(p.ondblclick, node, "double-click");
          };
        } else if (type === "button") {
          n = el("button", "hex-button", node.text);
          n.type = "button";
          n.disabled = !!p.disabled;
          n.onclick = () => send(node.action, node, "click");
        } else if (
          [
            "column",
            "row",
            "stack",
            "ring",
            "surface",
            "text",
            "card",
            "image",
            "spacer",
            "label",
          ].includes(type)
        ) {
          n = el(
            "div",
            "hex-" + type,
            type === "image" ? "[Imagen: " + node.text + "]" : node.text,
          );
          tree(node.children, n, depth + 1);
        } else continue;
        for (const [k, css] of Object.entries({
          color: "color",
          bg: "backgroundColor",
        }))
          if (/^#[a-f\d]{3,8}$/i.test(p[k] || "")) n.style[css] = p[k];
        for (const [k, css, max] of [
          ["width", "width", 1400],
          ["height", "height", 1000],
          ["pad", "padding", 32],
          ["gap", "gap", 32],
          ["radius", "borderRadius", 32],
          ["textsize", "fontSize", 36],
          ["offsetx", "marginLeft", 1200],
          ["offsety", "marginTop", 1000],
        ])
          if (p[k] !== undefined && Number.isFinite(Number(p[k])))
            n.style[css] = Math.max(0, Math.min(max, Number(p[k]))) + "px";
        if (p.bold) n.style.fontWeight = "700";
        if (p.fill) n.style.width = "100%";
        if (p.label && type !== "button") {
          const label = el("label", "hex-field", p.label);
          label.append(n);
          parent.append(label);
        } else parent.append(n);
      }
    }
    item.content.replaceChildren();
    tree(event.tree || event.view || event.nodes, item.content);
    for (const id of item.values.keys())
      if (!ids.has(id)) {
        item.values.delete(id);
        item.dirty.delete(id);
      }
    item.content.scrollTop = scroll;
    if (!item.dialog.open) item.dialog.show();
    const input = fields.get(focused);
    if (input) {
      input.focus({ preventScroll: true });
      if (selection)
        try {
          input.setSelectionRange(...selection);
        } catch {}
    }
  };
})();
