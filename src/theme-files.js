"use strict";
const { validateSettings } = require("./storage"),
  { snapshot } = require("./themes");
function parseTheme(input) {
  if (typeof input === "string") {
    if (Buffer.byteLength(input) > 262144)
      throw Error("El tema supera 256 KB.");
    input = JSON.parse(input);
  }
  if (
    !input ||
    input.format !== "hexdreams-theme" ||
    input.version !== 1 ||
    typeof input.name !== "string" ||
    !input.name.trim() ||
    !input.settings ||
    typeof input.settings !== "object"
  )
    throw Error("Archivo de tema no válido.");
  return {
    id: require("node:crypto").randomUUID(),
    name: input.name.trim().slice(0, 80),
    settings: snapshot(validateSettings(snapshot(input.settings))),
  };
}
function serializeTheme(name, settings) {
  const t = parseTheme({
    format: "hexdreams-theme",
    version: 1,
    name,
    settings,
  });
  return (
    JSON.stringify(
      {
        format: "hexdreams-theme",
        version: 1,
        name: t.name,
        settings: t.settings,
      },
      null,
      2,
    ) + "\n"
  );
}
module.exports = { parseTheme, serializeTheme };
