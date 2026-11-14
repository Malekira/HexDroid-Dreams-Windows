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
    this.privateNames=[];
    this.states = new Map();
    this.aliases = new Map();
    this.pending = [];
    this.monitor = false;
  }
  trackedNames(){return [...new Map([...this.names,...this.privateNames].map(name=>[fold(name),name])).values()];}
  watchPrivates(names){
    if(!Array.isArray(names)||names.length>500)throw new Error('Lista de privados no válida.');
    const next=[...new Map(names.map(name=>{normalizeNotify([name]);return[fold(name),name];})).values()];
    if(JSON.stringify(next)===JSON.stringify(this.privateNames))return;
    this.privateNames=next;this.needsPrivatePoll=true;this.start();
  }
  start() {
    clearInterval(this.timer);
    this.configure(this.names);
    if (this.trackedNames().length || this.client.profile.recoverNick) {
      this.timer = setInterval(() => this.poll(), 30000);
      this.timer.unref();
    }
  }
  configure(names) {
    this.names = normalizeNotify(names);
    const tracked=new Set(this.trackedNames().map(fold));
    for (const key of this.aliases.keys())
      if (!tracked.has(key)) this.aliases.delete(key);
    for (const key of this.states.keys())
      if (!tracked.has(key)) this.states.delete(key);
    if (!this.client.ready) return;
    if (this.monitor) {
      this.client.sendRaw("MONITOR C");
      const names = [
        ...new Map(
          this.trackedNames().map((n) => {
            const current = this.aliases.get(fold(n)) || n;
            return [fold(current), current];
          }),
        ).values(),
      ];
      for (let i = 0; i < names.length; i += 5)
        this.client.sendRaw("MONITOR + " + names.slice(i, i + 5).join(","));
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
    const names = this.monitor
      ? []
      : [
          ...new Map(
            this.trackedNames().map((n) => {
              const current = this.aliases.get(fold(n)) || n;
              return [fold(current), current];
            }),
          ).values(),
        ];
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
      if (this.pending.length >= 200) this.pending.shift();
      this.pending.push({ names: m[1].split(/ +/), time: Date.now() });
    }
  }
  update(nick, online, options = {}) {
    const names = this.trackedNames().filter(
      (n) => fold(this.aliases.get(fold(n)) || n) === fold(nick),
    );
    let reset = false,
      emitted = 0;
    for (const name of names) {
      const key = fold(name),
        initial = !this.states.has(key);
      if (!initial && this.states.get(key) === online) continue;
      this.states.set(key, online);
      const currentNick = this.aliases.get(key) || name;
      this.client.emit("presence", {
        nick: name,
        online,
        initial:initial&&!(options.observed&&this.privateNames.some(n=>fold(n)===key)),
        privateOnly:!this.names.some(n=>fold(n)===key),privateWatch:this.privateNames.some(n=>fold(n)===key),
        ...(currentNick !== name ? { currentNick } : {}),
        ...(options.renamed ? { renamed: true } : {}),
        ...(emitted++ ? { duplicate: true } : {}),
      });
      if (!online && this.aliases.has(key)) {
        this.aliases.delete(key);
        reset = true;
      }
    }
    if (reset && this.monitor && this.client.ready) this.configure(this.names);
  }
  handle(m) {
    const p = m.params,
      c = this.client;
    if (m.command === "JOIN") this.update(m.nick, true,{observed:true});
    if (m.command === "QUIT") this.update(m.nick, false,{observed:true});
    if (m.command === "NICK" && m.nick !== p[0]) {
      const matches = this.trackedNames().filter(
        (n) => fold(this.aliases.get(fold(n)) || n) === fold(m.nick),
      );
      for (const name of matches) {
        const key = fold(name);
        this.aliases.set(key, p[0]);
        this.states.set(key, true);
      }
      if (matches.length)
        this.client.emit("presence-nick", {
          nick: matches[0],
          watched: matches,privateOnly:matches.every(name=>!this.names.some(n=>fold(n)===fold(name))),
          old: m.nick,
          newNick: p[0],
          online: true,
        });
      if (matches.length && this.monitor && this.client.ready)
        this.configure(this.names);
      this.update(p[0], true, { renamed: matches.length > 0 });
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
        !online.some((n) => fold(n) === fold(c.profile.nick)) && Date.now()-(this.lastRecoveryAt||0)>=30000
      ){this.lastRecoveryAt=Date.now();c.sendRaw("NICK " + c.profile.nick);}
    }
    if(m.command==='303'&&!this.pending.length&&this.needsPrivatePoll){this.needsPrivatePoll=false;this.poll();}
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
      ...(this.aliases.has(fold(nick))
        ? { currentNick: this.aliases.get(fold(nick)) }
        : {}),
      online: this.states.has(fold(nick)) ? this.states.get(fold(nick)) : null,
    }));
  }
  stop() {
    clearInterval(this.timer);
    this.pending = [];
    this.states.clear();this.lastRecoveryAt=0;this.privateNames=[];this.needsPrivatePoll=false;
    this.aliases.clear();
  }
}
module.exports = { Presence, normalizeNotify };
