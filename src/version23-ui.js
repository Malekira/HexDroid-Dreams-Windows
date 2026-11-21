"use strict";
(() => {
  const line = $("setting-lineHeight"),
    gap = $("setting-messageSpacing"),
    section = line.closest("section"),
    preview = el("div", "chat-spacing-preview");
  preview.setAttribute("aria-label", "Vista previa del espaciado");
  for (const text of [
    "Nora: Así se verá un mensaje con dos líneas.\nEsta es la segunda línea.",
    "Hannii: Y esta será la separación con el siguiente.",
  ])
    preview.append(el("div", "chat-spacing-line", text));
  section.append(preview);
  const points = () => ({
    line:
      config.settings.lineHeightPt ??
      (config.settings.fontSize || 14) *
        (config.settings.lineHeight || 1.65) *
        0.75,
    gap:
      config.settings.messageSpacingPt ??
      (config.settings.messageSpacing ?? 9) * 1.5,
  });
  function update() {
    const s = config.settings,
      p = points(),
      windowBg = s.roomAppearance?.windowBackground;
    line.value = Math.round(p.line * 10) / 10;
    gap.value = Math.round(p.gap * 10) / 10;
    preview.style.fontFamily = s.fontFamily || "Segoe UI";
    preview.style.fontSize = (s.fontSize || 14) + "px";
    preview.style.lineHeight = p.line + "pt";
    preview.style.background = s.roomAppearance?.background || "var(--bg)";
    preview.style.color = DreamsFormatting.readableColor(
      s.roomAppearance?.text ||
        getComputedStyle(document.documentElement)
          .getPropertyValue("--text")
          .trim(),
      getComputedStyle(preview).backgroundColor,
    );
    preview.style.setProperty(
      "--preview-gap",
      Number.isFinite(s.messageSpacingPt)
        ? p.gap + "pt"
        : (s.messageSpacing ?? 9) * 2 + "px",
    );
    document.body.toggleAttribute("data-chat-window-color", !!windowBg);
    if (windowBg) {
      document.documentElement.style.setProperty("--chat-window-bg", windowBg);
      document.documentElement.style.setProperty(
        "--chat-window-fg",
        DreamsFormatting.readableColor(
          getComputedStyle(document.documentElement)
            .getPropertyValue("--text")
            .trim(),
          windowBg,
        ),
      );
    } else {
      document.documentElement.style.removeProperty("--chat-window-bg");
      document.documentElement.style.removeProperty("--chat-window-fg");
    }
  }
  for (const [input, key, min, max] of [
    [line, "lineHeightPt", 8, 96],
    [gap, "messageSpacingPt", 0, 60],
  ]) {
    input.oninput = () => {
      if (input.value === "" || !input.validity.valid) return;
      config.settings[key] = Math.max(min, Math.min(max, Number(input.value)));
      applySettings();
      render(true);
    };
    input.onchange = () => {
      input.oninput();
      persist().catch((e) => notify(e.message, true));
    };
  }
  const baseApply = applySettings;
  applySettings = function (...args) {
    const result = baseApply(...args);
    update();
    return result;
  };
  update();
  const watched = new Map();
  function syncPrivates() {
    if (!api.advanced) return;
    const ids = new Set(config.profiles.map((p) => p.id));
    for (const id of watched.keys()) if (!ids.has(id)) watched.delete(id);
    for (const [id, n] of networks) {
      if (!ids.has(id)) continue;
      if (n.privatePresence) {
        for (const key of Object.keys(n.privatePresence))
          if (n.conversations.get(key)?.kind !== "private")
            delete n.privatePresence[key];
      }
      if (n.state !== "connected") {
        watched.delete(id);
        continue;
      }
      const names = [...n.conversations.values()]
          .filter(
            (c) =>
              c.kind === "private" &&
              !c.name.includes("@") &&
              !DreamsServices.isService(c.name),
          )
          .map((c) => c.name)
          .sort(),
        signature = JSON.stringify(names);
      if (watched.get(id) === signature) continue;
      watched.set(id, signature);
      api
        .advanced("presence.privates", { network: id, nicks: names })
        .then((r) => {
          if (r?.error) {
            watched.delete(id);
            notify(r.error, true);
          }
        })
        .catch((e) => {
          watched.delete(id);
          notify(e.message, true);
        });
    }
  }
  const baseRender = render;
  render = function (...args) {
    const result = baseRender(...args);
    syncPrivates();
    return result;
  };
  syncPrivates();
})();
