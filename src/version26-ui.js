"use strict";
(() => {
  const appearance = document.querySelector("[data-panel=appearance]"),
    chat = document.querySelector("[data-panel=chat]"),
    block = el("section", "chat-format-block chat-presentation"),
    heading = el("div", "chat-format-heading"),
    fields = el("div", "chat-general-settings");
  heading.append(el("h4", "", "Presentación del chat"));
  block.append(heading, fields);
  chat.append(block);
  for (const id of [
    "setting-font",
    "setting-fontFamily",
    "setting-compact",
    "setting-timestamps",
  ])
    fields.append($(id).closest("label"));
  const palette = [...appearance.querySelectorAll("label")].find((label) =>
    label.querySelector('select[aria-label="Colores de nicks"]'),
  );
  if (palette) fields.append(palette);
  for (const button of document.querySelectorAll(".settings-nav button"))
    if (["Tema", "Temas"].includes(button.textContent.trim())) button.remove();
  const menu = [...document.querySelectorAll(".menubar nav>.menu")].find(
    (menu) => menu.querySelector(":scope>summary")?.textContent === "Chat",
  );
  if (menu) {
    const corrector = [...menu.querySelectorAll("button")].find(
      (b) => b.textContent === "Corrector multicolor",
    );
    if (corrector) {
      corrector.className = "chat-corrector";
      heading.append(corrector);
    }
    menu.remove();
  }
})();
