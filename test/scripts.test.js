const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { HexVM, parse, arithmetic } = require("../src/scripts/interpreter");
const { ScriptManager } = require("../src/scripts/manager");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
test(".hex aliases, conditions, loops and typed collections use the Android syntax without JavaScript eval", () => {
  const vm = new HexVM();
  vm.install([
    {
      id: "one",
      permissions: ["read", "intercept"],
      source: `on LOAD { set %count 0 | set %items $list(Alice, Bob) }
alias add { inc %count | return $calc(%count + $1) }
on TEXT:*hello* {
  foreach %nick %items { echo $chan hello %nick }
  while (%count < 3) { inc %count }
  if ((%count == 3 || %count == 4) && $nick != me) { rewrite $upper($text) }
  else { halt }
}`,
    },
  ]);
  vm.dispatch("LOAD");
  const result = vm.dispatch("TEXT", {
    text: "hello world",
    nick: "Alice",
    chan: "#room",
  });
  assert.equal(result.text, "HELLO WORLD");
  assert.equal(result.actions.filter((a) => a.type === "echo").length, 2);
  assert.equal(vm.alias("add", {}, ["2"]).actions.length, 0);
  assert.equal(vm.globals.get("%count"), 4);
  assert.equal(arithmetic("(5 + 3) / 2"), 4);
  assert.throws(() => arithmetic("process.exit()"));
});
test(".hex view tree and HTTP intents preserve context without executing HTML", () => {
  const vm = new HexVM();
  vm.install([
    {
      id: "one",
      permissions: ["read"],
      source: `on TEXT { http.get https://example.org done $buffer | view { column gap 8 { text "$text" bold | button "Run" go } } }`,
    },
  ]);
  const r = vm.dispatch("TEXT", {
    network: "one",
    buffer: "#room",
    text: "<script>alert(1)</script>",
  });
  assert.equal(r.actions[0].type, "http");
  assert.deepEqual(r.actions[0].args, ["#room"]);
  assert.equal(
    r.actions[1].tree[0].children[0].text,
    "<script>alert(1)</script>",
  );
});
test("Script budgets stop infinite loops and parsing bounds excessive nesting", () => {
  const vm = new HexVM();
  vm.install([
    {
      id: "one",
      permissions: ["read"],
      source: "on TEXT { while (true) { inc %n } }",
    },
  ]);
  const r = vm.dispatch("TEXT", { text: "event" });
  assert.ok(r.actions.some((a) => a.type === "disable"));
  assert.throws(() =>
    parse("on TEXT {" + "column {".repeat(100) + "}".repeat(101)),
  );
});
test("Worker scripts are disabled at import and cannot send without explicit permission", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dreams-script-")),
    sent = [];
  const manager = new ScriptManager(root, { host: async (a) => sent.push(a) });
  t.after(() => {
    manager.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const id = manager.install("example.hex", "on TEXT { msg $chan automatic }");
  assert.equal(manager.list()[0].enabled, false);
  await manager.configure(id, {
    enabled: true,
    permissions: ["read"],
    domains: [],
  });
  await manager.event("TEXT", { network: "one", chan: "#room", text: "hello" });
  assert.equal(sent.length, 0);
  assert.ok(manager.debug.some((e) => e.text.includes("permiso")));
  await manager.configure(id, {
    enabled: true,
    permissions: ["read", "send"],
    domains: [],
  });
  await manager.event("TEXT", { network: "one", chan: "#room", text: "hello" });
  assert.equal(sent[0].type, "msg");
  assert.equal(sent[0].fields.network, "one");
});
test("A low-privilege script cannot borrow send permission through another script alias or signal", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dreams-script-deputy-")),
    sent = [];
  const manager = new ScriptManager(root, { host: async (a) => sent.push(a) });
  t.after(() => {
    manager.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const privileged = manager.install(
    "sender.hex",
    "alias privileged { msg #room hidden }\non SIGNAL:borrowed { msg #room signal }",
  );
  await manager.configure(privileged, {
    enabled: true,
    permissions: ["read", "send"],
    domains: [],
  });
  const low = manager.install(
    "reader.hex",
    "on TEXT { privileged | signal borrowed }",
  );
  await manager.configure(low, {
    enabled: true,
    permissions: ["read"],
    domains: [],
  });
  await manager.event("TEXT", {
    network: "net",
    buffer: "#room",
    text: "event",
  });
  assert.equal(sent.length, 0);
  assert.equal(
    manager.debug.filter((e) => e.text.includes("permiso")).length,
    2,
  );
});
test("Read permission alone cannot rewrite or suppress messages", () => {
  const vm = new HexVM();
  vm.install([
    {
      id: "reader",
      permissions: ["read"],
      source: "on TEXT { rewrite forged | halt }",
    },
  ]);
  const result = vm.dispatch("TEXT", { text: "authentic" });
  assert.equal(result.text, "authentic");
  assert.equal(result.halted, false);
  assert.ok(result.actions.some((a) => a.type === "error"));
});
test("Android collection membership and Unicode script regex are compatible", () => {
  const vm = new HexVM();
  vm.install([
    {
      id: "compat",
      permissions: ["read"],
      source:
        "on TEXT { set %has $has($list(ru,uk,bg), ru) | set %cyrillic $re_match($text, \\p{IsCyrillic}+) }",
    },
  ]);
  vm.dispatch("TEXT", { text: "Привет" });
  assert.equal(vm.globals.get("%has"), "true");
  assert.equal(vm.globals.get("%cyrillic"), "true");
});

test("Shipped Android translate, WHOIS filter and image uploader scripts keep their native syntax", () => {
  const fixture = (name) =>
    fs.readFileSync(path.join(__dirname, "fixtures", "android", name), "utf8");
  const vm = new HexVM();
  vm.install([
    {
      id: "translate",
      permissions: ["read", "intercept", "http", "ui"],
      source: fixture("translate.hex"),
    },
  ]);
  assert.deepEqual(
    vm
      .dispatch("LOAD", { settings: { applang: "es" } })
      .actions.filter((a) => a.type === "error"),
    [],
  );
  const foreign = vm.dispatch("TEXT", {
    network: "net",
    buffer: "#room",
    chan: "#room",
    text: "Привет мир",
    nick: "Alice",
    me: "Me",
  });
  assert.equal(
    foreign.actions.find((a) => a.type === "http").url,
    "https://translate.boxlabs.uk/translate",
  );
  assert.equal(
    vm
      .dispatch("TEXT", {
        network: "net",
        buffer: "#room",
        text: "hello",
        nick: "Alice",
        me: "Me",
      })
      .actions.filter((a) => a.type === "http").length,
    0,
  );
  const whois = new HexVM();
  whois.install([
    {
      id: "whois",
      permissions: ["read", "intercept"],
      source: fixture("whoisfilter.hex"),
    },
  ]);
  whois.dispatch("LOAD");
  assert.equal(
    whois.dispatch("NUMERIC", {
      text: "hidden detail",
      code: "378",
      whois: "true",
    }).halted,
    true,
  );
  assert.equal(
    whois.dispatch("NUMERIC", {
      text: "unrelated",
      code: "378",
      whois: "false",
    }).halted,
    false,
  );
  const image = new HexVM();
  image.install([
    {
      id: "image",
      permissions: ["ui", "http"],
      source: fixture("imgpaste.hex"),
    },
  ]);
  image.dispatch("LOAD");
  const picker = image
    .alias("img", { network: "net", buffer: "#room" })
    .actions.find((a) => a.type === "media.pick");
  assert.ok(picker);
  assert.deepEqual(picker.args, [
    "-m",
    "image/*",
    "img_picked",
    "#room",
    "public",
  ]);
});

test("A script reads only its own persisted state", () => {
  const vm = new HexVM();
  vm.install([
    {
      id: "one",
      state: { theme: "dark" },
      permissions: [],
      source: "alias check { debug $state(theme) }",
    },
    {
      id: "two",
      state: { theme: "private" },
      permissions: [],
      source: "alias other { debug $state(theme) }",
    },
  ]);
  assert.equal(vm.alias("check").actions[0].text, "dark");
  assert.equal(vm.alias("other").actions[0].text, "private");
});
