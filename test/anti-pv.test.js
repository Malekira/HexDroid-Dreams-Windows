"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { HexVM } = require("../src/scripts/interpreter");
const source = fs.readFileSync(path.join(__dirname, "../addons/HexDreams-AntiPV.hex"), "utf8");
const permissions = ["read", "intercept", "ui", "persist", "send"];
function setup(state = {}) {
  const vm = new HexVM();
  vm.install([{ id: "antipv", source, permissions, state }]);
  const loaded = vm.dispatch("LOAD", {});
  assert.ok(loaded.actions.some(a => a.type === "sidebar"));
  return vm;
}
const alice = { network: "red-1", buffer: "Alice", chan: "Alice",
  nick: "Alice", me: "Yo", text: "Hola" };
const bob = { ...alice, buffer: "Bob", chan: "Bob", nick: "Bob", text: "¿Puedo hablar?" };
test("Anti-PV retiene privados nuevos, avisa una sola vez y no toca salas o mensajes propios", () => {
  const vm = setup();
  const first = vm.dispatch("TEXT", alice);
  assert.equal(first.halted, true);
  assert.equal(first.actions.filter(a => a.type === "msg").length, 1);
  assert.ok(first.actions.some(a => a.type === "view" && a.viewId === "pending"));
  assert.ok(first.actions.some(a => a.type === "tip"));
  const second = vm.dispatch("TEXT", { ...alice, text: "Segundo intento" });
  assert.equal(second.halted, true);
  assert.equal(second.actions.filter(a => a.type === "msg").length, 0);
  assert.equal(vm.dispatch("TEXT", { ...alice, own: true }).halted, false);
  assert.equal(vm.dispatch("TEXT", { ...alice, nick: "Yo", own: false }).halted, false);
  assert.equal(vm.dispatch("TEXT", { ...alice, buffer: "#dreams", chan: "#dreams" }).halted, false);
  assert.equal(vm.dispatch("TEXT", { ...alice, notice: true }).halted, false);
  assert.equal(vm.dispatch("TEXT", { ...alice, historical: true }).halted, false);
  assert.equal(vm.dispatch("TEXT", { ...alice, network: "red-2" }).halted, true);
});
test("Aceptar un PV mantiene el primer mensaje y no acepta automáticamente otros usuarios", () => {
  const vm = setup();
  vm.dispatch("TEXT", alice);
  vm.dispatch("TEXT", bob);
  const r = vm.alias("pv.accept", alice, ["red-1::alice"]);
  assert.ok(r.actions.some(a => a.type === "echo" && a.text.includes("Hola")));
  assert.ok(r.actions.some(a => a.type === "msg" && a.text.includes("Hola Alice")));
  assert.equal(vm.dispatch("TEXT", alice).halted, false);
  assert.equal(vm.dispatch("TEXT", bob).halted, true);
  assert.equal(vm.dispatch("TEXT", { ...alice, network: "red-2" }).halted, true);
});
test("Autoaceptar mediante clic guarda el nick y las opciones muestran paneles separados", () => {
  const vm = setup();
  vm.dispatch("TEXT", alice);
  const r = vm.alias("pv.promote", alice, ["red-1::alice"]);
  assert.ok(r.actions.some(a => a.type === "state.set" && a.args[0] === "pv_auto"));
  assert.equal(vm.dispatch("TEXT", alice).halted, false);
  assert.equal(vm.dispatch("TEXT", { ...alice, network: "red-2" }).halted, false);
  const settings = vm.alias("pv.config", alice).actions.find(a => a.type === "view");
  const pending = vm.alias("pv.panel", alice).actions.find(a => a.type === "view");
  assert.equal(settings.viewId, "config");
  assert.equal(pending.viewId, "pending");
  assert.ok(JSON.stringify(settings.tree).includes('"type":"textarea"'));
  assert.ok(JSON.stringify(settings.tree).includes('"type":"radio"'));
  assert.ok(JSON.stringify(pending.tree).includes("pv.manualadd"));
  assert.ok(JSON.stringify(pending.tree).includes("pv.remove"));
});
test("Guardar configuración permite autoaceptar, bloquear evita futuros PV e ignorar no bloquea", () => {
  const vm = setup();
  const saved = vm.alias("pv.save", alice, [
    "auto", "Esperá {nick}", "Hola {nick}", "Adiós {nick}", "false", "false",
  ]);
  assert.ok(saved.actions.some(a => a.type === "state.set" && a.args[0] === "pv_mode"));
  assert.equal(vm.dispatch("TEXT", alice).halted, false);
  vm.alias("pv.save", alice, [
    "ask", "Esperá {nick}", "Hola {nick}", "Adiós {nick}", "false", "false",
  ]);
  vm.dispatch("TEXT", bob);
  const ignored = vm.alias("pv.ignore", bob, ["red-1::bob"]);
  assert.ok(ignored.actions.some(a => a.type === "view"));
  const retry = vm.dispatch("TEXT", bob);
  assert.equal(retry.actions.filter(a => a.type === "msg").length, 1);
  const rejected = vm.alias("pv.rejectnick", bob, ["red-1::bob"]);
  assert.ok(rejected.actions.some(a => a.type === "state.set" && a.args[0] === "pv_blocked"));
  assert.equal(vm.dispatch("TEXT", bob).halted, true);
  assert.equal(vm.dispatch("TEXT", bob).actions.length, 0);
});
test("Los autoaceptados guardados sobreviven a reinicios del motor de scripts", () => {
  const vm = setup({ pv_auto: "Alice~Bob", pv_blocked: "red-2::eve", pv_mode: "ask" });
  assert.equal(vm.dispatch("TEXT", alice).halted, false);
  assert.equal(vm.dispatch("TEXT", bob).halted, false);
  assert.equal(vm.dispatch("TEXT", { ...alice, nick: "Eve", buffer: "Eve", network: "red-2" }).halted, true);
  const removed = vm.alias("pv.remove", alice, ["alice"]);
  assert.ok(removed.actions.some(a => a.type === "state.set"));
  assert.equal(vm.dispatch("TEXT", alice).halted, true);
});
