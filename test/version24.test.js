"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { HexVM } = require("../src/scripts/interpreter"),
  { validateSettings } = require("../src/storage"),
  { Runtime } = require("../src/services/runtime");
test("Generic script forms carry independent windows, controls, values, callbacks and collection deletion", () => {
  const vm = new HexVM();
  vm.install([
    {
      id: "forms",
      permissions: ["read", "ui", "persist"],
      source: `on LOAD { set %items $map() | setat %items Alice yes | setat %items Bob no | delat %items Alice }
alias settings { view config "Configuration" width 640 height 480 { column { input greeting "Hello Unicode 💜" label "Greeting" | textarea long "Many spaces here" | checkbox enabled true | radio choice true group radios | select mode one onchange changed { option one "First" | option two "Second" } | list pending Alice onclick selected ondblclick accept { option Alice "Alice" } | button Save save } } }
alias save { state.set greeting $form(greeting) | echo $window $form(enabled) $selected }
alias pending { view requests "Requests" width 350 height 300 { text Pending } }
alias close { view.close config }
alias popup { tip "Title" "Unicode 💜" }`,
    },
  ]);
  vm.dispatch("LOAD");
  assert.equal(vm.globals.get("%items").has("Alice"), false);
  assert.equal(vm.globals.get("%items").get("Bob"), "no");
  const a = vm.alias("settings").actions[0];
  assert.equal(a.windowId, "config");
  assert.equal(a.width, 640);
  assert.equal(a.tree[0].children[0].value, "Hello Unicode 💜");
  assert.equal(a.tree[0].children[5].props.ondblclick, "accept");
  assert.equal(vm.alias("pending").actions[0].windowId, "requests");
  const result = vm.alias("save", {
    window: "config",
    selected: "Alice",
    form: { greeting: 'á < > " \\ 💜\n' + "z".repeat(2000), enabled: true },
  }).actions;
  assert.equal(result[0].args[1].length, 2013);
  assert.match(result[0].args[1], /💜/);
  assert.equal(vm.alias("close").actions[0].type, "view.close");
  assert.equal(vm.alias("popup").actions[0].type, "tip");
  assert.throws(() => {
    const v = new HexVM();
    v.install([
      { id: "bad", source: 'alias a { view { script "alert(1)" } }' },
    ]);
    v.alias("a");
  });
});
test("Settings validate independent input text, nick emphasis, message prefixes and Status visibility", () => {
  const s = validateSettings({
    nickBold: false,
    roomAppearance: { inputText: "#123456", text: "#654321" },
    noticePrefix: "AVISO\n",
    noticePrefixGap: 99,
    actionPrefix: "→",
    actionColor: "#aabbcc",
    statusFilters: { notices: false, unknown: false },
  });
  assert.equal(s.nickBold, false);
  assert.equal(s.roomAppearance.inputText, "#123456");
  assert.equal(s.noticePrefix, "AVISO");
  assert.equal(s.noticePrefixGap, 8);
  assert.deepEqual(s.statusFilters, { notices: false });
});
test("Status visibility classifies messages without deleting or altering them", () => {
  const { visible, category } = require("../src/status-filters");
  const m = { notice: true, nick: "Alice", text: "Hello" };
  assert.equal(visible(m, { notices: false }), false);
  assert.equal(visible(m), true);
  assert.equal(m.text, "Hello");
  assert.equal(category({ code: 317 }), "queries");
  assert.equal(category({ error: true }), "errors");
  assert.equal(
    visible(
      { statusCategory: "connection", text: "Desconectado" },
      { disconnected: false },
    ),
    false,
  );
});
test("Theme exchange validates visual settings and excludes scripts, networks and protocol preferences", () => {
  const { parseTheme, serializeTheme } = require("../src/theme-files");
  const result = parseTheme(
    serializeTheme("Purple", {
      roomAppearance: { background: "#ffffff", inputText: "#123456" },
      nickBold: false,
      fontSize: 20,
      ignoredUsers: { net: ["Alice"] },
      raw: "evil",
    }),
  );
  assert.equal(result.settings.roomAppearance.inputText, "#123456");
  assert.equal(result.settings.nickBold, false);
  assert.equal(result.settings.ignoredUsers, undefined);
  assert.throws(() => parseTheme("{bad"));
  assert.throws(() =>
    parseTheme(
      JSON.stringify({
        format: "hexdreams-theme",
        version: 1,
        name: "A",
        settings: {},
        padding: "x".repeat(262144),
      }),
    ),
  );
});
test("Classic multicolor editing preserves fragments and rejects RGB or extended IRC codes", () => {
  const editor = require("../src/classic-editor"),
    text = "\x0304x\x0312D\x0309D";
  assert.equal(editor.valid(text), true);
  const r = editor.color(text, text.length, text.length, 13);
  assert.ok(r.value.startsWith(text));
  assert.equal(r.value.slice(-3), "\x0313");
  assert.equal(editor.valid("\x0316bad"), false);
  assert.equal(editor.valid("\x04ff0000bad"), false);
  assert.throws(() => editor.color("", 0, 0, 16));
});
test("Received private halt happens before notifications and either history; room, own and historical messages remain", async () => {
  const emissions = [],
    logs = [],
    history = [],
    notifications = [],
    fields = [];
  const context = {
    getConfig: () => ({ settings: { historyEnabled: true } }),
    cryptoAdapters: new Map([["net", { receive: (d) => d }]]),
    scripts: {
      event: async (name, f) => {
        fields.push({ name, ...f });
        return { halted: true, text: f.text };
      },
    },
    history: { append: (id, d) => history.push(d), prune: () => {} },
    writeTextLog: (id, d) => logs.push(d),
    notify: (id, d) => notifications.push(d),
    emit: (id, type, data) => emissions.push({ type, data }),
  };
  await Runtime.prototype.receive.call(context, "net", "message", {
    target: "Alice",
    nick: "Alice",
    text: "hidden",
  });
  assert.equal(
    emissions.length + logs.length + history.length + notifications.length,
    0,
  );
  assert.equal(fields[0].private, true);
  for (const data of [
    { target: "#room", nick: "Alice" },
    { target: "Alice", nick: "Me", own: true },
    { target: "Alice", nick: "Alice", historical: true },
  ])
    await Runtime.prototype.receive.call(context, "net", "message", {
      text: "visible",
      ...data,
    });
  assert.equal(history.length, 3);
  assert.equal(logs.length, 3);
  assert.equal(emissions.length, 3);
  assert.equal(fields[3].historical, true);
});
test("Generic form signals preserve Unicode and spaces and are scoped to the owning script", async () => {
  let captured;
  const context = {
    sessions: { sessions: new Map(), get: () => undefined },
    scripts: {
      allowed: () => {},
      alias: async (signal, fields, args) => {
        captured = { signal, fields, args };
        return { handled: true };
      },
    },
  };
  const form = { text: " a 💜\n" + "x".repeat(1000), enabled: true };
  await Runtime.prototype.action.call(context, "script.signal", {
    network: "net",
    script: "fixture",
    target: "#room",
    signal: "save",
    windowId: "config",
    form,
    args: ["two words"],
    interaction: "double-click",
    selected: "Alice",
  });
  assert.deepEqual({ ...captured.fields.form }, form);
  assert.equal(captured.fields.__onlyScript, "fixture");
  assert.equal(captured.fields.window, "config");
  assert.equal(captured.fields.interaction, "double-click");
  assert.deepEqual(captured.args, ["two words"]);
});
test("Script state set/delete survives secure-vault reopening and stays isolated by script", async () => {
  const fs = require("node:fs"),
    os = require("node:os"),
    path = require("node:path"),
    { SecretVault } = require("../src/services/vault");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hex-state-"));
  const storage = {
    isEncryptionAvailable: () => true,
    encryptString: (s) => Buffer.from(s).map((n) => n ^ 0xa7),
    decryptString: (b) =>
      Buffer.from(b)
        .map((n) => n ^ 0xa7)
        .toString(),
  };
  try {
    const vault = new SecretVault(dir, storage),
      context = { vault, scripts: { request: async () => {} } };
    const text = "  Mensaje 💜\n" + "x".repeat(2000);
    await Runtime.prototype.scriptAction.call(
      context,
      { type: "state.set", args: ["greeting", text] },
      { script: "one" },
    );
    await Runtime.prototype.scriptAction.call(
      context,
      { type: "state.set", args: ["greeting", "separate"] },
      { script: "two" },
    );
    assert.equal(
      new SecretVault(dir, storage).get("script-state:one").greeting,
      text,
    );
    assert.equal(
      new SecretVault(dir, storage).get("script-state:two").greeting,
      "separate",
    );
    assert.ok(
      !fs
        .readFileSync(path.join(dir, "secrets.bin"))
        .includes(Buffer.from(text)),
    );
    await Runtime.prototype.scriptAction.call(
      context,
      { type: "state.delete", args: ["greeting"] },
      { script: "one" },
    );
    assert.deepEqual(new SecretVault(dir, storage).get("script-state:one"), {});
    assert.equal(
      new SecretVault(dir, storage).get("script-state:two").greeting,
      "separate",
    );
    await assert.rejects(
      Runtime.prototype.scriptAction.call(
        context,
        { type: "state.set", args: ["__proto__", "bad"] },
        { script: "one" },
      ),
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("Selecting a colored fragment restores the following characters original color", () => {
  const { color } = require("../src/classic-editor"),
    { segments } = require("../src/formatting");
  const text = "\x0304ABCD";
  const result = color(text, 4, 5, 12),
    parts = segments(result.value);
  assert.equal(parts.map((p) => p.text).join(""), "ABCD");
  assert.equal(parts.find((p) => p.text === "B").style.color, "#0000fc");
  assert.equal(parts.at(-1).style.color, "#ff0000");
});
test("Form aliases with identical names are scoped to their script and cannot invoke another owner", () => {
  const vm = new HexVM();
  vm.install([
    {
      id: "one",
      state: { name: "one" },
      source: "alias save { child }\nalias child { echo $state(name) }",
    },
    {
      id: "two",
      state: { name: "two" },
      source:
        "alias save { child }\nalias child { echo $state(name) }\nalias private_two { echo secret }",
    },
  ]);
  assert.equal(
    vm.alias("save", { __onlyScript: "one" }).actions[0].text,
    "one",
  );
  assert.equal(
    vm.alias("save", { __onlyScript: "two" }).actions[0].text,
    "two",
  );
  assert.equal(vm.alias("private_two", { __onlyScript: "one" }).handled, false);
  vm.disable("one");
  assert.equal(vm.alias("save", { __onlyScript: "one" }).handled, false);
});
