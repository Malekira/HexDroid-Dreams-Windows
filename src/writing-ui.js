"use strict";
(() => {
  const input = $("message-input");
  let model = new DreamsWriting.Ranges(input.value);
  const context = () => ({
    network: profile(active?.id)?.name,
    target: active?.target,
  });
  const store = () => {
    const c = selected();
    if (c) c.writingRanges = structuredClone(model.ranges);
  };
  function reconcile() {
    model.edit(input.value);
    store();
  }
  const canFormat = (start) => {
    if (!input.value.startsWith("/")) return true;
    const m = /^(\/me\s+|\/(?:msg|notice)\s+\S+\s+)/i.exec(input.value);
    return !!m && start >= m[0].length;
  };
  window.dreamsNickText = (nick, start) => {
    if (!canFormat(start)) return nick;
    const text = DreamsWriting.nickText(
      nick,
      config.settings,
      context(),
      start,
    );
    return start === 0 && text.startsWith("/") ? "/" + text : text;
  };
  window.markDreamsNick = (start, end) => {
    reconcile();
    const s = config.settings.nickCompletion || {};
    if (s.enabled && canFormat(start) && (!s.onlyStart || start === 0))
      model.mark(start, end, s);
    store();
  };
  input.addEventListener(
    "input",
    (e) => {
      if (e.isComposing) return;
      reconcile();
      if (
        input.selectionStart === input.value.length &&
        /\s$/.test(input.value)
      ) {
        const value = DreamsWriting.replaceWords(
          input.value,
          config.settings,
          false,
        );
        if (value !== input.value) {
          input.value = value;
          input.setSelectionRange(value.length, value.length);
          reconcile();
        }
      }
    },
    true,
  );
  window.prepareDreamsOutgoing = (text, prefix = "") => {
    model.edit(text);
    const expanded = DreamsWriting.replaceWords(text, config.settings);
    model.edit(expanded);
    const formatted = model.format(prefix);
    return formatted;
  };
  const baseChoose = choose;
  choose = function (...args) {
    reconcile();
    const r = baseChoose(...args);
    model = new DreamsWriting.Ranges(
      input.value,
      selected()?.writingRanges || [],
    );
    return r;
  };
  $("composer").addEventListener("submit", () =>
    setTimeout(() => {
      model.edit(input.value);
      store();
    }, 0),
  );
  const run = (fn) =>
    Promise.resolve()
      .then(fn)
      .catch((e) => notify(e.message, true));
  const commit = async (values) => {
    Object.assign(config.settings, values);
    await persist();
    applySettings();
    render();
  };
  window.renderDreamsWritingSettings = (parent) => {
    parent.replaceChildren(el("h3", "", "Diccionario y nick completion"));
    function field(label, type, value, host = parent) {
      const l = el("label", "setting-row", label),
        i = el(type === "select" ? "select" : "input");
      if (type !== "select") i.type = type;
      if (type === "checkbox") i.checked = !!value;
      else i.value = value ?? "";
      i.setAttribute("aria-label", label);
      l.append(i);
      host.append(l);
      return i;
    }
    const enabled = field(
      "Activar diccionario",
      "checkbox",
      config.settings.dictionaryEnabled !== false,
    );
    enabled.onchange = () =>
      run(() => commit({ dictionaryEnabled: enabled.checked }));
    const add = el("form", "dictionary-editor"),
      from = el("input"),
      to = el("input"),
      addButton = el("button", "secondary", "Añadir"),
      caseLabel = el("label", "compact-check"),
      matchCase = el("input");
    from.placeholder = "XDD";
    from.maxLength = 40;
    from.setAttribute("aria-label", "Abreviatura");
    to.placeholder = "Texto o emojis";
    to.maxLength = 1000;
    to.setAttribute("aria-label", "Reemplazo");
    matchCase.type = "checkbox";
    caseLabel.append(
      matchCase,
      document.createTextNode("Distinguir mayúsculas"),
    );
    addButton.type = "submit";
    add.append(from, to, addButton, caseLabel);
    parent.append(add);
    parent.append(
      el(
        "p",
        "note",
        "Se reemplazan palabras completas al pulsar espacio o enviar. Los comandos conservan su nombre y destinatario.",
      ),
    );
    const list = el("div", "dictionary-list");
    parent.append(list);
    let editing = -1;
    function draw() {
      list.replaceChildren();
      (config.settings.dictionary || []).forEach((r, i) => {
        const row = el("div", "dictionary-row"),
          check = el("input"),
          name = el("strong", "", r.from),
          text = el("span", "", r.to),
          edit = el("button", "secondary", "Editar"),
          remove = el("button", "secondary", "Quitar");
        check.type = "checkbox";
        check.checked = r.enabled;
        check.setAttribute("aria-label", "Activar reemplazo " + r.from);
        check.onchange = () =>
          run(async () => {
            config.settings.dictionary[i].enabled = check.checked;
            await commit({});
          });
        edit.type = remove.type = "button";
        edit.onclick = () => {
          editing = i;
          from.value = r.from;
          to.value = r.to;
          matchCase.checked = r.matchCase;
          addButton.textContent = "Guardar";
          from.focus();
        };
        remove.onclick = () =>
          run(async () => {
            const rules = [...config.settings.dictionary];
            rules.splice(i, 1);
            await commit({ dictionary: rules });
            editing = -1;
            addButton.textContent = "Añadir";
            draw();
          });
        row.append(check, name, text, edit, remove);
        list.append(row);
      });
      if (!list.children.length)
        list.append(el("p", "note", "Sin reemplazos. Ejemplo: XDD → 😂."));
    }
    add.onsubmit = (e) => {
      e.preventDefault();
      run(async () => {
        const rule = {
          from: from.value.trim(),
          to: to.value,
          enabled: true,
          matchCase: matchCase.checked,
        };
        if (!rule.from || /\s/.test(rule.from) || !rule.to)
          throw Error("Escribe una abreviatura sin espacios y su reemplazo.");
        const rules = [...(config.settings.dictionary || [])],
          duplicate = rules.findIndex(
            (r) => r.from.toLocaleLowerCase() === rule.from.toLocaleLowerCase(),
          );
        if (editing < 0 && duplicate >= 0)
          throw Error("Esa abreviatura ya existe; usa Editar.");
        if (editing >= 0) rules[editing] = rule;
        else {
          if (rules.length >= 500) throw Error("Máximo 500 reemplazos.");
          rules.push(rule);
        }
        await commit(
          DreamsWriting.validate({ ...config.settings, dictionary: rules }),
        );
        from.value = to.value = "";
        editing = -1;
        addButton.textContent = "Añadir";
        draw();
      });
    };
    draw();
    const section = el("section", "nick-completion-editor");
    parent.append(section);
    section.append(el("h3", "", "Nick completion"));
    let draft = DreamsWriting.validate(config.settings).nickCompletion;
    const on = field(
        "Personalizar nick completion",
        "checkbox",
        draft.enabled,
        section,
      ),
      template = field("Plantilla", "text", draft.template, section);
    template.maxLength = 240;
    const tools = el("div", "settings-actions");
    for (const token of ["{nick}", "{red}", "{sala}", "👋", "💜", "✨"]) {
      const b = el("button", "secondary", token);
      b.type = "button";
      b.onclick = () => {
        template.setRangeText(
          token,
          template.selectionStart ?? template.value.length,
          template.selectionEnd ?? template.value.length,
          "end",
        );
        preview();
        template.focus();
      };
      tools.append(b);
    }
    section.append(tools);
    const grid = el("div", "writing-colors");
    section.append(grid);
    const useColor = field("Color", "checkbox", !!draft.color, grid),
      color = field(
        "Color del nick completado",
        "color",
        draft.color || "#a050cf",
        grid,
      ),
      useBg = field("Fondo", "checkbox", !!draft.background, grid),
      bg = field(
        "Fondo del nick completado",
        "color",
        draft.background || "#141932",
        grid,
      );
    const styles = el("div", "writing-styles");
    section.append(styles);
    const bold = field("Negrita", "checkbox", draft.bold, styles),
      italic = field("Cursiva", "checkbox", draft.italic, styles),
      underline = field("Subrayado", "checkbox", draft.underline, styles),
      onlyStart = field(
        "Solo al inicio del mensaje",
        "checkbox",
        draft.onlyStart,
        section,
      ),
      sample = el("div", "writing-preview");
    sample.setAttribute("aria-label", "Vista previa del nick completion");
    section.append(sample);
    function preview() {
      draft = {
        enabled: on.checked,
        template: template.value,
        color: useColor.checked ? color.value : null,
        background: useBg.checked ? bg.value : null,
        bold: bold.checked,
        italic: italic.checked,
        underline: underline.checked,
        onlyStart: onlyStart.checked,
      };
      color.disabled = !useColor.checked;
      bg.disabled = !useBg.checked;
      DreamsFormatting.render(
        sample,
        DreamsWriting.prefix(draft) +
          DreamsWriting.nickText(
            "Luna",
            { nickCompletion: { ...draft, enabled: true } },
            context(),
          ) +
          "\x0f",
      );
    }
    for (const i of [
      on,
      template,
      useColor,
      color,
      useBg,
      bg,
      bold,
      italic,
      underline,
      onlyStart,
    ])
      i.oninput = preview;
    const help = el("details", "writing-help");
    help.append(el("summary", "", "Ayuda y ejemplos"));
    help.append(
      el(
        "p",
        "note",
        "{nick} se sustituye por el apodo, {red} por la red y {sala} por la conversación. Puedes poner emojis y texto antes o después. Tab sigue recorriendo los nicks originales; Shift+Tab retrocede.",
      ),
    );
    for (const example of ["{nick}:", "👋 {nick} 💜", "✨ {nick} →"]) {
      const b = el("button", "secondary", example);
      b.type = "button";
      b.onclick = () => {
        template.value = example;
        preview();
      };
      help.append(b);
    }
    section.append(help);
    const save = el("button", "primary", "Guardar nick completion");
    save.type = "button";
    save.onclick = () =>
      run(async () => {
        preview();
        if (!draft.template.includes("{nick}"))
          throw Error("Incluye {nick} en la plantilla.");
        await commit({
          nickCompletion: DreamsWriting.validate({ nickCompletion: draft })
            .nickCompletion,
        });
        notify("Nick completion guardado.");
      });
    section.append(save);
    preview();
  };
})();
