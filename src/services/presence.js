"use strict";
const fold = (s) =>
  String(s)
    .toLowerCase()
    .replace(
      /[\[\]\\^]/g,
      (c) => ({ "[": "{", "]": "}", "\\": "|", "^": "~" })[c],
    );
function normalizeNotify(input = []) {
  if (!Array.isArray(input) || input.length > 100)
    throw new Error("La lista Notify admite hasta 100 apodos.");
  const seen = new Set();
  return input
    .map((n) => {
      if (
        typeof n !== "string" ||
        !n ||
        n.length > 40 ||
        Buffer.byteLength(n) > 80 ||
        /^[#&+!~@%]|[\s\x00-\x1f:,]/.test(n)
      )
        throw new Error("Apodo de Notify no válido.");
      return n;
    })
    .filter((n) => {
      const key = fold(n);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
class Presence {
  constructor(client, names = []) {
    this.client = client;
    this.names = normalizeNotify(names);
    this.states = new Map();
    this.pending = [];
    this.monitor = false;
  }
  start() {
    clearInterval(this.timer);
    this.configure(this.names);
    if (this.names.length || this.client.profile.recoverNick) {
      this.timer = setInterval(() => this.poll(), 30000);
      this.timer.unref();
    }
  }
  configure(names) {
    this.names = normalizeNotify(names);
    for (const key of this.states.keys())
      if (!this.names.some((n) => fold(n) === key)) this.states.delete(key);
    if (!this.client.ready) return;
    if (this.monitor) {
      this.client.sendRaw("MONITOR C");
      for (let i = 0; i < this.names.length; i += 5)
        this.client.sendRaw(
          "MONITOR + " + this.names.slice(i, i + 5).join(","),
        );
    }
    this.poll();
  }
  setMonitor(enabled) {
    if (this.monitor === enabled) return;
    this.monitor = enabled;
    if (this.client.ready) this.configure(this.names);
  }
  poll() {
    const c = this.client;
    if (!c.ready || c.closed) return;
    const names = this.monitor ? [] : [...this.names];
    if (
      c.profile.recoverNick &&
      fold(c.nick) !== fold(c.profile.nick) &&
      !names.some((n) => fold(n) === fold(c.profile.nick))
    )
      names.push(c.profile.nick);
    if (this.pending.some((q) => Date.now() - q.time < 20000)) return;
    this.pending = [];
    for (let i = 0; i < names.length; i += 5)
      c.sendRaw("ISON " + names.slice(i, i + 5).join(" "));
  }
  observe(line) {
    const m = /^ISON\s+(.+)$/i.exec(line.replace(/^@[^ ]+ /, ""));
    if (m) {
      if (this.pending.length >= 100) this.pending.shift();
      this.pending.push({ names: m[1].split(/ +/), time: Date.now() });
    }
  }
  update(nick, online) {
    const name = this.names.find((n) => fold(n) === fold(nick));
    if (!name) return;
    const key = fold(name),
      initial = !this.states.has(key);
    if (!initial && this.states.get(key) === online) return;
    this.states.set(key, online);
    this.client.emit("presence", { nick: name, online, initial });
  }
  handle(m) {
    const p = m.params,
      c = this.client;
    if (m.command === "JOIN") this.update(m.nick, true);
    if (m.command === "QUIT") this.update(m.nick, false);
    if (m.command === "NICK" && fold(m.nick) !== fold(p[0])) {
      this.update(m.nick, false);
      this.update(p[0], true);
    }
    if (m.command === "303") {
      const request = this.pending.shift();
      if (!request) return;
      const online = (p.at(-1) || "").split(/ +/).filter(Boolean);
      if (!this.monitor)
        for (const nick of request.names)
          this.update(
            nick,
            online.some((n) => fold(n) === fold(nick)),
          );
      if (
        c.profile.recoverNick &&
        fold(c.nick) !== fold(c.profile.nick) &&
        request.names.some((n) => fold(n) === fold(c.profile.nick)) &&
        !online.some((n) => fold(n) === fold(c.profile.nick))
      )
        c.sendRaw("NICK " + c.profile.nick);
    }
    if (m.command === "730" || m.command === "731")
      for (const mask of (p.at(-1) || "").split(","))
        this.update(mask.split("!")[0], m.command === "730");
    if (m.command === "734") {
      this.client.sendRaw("MONITOR C");
      this.monitor = false;
      this.poll();
    }
  }
  snapshot() {
    return this.names.map((nick) => ({
      nick,
      online: this.states.has(fold(nick)) ? this.states.get(fold(nick)) : null,
    }));
  }
  stop() {
    clearInterval(this.timer);
    this.pending = [];
    this.states.clear();
  }
}
module.exports = { Presence, normalizeNotify };
