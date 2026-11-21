"use strict";
function editorMenu(params, contents) {
  if (!params.isEditable) return null;
  const items = [];
  if (params.misspelledWord) {
    for (const word of params.dictionarySuggestions || [])
      items.push({
        label: word,
        click: () => contents.replaceMisspelling(word),
      });
    if (!params.dictionarySuggestions?.length)
      items.push({ label: "Sin sugerencias", enabled: false });
    items.push(
      {
        label: "Añadir al diccionario",
        click: () =>
          contents.session.addWordToSpellCheckerDictionary(
            params.misspelledWord,
          ),
      },
      { type: "separator" },
    );
  }
  items.push(
    { role: "undo", label: "Deshacer" },
    { role: "redo", label: "Rehacer" },
    { type: "separator" },
    { role: "cut", label: "Cortar" },
    { role: "copy", label: "Copiar" },
    { role: "paste", label: "Pegar" },
    { role: "selectAll", label: "Seleccionar todo" },
  );
  return items;
}
function attachEditorMenu(window, Menu) {
  const contents = window.webContents;
  const languages = contents.session.availableSpellCheckerLanguages || [];
  const spanish = languages.includes("es")
    ? "es"
    : languages.includes("es-ES")
      ? "es-ES"
      : null;
  if (spanish)
    contents.session.setSpellCheckerLanguages([
      spanish,
      ...(languages.includes("en-US") ? ["en-US"] : []),
    ]);
  contents.on("context-menu", (_event, params) => {
    const template = editorMenu(params, contents);
    if (template) Menu.buildFromTemplate(template).popup({ window });
  });
}
module.exports = { editorMenu, attachEditorMenu };
