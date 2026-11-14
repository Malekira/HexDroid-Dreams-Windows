"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { Presence, normalizeNotify } = require("../src/services/presence");
function fixture(names = ["Alice"]) {
  const wire = [],
    events = [],
    c = {
      ready: true,
      nick: "Me",
      profile: { nick: "Me" },
      emit: (type, e) => events.push({ type, ...e }),
    };
  const p = new Presence(c, names);
  c.sendRaw = (line) => {
    wire.push(line);
    p.observe(line);
  };
  return { p, c, wire, events };
}
test("MONITOR updates connection status once and preserves an initial silent baseline", () => {
  const f = fixture();
  f.p.setMonitor(true);
  assert.ok(f.wire.includes("MONITOR + Alice"));
  f.p.handle({ command: "730", params: ["Me", "Alice!ident@host"] });
  f.p.handle({ command: "730", params: ["Me", "Alice!ident@host"] });
  f.p.handle({ command: "731", params: ["Me", "Alice"] });
  assert.deepEqual(
    f.events.map((e) => [e.nick, e.online, e.initial]),
    [
      ["Alice", true, true],
      ["Alice", false, false],
    ],
  );
  f.p.stop();
});
test("ISON fallback correlates manual requests and nickname recovery without producing false offline results", () => {
  const f = fixture(["Alice", "Bob"]);
  f.c.profile.recoverNick = true;
  f.c.profile.nick = "Original";
  f.c.sendRaw("ISON SomeoneElse");
  f.p.poll();
  f.p.handle({ command: "303", params: ["Me", "SomeoneElse"] });
  assert.equal(f.events.length, 0);
  f.p.poll();
  assert.ok(f.wire.includes("ISON Alice Bob Original"));
  f.p.handle({ command: "303", params: ["Me", "Alice"] });
  assert.equal(f.p.states.get("alice"), true);
  assert.equal(f.p.states.get("bob"), false);
  assert.ok(f.wire.includes("NICK Original"));
  f.p.stop();
});
test("Notify lists are bounded, deduplicated and cannot inject IRC commands", () => {
  assert.deepEqual(normalizeNotify(["Alice", "ALICE", "Bob"]), [
    "Alice",
    "Bob",
  ]);
  assert.throws(() => normalizeNotify(["Alice\r\nOPER x y"]));
  assert.throws(() => normalizeNotify(["#room"]));
  assert.throws(() => normalizeNotify(Array(101).fill("Alice")));
});
test("Room activity speeds up presence changes without treating PART as a disconnection", () => {
  const f = fixture();
  f.p.update("Alice", true);
  f.p.handle({ command: "PART", nick: "Alice", params: ["#room"] });
  assert.equal(f.events.length, 1);
  f.p.handle({ command: "QUIT", nick: "Alice", params: ["bye"] });
  assert.equal(f.events.at(-1).online, false);
  f.p.handle({ command: "JOIN", nick: "Alice", params: ["#room"] });
  assert.equal(f.events.at(-1).online, true);
  f.p.stop();
});
test('Notify follows observed nickname changes without false disconnects and resumes the saved nick after QUIT',()=>{
 const f=fixture();f.p.setMonitor(true);f.p.update('Alice',true);f.events.length=0;
 f.p.handle({command:'NICK',nick:'Alice',params:['Zeta']});f.p.handle({command:'731',params:['Me','Alice']});
 assert.deepEqual(f.p.snapshot(),[{nick:'Alice',currentNick:'Zeta',online:true}]);assert.equal(f.events.length,1);assert.equal(f.events[0].type,'presence-nick');assert.equal(f.events[0].old,'Alice');assert.equal(f.events[0].newNick,'Zeta');assert.ok(f.wire.includes('MONITOR + Zeta'));
 f.p.handle({command:'NICK',nick:'Zeta',params:['Beta']});assert.equal(f.p.snapshot()[0].currentNick,'Beta');
 f.p.handle({command:'QUIT',nick:'Beta',params:['bye']});assert.deepEqual(f.p.snapshot(),[{nick:'Alice',online:false}]);assert.equal(f.events.at(-1).online,false);assert.equal(f.wire.at(-1),'MONITOR + Alice');f.p.stop();
});
test('An old ISON response cannot mark a watched user offline after an observed nick change',()=>{
 const f=fixture();f.p.poll();f.p.handle({command:'NICK',nick:'Alice',params:['AliceNew']});f.p.handle({command:'303',params:['Me','']});assert.equal(f.p.snapshot()[0].online,true);f.p.poll();assert.equal(f.wire.at(-1),'ISON AliceNew');f.p.stop();
});
test('A nickname change onto another watched name updates both entries and subsequent renames emit one alert',()=>{
 const f=fixture(['Alice','Bob']);f.p.update('Alice',true);f.p.update('Bob',false);f.events.length=0;
 f.p.handle({command:'NICK',nick:'Alice',params:['Bob']});assert.ok(f.p.snapshot().every(p=>p.online));assert.equal(f.events.filter(e=>e.type==='presence-nick').length,1);assert.ok(f.events.filter(e=>e.type==='presence').every(e=>e.renamed));
 f.events.length=0;f.p.handle({command:'NICK',nick:'Bob',params:['Carol']});assert.deepEqual(f.p.snapshot().map(p=>p.currentNick),['Carol','Carol']);assert.equal(f.events.filter(e=>e.type==='presence-nick').length,1);assert.deepEqual(f.events[0].watched,['Alice','Bob']);
 f.p.handle({command:'QUIT',nick:'Carol',params:['bye']});assert.deepEqual(f.p.snapshot(),[{nick:'Alice',online:false},{nick:'Bob',online:false}]);assert.equal(f.events.filter(e=>e.type==='presence'&&!e.duplicate).length,1);f.p.stop();
});
test('Open private watchers use MONITOR without becoming permanent Notify entries and are removed on close',()=>{const f=fixture([]);f.p.setMonitor(true);f.p.watchPrivates(['Alice']);assert.ok(f.wire.includes('MONITOR + Alice'));assert.deepEqual(f.p.snapshot(),[]);f.p.handle({command:'730',params:['Me','Alice!u@h']});f.p.handle({command:'731',params:['Me','Alice']});f.p.handle({command:'730',params:['Me','Alice!u@h']});assert.deepEqual(f.events.filter(e=>e.type==='presence').map(e=>[e.online,e.initial,e.privateOnly]),[[true,true,true],[false,false,true],[true,false,true]]);f.p.watchPrivates([]);assert.equal(f.p.states.size,0);assert.equal(f.p.privateNames.length,0);f.p.stop();});
test('Private presence fallback correlates ISON and follows nick changes without false return alerts',()=>{const f=fixture([]);f.p.watchPrivates(['Alice']);assert.ok(f.wire.includes('ISON Alice'));f.p.handle({command:'303',params:['Me','Alice']});f.p.handle({command:'NICK',nick:'Alice',params:['Alicia']});assert.equal(f.events.filter(e=>e.type==='presence-nick').at(-1).privateOnly,true);f.p.handle({command:'QUIT',nick:'Alicia',params:['bye']});assert.equal(f.events.filter(e=>e.type==='presence').at(-1).online,false);f.p.stop();});
