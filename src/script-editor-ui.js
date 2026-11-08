"use strict";
(() => {
  const dialog = el("dialog", "feature-dialog script-editor");
  dialog.id = "script-editor-dialog";
  const header = el("header", "dialog-header"),
    body = el("div", "script-editor-body"),
    tools = el("div", "script-editor-tools"),
    feedback = el("p", "note");
  feedback.setAttribute("role", "status");
  header.append(el("h2", "", "Editor de scripts .hex"));
  const close = el("button", "secondary", "Cerrar");
  header.append(close);
  const select = el("select");
  select.setAttribute("aria-label", "Script instalado");
  const name = el("input");
  name.setAttribute("aria-label", "Nombre del script");
  name.placeholder = "Nombre.hex";
  name.maxLength = 100;
  const source = el("textarea");
  source.setAttribute("aria-label", "Código del script");
  source.spellcheck = false;
  source.wrap = "off";
  const position = el("small", "muted");
  body.append(tools, name, source, position, feedback);
  dialog.append(header, body);
  document.body.append(dialog);
  let current = {},
    baseline = "",
    last = "",
    pending = false;
  const call = async (action, data = {}) => {
    if (!api.advanced)
      throw Error("Disponible en la aplicación de escritorio.");
    const result = await api.advanced(action, data);
    if (result?.error) throw Error(result.error);
    return result;
  };
  const snapshot = () => JSON.stringify([name.value, source.value]);
  const discard = () =>
    snapshot() === baseline ||
    window.confirm("¿Descartar los cambios sin guardar del script?");
  function positionText() {
    const prefix = source.value.slice(0, source.selectionStart);
    position.textContent =
      "Línea " +
      prefix.split("\n").length +
      " · Columna " +
      (prefix.length - prefix.lastIndexOf("\n")) +
      " · " +
      new TextEncoder().encode(source.value).length +
      " bytes";
  }
  function load(data = {}) {
    current = data;
    name.value = data.name || "Nuevo.hex";
    source.value = data.source || "";
    baseline = snapshot();
    last = select.value = data.id || "";
    feedback.textContent =
      "Guardar en la aplicación lo deja desactivado. Al activarlo recibe todos los permisos.";
    positionText();
  }
  async function fill() {
    select.replaceChildren();
    const fresh = el("option", "", "Nuevo script");
    fresh.value = "";
    select.append(fresh);
    for (const script of await call("script.list")) {
      const option = el("option", "", script.name);
      option.value = script.id;
      select.append(option);
    }
    select.value = current.id || "";
  }
  function button(text, fn) {
    const b = el("button", "secondary", text);
    b.type = "button";
    b.onclick = async () => {
      if (pending) return;
      pending = true;
      for (const control of tools.children) control.disabled = true;
      try {
        await fn();
      } catch (e) {
        feedback.textContent = e.message;
      } finally {
        pending = false;
        for (const control of tools.children) control.disabled = false;
      }
    };
    tools.append(b);
    return b;
  }
  tools.append(select);
  select.onchange = async () => {
    if (!discard()) {
      select.value = last;
      return;
    }
    try {
      load(select.value ? await call("script.read", { id: select.value }) : {});
    } catch (e) {
      feedback.textContent = e.message;
      select.value = last;
    }
  };
  button("Abrir archivo…", async () => {
    if (!discard()) return;
    const data = await call("script.openFile");
    if (!data.cancelled) load(data);
  });
  button("Validar", async () => {
    await call("script.validate", { source: source.value });
    feedback.textContent = "Sintaxis válida. No se ejecutó el script.";
  });
  button("Guardar en la aplicación", async () => {
    const data = await call("script.save", {
      id: current.id,
      revision: current.revision,
      name: name.value,
      source: source.value,
    });
    load(data);
    await fill();
    feedback.textContent =
      "Guardado y desactivado. Puedes activarlo desde Administrar scripts.";
  });
  button("Guardar archivo…", async () => {
    const result = await call("script.exportSource", {
      name: name.value,
      source: source.value,
    });
    if (result.ok) {
      baseline = snapshot();
      feedback.textContent = "Archivo guardado. No se instaló ni ejecutó.";
    }
  });
  const finish = () => {
    if (!pending && discard()) dialog.close();
  };
  close.onclick = finish;
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    finish();
  });
  source.oninput = positionText;
  source.onclick = positionText;
  source.onkeyup = positionText;
  source.onkeydown = (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      source.setRangeText(
        "  ",
        source.selectionStart,
        source.selectionEnd,
        "end",
      );
      positionText();
    }
  };
  window.openDreamsScriptEditor = async () => {
    try {
      if (dialog.open) {
        source.focus();
        return;
      }
      load({});
      await fill();
      dialog.showModal();
      source.focus();
    } catch (e) {
      notify(e.message, true);
    }
  };
})();
