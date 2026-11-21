"use strict";
const { fold } = require("../irc");
class CloneTracker {
  constructor(client) {
    this.client = client;
    this.hosts = new Map();
    this.previous = new Set();
  }
  observe(m) {
    const p = m.params;
    if (m.command === "NICK") {
      const h = this.hosts.get(fold(m.nick));
      this.hosts.delete(fold(m.nick));
      if (h) this.hosts.set(fold(p[0]), h);
    } else if (m.command === "QUIT") this.hosts.delete(fold(m.nick));
    else if (m.command === "CHGHOST") this.set(m.nick, p[1]);
    else if (m.command === "352") this.set(p[5], p[3]);
    else if (m.command === "354" && p[1] === "152") this.set(p[5], p[4]);
    else if (m.command === "353")
      for (const mask of (p[3] || "").split(" ")) {
        const match = /^.*?([^~&@%+! ]+)!([^@]+)@(.+)$/.exec(mask);
        if (match) this.set(match[1], match[3]);
      }
    else if (m.command === "JOIN") {
      const prefix = String(m.prefix || ""),
        at = prefix.lastIndexOf("@");
      if (at > 0) this.set(m.nick, prefix.slice(at + 1));
    }
  }
  set(nick, host) {
    if (nick && host && host !== "*" && host !== "0" && host.length <= 253)
      this.hosts.set(fold(nick), host.toLowerCase());
  }
  schedule() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.check();
    }, 50);
    this.timer.unref();
  }
  check() {
    const next = new Set(),
      present = new Set();
    for (const [channel, members] of this.client.members) {
      const groups = new Map();
      for (const [key, value] of members) {
        present.add(key);
        const host = this.hosts.get(key);
        if (!host) continue;
        const list = groups.get(host) || [];
        list.push(this.client.bareNick(value));
        groups.set(host, list);
      }
      for (const [host, nicks] of groups)
        if (nicks.length > 1) {
          nicks.sort((a, b) => a.localeCompare(b));
          const key = channel + "|" + host + "|" + nicks.map(fold).join(",");
          next.add(key);
          if (!this.previous.has(key))
            this.client.emit("clones", { target: channel, nicks, host });
        }
    }
    for (const key of this.hosts.keys())
      if (!present.has(key)) this.hosts.delete(key);
    this.previous = next;
  }
  stop() {
    clearTimeout(this.timer);
    this.timer = null;
    this.hosts.clear();
    this.previous.clear();
  }
}
module.exports = { CloneTracker };
