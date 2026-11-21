"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { editorMenu, attachEditorMenu } = require("../src/services/editor-menu");
test("Editable spelling menu replaces a word through Electron and allows adding it to the dictionary", () => {
  const replacements = [],
    words = [],
    wc = {
      replaceMisspelling: (w) => replacements.push(w),
      session: { addWordToSpellCheckerDictionary: (w) => words.push(w) },
    };
  const menu = editorMenu(
    {
      isEditable: true,
      misspelledWord: "holaa",
      dictionarySuggestions: ["hola", "holas"],
    },
    wc,
  );
  menu[0].click();
  menu.find((x) => x.label === "Añadir al diccionario").click();
  assert.deepEqual(replacements, ["hola"]);
  assert.deepEqual(words, ["holaa"]);
  assert.ok(menu.some((x) => x.role === "paste"));
});
test("Correct words still have editing actions and non-editable chat keeps its own context menu", () => {
  assert.equal(editorMenu({ isEditable: false }, {}), null);
  assert.ok(
    editorMenu({ isEditable: true }, {}).some((x) => x.role === "undo"),
  );
  assert.ok(
    editorMenu(
      { isEditable: true, misspelledWord: "x", dictionarySuggestions: [] },
      {},
    ).some((x) => x.label === "Sin sugerencias" && x.enabled === false),
  );
});
test("Native context menu is attached to the requesting window and uses available Spanish dictionaries", () => {
  const handlers = {},
    languages = [],
    session = {
      availableSpellCheckerLanguages: ["es-ES", "en-US"],
      setSpellCheckerLanguages: (items) => languages.push(items),
    },
    window = {
      webContents: { session, on: (name, fn) => (handlers[name] = fn) },
    },
    popups = [];
  attachEditorMenu(window, {
    buildFromTemplate: (items) => ({
      popup: (options) => popups.push({ items, options }),
    }),
  });
  handlers["context-menu"]({}, { isEditable: true });
  assert.equal(popups[0].options.window, window);
  assert.deepEqual(languages, [["es-ES", "en-US"]]);
});
