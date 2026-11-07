"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { plain } = require("../formatting");
const { fold } = require("../irc");

function filename(value, ircName = true) {
  const canonical = ircName ? fold(String(value)) : String(value);
  const hash = crypto.createHash("sha256").update(canonical).digest("hex").slice(0, 16);
  let readable = canonical
    .replace(/[^\p{L}\p{N}#&!_().{}\[\]~^-]/gu, "_")
    .replace(/[. ]+$/g, "")
    .slice(0, 48) || "conversacion";
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(readable)) readable = "_" + readable;
  return readable + "--" + hash;
}

function timestamp(value) {
  let date = new Date(value || Date.now());
  if (Number.isNaN(date.valueOf())) date = new Date();
  const pad = number => String(number).padStart(2, "0");
  const offset = -date.getTimezoneOffset();
  const absolute = Math.abs(offset);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${offset < 0 ? "-" : "+"}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
}

class TextLogs {
  constructor(directory) {
    this.directory = path.join(directory, "historial-txt");
    this.seen = new Set();
  }

  file(profile, target) {
    if (typeof target !== "string" || !target || ["*", "*consultas*"].includes(fold(target))) return null;
    const kind = /^[#&+!]/.test(target) ? "salas" : "privados";
    return path.join(this.directory, "red-" + filename(profile.id, false), kind, filename(target) + ".txt");
  }

  append(profile, message) {
    if (message.historical) return false;
    const file = this.file(profile, message.target);
    if (!file) return false;
    const ids = [
      message.clientId && "client:" + message.clientId,
      message.messageId && "server:" + message.messageId,
    ].filter(Boolean).map(id => profile.id + "\0" + fold(message.target) + "\0" + crypto.createHash("sha256").update(id).digest("hex"));
    const duplicate = ids.some(id => this.seen.has(id));
    if (!duplicate) {
      fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
      if (!fs.existsSync(file)) {
        const clean = value => plain(String(value || "")).replace(/[\r\n]/g, " ");
        const header = "\ufeffHexDreams IRC — Historial de conversación\r\nRed: " + clean(profile.name || profile.host || profile.id)
          + "\r\n" + (/^[#&+!]/.test(message.target) ? "Sala: " : "Privado: ") + clean(message.target) + "\r\n\r\n";
        try {
          fs.writeFileSync(file, header, { encoding: "utf8", mode: 0o600, flag: "wx" });
        } catch (error) {
          if (error.code !== "EEXIST") throw error;
        }
      }
      const stamp = timestamp(message.time);
      const nick = plain(String(message.nick || ""));
      const prefix = message.event ? "*** " : message.action ? "* " + nick + " " : message.notice ? "-" + nick + "- " : "<" + nick + "> ";
      const lines = plain(String(message.text || ""))
        .split(/\n|\u2028|\u2029/)
        .map(line => "[" + stamp + "] " + prefix + line)
        .join("\r\n") + "\r\n";
      fs.appendFileSync(file, lines, { encoding: "utf8", mode: 0o600 });
    }
    for (const id of ids) {
      this.seen.add(id);
      while (this.seen.size > 20000) this.seen.delete(this.seen.values().next().value);
    }
    return !duplicate;
  }

  open() {
    fs.mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    return this.directory;
  }
}
module.exports = { TextLogs, timestamp, filename };
