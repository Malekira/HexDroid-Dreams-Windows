"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { Cycle, matches } = require("../src/completion");
const { AutoAway } = require("../src/services/auto-away");
const { catalog } = require("../src/scripts/catalog");
test("Tab cycles matches using the original prefix, supports reverse and preserves surrounding text", () => {
  const c = new Cycle(),
    names = ["Alice", "Alberto", "Bob"];
  let r = c.next("Hola Al!", 7, 7, "room", names);
  assert.equal(r.value, "Hola Alberto !");
  r = c.next(r.value, r.caret, r.caret, "room", names);
  assert.equal(r.value, "Hola Alice !");
  r = c.next(r.value, r.caret, r.caret, "room", names);
  assert.equal(r.value, "Hola Alberto !");
  r = c.next(r.value, r.caret, r.caret, "room", names, -1);
  assert.equal(r.value, "Hola Alice !");
  c.reset();
  r = c.next("/wh", 3, 3, "room", ["/who", "/whois"]);
  assert.equal(r.name, "/who");
  r = c.next(r.value, r.caret, r.caret, "room", ["/who", "/whois"]);
  assert.equal(r.name, "/whois");
  assert.equal(c.next("Nothing", 7, 7, "other", names), null);
  assert.deepEqual(matches(["Nick[1]", "nick{1}", "Bob"], "nick["), [
    "Nick[1]",
  ]);
});
test("Autoaway sets once, returns on activity and preserves manual absence", () => {
  const service = new AutoAway(),
    lines = [],
    entries = [
      { id: "A", client: { ready: true, sendRaw: (s) => lines.push(s) } },
    ],
    s = {
      autoAwayEnabled: true,
      autoAwayMinutes: 2,
      autoAwayMessage: "En pausa",
      autoAwayReturn: true,
    };
  service.tick(entries, s, 119);
  assert.equal(lines.length, 0);
  service.tick(entries, s, 120);
  service.observe("A", true);
  service.tick(entries, s, 200);
  assert.deepEqual(lines, ["AWAY :En pausa"]);
  service.tick(entries, s, 0);
  service.observe("A", false);
  assert.deepEqual(lines, ["AWAY :En pausa", "AWAY"]);
  service.setManual("A", true);
  service.tick(entries, s, 1000);
  service.tick(entries, s, 0);
  assert.equal(lines.length, 2);
  service.forget("A");
  service.tick(entries, s, 300);
  service.tick(entries, { ...s, autoAwayEnabled: false }, 300);
  assert.equal(lines.at(-1), "AWAY");
});
test("Autoaway can retain absence until manually cleared and removes disconnected sessions", () => {
  const service = new AutoAway(),
    lines = [],
    client = { ready: true, sendRaw: (s) => lines.push(s) },
    s = { autoAwayEnabled: true, autoAwayMinutes: 1, autoAwayReturn: false };
  service.tick([{ id: "A", client }], s, 60);
  service.tick([{ id: "A", client }], s, 0);
  assert.equal(lines.length, 1);
  client.ready = false;
  service.tick([{ id: "A", client }], s, 90);
  assert.equal(service.automatic.size, 0);
});
test("Script help catalogs alias descriptions, usages and internal helpers without executing source", () => {
  const rows = catalog(
    "; /saludo Nick  Envía un saludo amable\nalias saludo { me Hola $1 }\nalias sw_helper { return }",
  );
  assert.equal(rows[0].name, "saludo");
  assert.equal(rows[0].usage, "/saludo Nick");
  assert.equal(rows[0].description, "Envía un saludo amable");
  assert.equal(rows[1].internal, true);
});
test('Network identity styles are validated and stay separated by profile',()=>{
 const {validateProfile}=require('../src/services/profiles'),base={host:'irc.example.org',port:6697,nick:'Test',channels:[]};const styled=validateProfile({...base,ownNickColor:'#123abc',textColor:'#abcdef',textStyle:'bold-italic',mentionHighlightColor:'#ff0011'}),normal=validateProfile(base);assert.equal(styled.textColor,'#abcdef');assert.equal(styled.textStyle,'bold-italic');assert.equal(normal.textColor,undefined);assert.throws(()=>validateProfile({...base,textColor:'red;bad'}));assert.throws(()=>validateProfile({...base,textStyle:'untrusted'}));
});
