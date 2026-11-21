"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  { EventEmitter } = require("node:events");
const { IrcClient, parseLine } = require("../src/irc"),
  { SessionManager } = require("../src/services/sessions"),
  { Presence } = require("../src/services/presence");
const writing = require("../src/writing"),
  { sanitizeData } = require("../src/storage"),
  services = require("../src/service-targets");
test("The first post-connect command runs without commandDelay; the delay applies between commands", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const wire = [];
  class Fake extends EventEmitter {
    constructor(p) {
      super();
      this.profile = p;
      this.ready = true;
      this.nick = p.nick;
    }
    connect() {
      this.emit("status", { state: "connected" });
    }
    sendMessage(target, text) {
      this.sendRaw(`PRIVMSG ${target} :${text}`);
    }
    sendRaw(line) {
      wire.push(line);
    }
    disconnect() {
      this.ready = false;
    }
  }
  const manager = new SessionManager({ clientFactory: (p) => new Fake(p) });
  manager.connect({
    id: "one",
    host: "localhost",
    port: 6667,
    tls: false,
    nick: "Me",
    channels: [],
    commands: ["/identify secret", "/mode Me +x"],
    commandDelay: 30000,
  });
  t.mock.timers.tick(0);
  assert.deepEqual(wire, ["PRIVMSG NickServ :IDENTIFY secret"]);
  t.mock.timers.tick(29999);
  assert.equal(wire.length, 1);
  t.mock.timers.tick(1);
  assert.equal(wire[1], "MODE Me +x");
  manager.close();
});
test("A delayed own echo after a server nickname change confirms the original send", () => {
  const c = new IrcClient({
      host: "localhost",
      port: 6667,
      nick: "Me",
      tls: false,
      channels: [],
    }),
    messages = [];
  c.ready = true;
  c.capabilities.add("echo-message");
  c.sendTagged = () => {};
  c.on("message", (m) => messages.push(m));
  c.sendMessage("#room", "\x0306hello\x0f");
  const original = messages[0];
  c.handle(parseLine(":Me!u@h NICK :Guest123"));
  assert.equal(c.nick, "Guest123");
  c.handle(parseLine(":Me!u@h PRIVMSG #room :hello"));
  assert.equal(messages.at(-1).clientId, original.clientId);
  assert.equal(messages.at(-1).own, true);
  assert.equal(messages.at(-1).pending, false);
  assert.equal(c.pendingEcho.size, 0);
});
test("Missing echo ends pending state after the bounded wait and never resends a message", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const c = new IrcClient({
      host: "localhost",
      port: 6667,
      nick: "Me",
      tls: false,
      channels: [],
    }),
    wire = [],
    delivery = [];
  c.ready = true;
  c.capabilities.add("echo-message");
  c.sendTagged = (line) => wire.push(line);
  c.on("delivery", (e) => delivery.push(e));
  c.sendMessage("#room", "visible original");
  t.mock.timers.tick(15000);
  assert.equal(delivery.length, 1);
  assert.equal(delivery[0].pending, false);
  assert.equal(wire.length, 1);
  assert.equal(c.pendingEcho.size, 1);
  t.mock.timers.tick(60000);
  assert.equal(c.pendingEcho.size, 0);
});
test("IPVirtual commands are unformatted for direct sends, MSG and server-qualified service names", () => {
  assert.equal(services.isService("IPVirtual"), true);
  assert.equal(services.isService("IPVirtual@services.chatzona.org"), true);
  assert.equal(services.isService("IPVirtualFan"), false);
  const c = new IrcClient({
      host: "localhost",
      port: 6667,
      nick: "Me",
      tls: false,
      channels: [],
    }),
    wire = [];
  c.ready = true;
  c.socket = {
    writable: true,
    destroyed: false,
    write: (b) => wire.push(b.toString()),
  };
  c.sendMessage("IPVirtual", "\x02\x0306help\x0f");
  require("../src/commands").executeInput(
    c,
    "#room",
    "/msg IPVirtual \x0306request my.vhost\x0f",
  );
  assert.deepEqual(wire, [
    "PRIVMSG IPVirtual :help\r\n",
    "PRIVMSG IPVirtual :request my.vhost\r\n",
  ]);
});
test("Dictionary persistence retains classic IRC colors and fragment styles, including automatic expansion", () => {
  const value = "\x0304x\x0312\x02D\x02\x0f\x0309D";
  const config = sanitizeData({
    settings: { dictionary: [{ from: "XDD", to: value, enabled: true }] },
    profiles: [],
  });
  assert.equal(config.settings.dictionary[0].to, value);
  assert.equal(
    writing.replaceWords("Hola XDD ", config.settings, false),
    "Hola " + value + " ",
  );
  assert.ok(
    !writing
      .validate({
        dictionary: [{ from: "X", to: "\x04ff00ffbad\x0316extended" }],
      })
      .dictionary[0].to.includes("\x04"),
  );
});
test("Classic fragment styles preserve the rest of a replacement", () => {
  const editor = require("../src/classic-editor"),
    f = require("../src/formatting");
  const r = editor.style("abc", 1, 2, "bold");
  const parts = f.segments(r.value);
  assert.equal(parts.map((p) => p.text).join(""), "abc");
  assert.equal(parts.find((p) => p.text === "b").style.bold, true);
  assert.equal(parts.at(-1).style.bold, undefined);
});
test("Repeated ISON responses cannot flood preferred-nick recovery requests", () => {
  const lines = [],
    client = {
      profile: { nick: "Me", recoverNick: true },
      nick: "Guest123",
      ready: true,
      closed: false,
      emit: () => {},
      sendRaw: (line) => {
        lines.push(line);
        presence.observe(line);
      },
    },
    presence = new Presence(client, []);
  presence.poll();
  presence.handle({ command: "303", params: ["Guest123", ""] });
  presence.poll();
  presence.handle({ command: "303", params: ["Guest123", ""] });
  assert.equal(lines.filter((l) => l === "NICK Me").length, 1);
  presence.stop();
});
test("Delivery confirmation bypasses a slow script event without releasing private message processing", async () => {
  const { Runtime } = require("../src/services/runtime"),
    events = [],
    queues = new Map();
  let release;
  const wait = new Promise((r) => (release = r)),
    context = {
      queues,
      emit: (id, type, data) => events.push({ id, type, data }),
      receive: async () => {
        await wait;
        events.push({ type: "processed" });
      },
    };
  Runtime.prototype.enqueue.call(context, "net", "message", {
    text: "blocked",
  });
  await Promise.resolve();
  Runtime.prototype.enqueue.call(context, "net", "delivery", {
    clientId: "one",
    pending: false,
  });
  assert.equal(events[0].type, "delivery");
  assert.equal(events.length, 1);
  release();
  await queues.get("net");
  assert.equal(events[1].type, "processed");
});
test("A late echo clears a timed-out delivery without resending or duplicating its client id", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const c = new IrcClient({
      host: "localhost",
      port: 6667,
      nick: "Me",
      tls: false,
      channels: [],
    }),
    messages = [],
    delivery = [];
  c.ready = true;
  c.capabilities.add("echo-message");
  c.sendTagged = () => {};
  c.on("message", (m) => messages.push(m));
  c.on("delivery", (m) => delivery.push(m));
  c.sendMessage("#room", "late");
  t.mock.timers.tick(15000);
  assert.equal(delivery[0].failed, true);
  c.handle(parseLine(":Me!u@h PRIVMSG #room :late"));
  assert.equal(messages.at(-1).clientId, messages[0].clientId);
  assert.equal(delivery.at(-1).failed, false);
  assert.equal(c.pendingEcho.size, 0);
});
