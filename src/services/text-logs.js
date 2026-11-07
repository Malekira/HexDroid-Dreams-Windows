"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { plain } = require("../formatting");
const { fold } = require("../irc");

function filename(value, ircName = true) {
  const canonical = ircName ? fold(String(value)) : String(value);
  const hash = crypto
    .createHash("sha256")
    .update(canonical)
    .digest("hex")
    .slice(0, 16);
  let readable =
    canonical
      .replace(/[^\p{L}\p{N}#&!_().{}\[\]~^-]/gu, "_")
      .replace(/[. ]+$/g, "")
      .slice(0, 48) || "conversacion";
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(readable))
    readable = "_" + readable;
  return readable + "--" + hash;
}

function timestamp(value) {
  let date = new Date(value || Date.now());
  if (Number.isNaN(date.valueOf())) date = new Date();
  const pad = (number) => String(number).padStart(2, "0");
  const offset = -date.getTimezoneOffset();
  const absolute = Math.abs(offset);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${offset < 0 ? "-" : "+"}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
}

class TextLogs {
  constructor(directory) {
    this.directory = path.join(directory, "historial-txt");
    this.seen = new Set();
    this.options = {};
  }

  configure(settings = {}) {
    this.options = settings;
  }
  kind(target) {
    return target === "*"
      ? "status"
      : fold(target) === "*consultas*"
        ? "whois-who"
        : /^[#&+!]/.test(target)
          ? "salas"
          : "privados";
  }
  enabled(target) {
    const key = {
      salas: "textLogRooms",
      privados: "textLogPrivates",
      status: "textLogStatus",
      "whois-who": "textLogQueries",
    }[this.kind(target)];
    return (
      this.options.textLogsEnabled !== false && this.options[key] !== false
    );
  }
  files() {
    const out = [];
    const walk = (dir, depth) => {
      if (depth > 3) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isSymbolicLink()) continue;
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (depth === 0 && !/^red-.+--[a-f0-9]{16}$/.test(entry.name))
            continue;
          if (
            depth === 1 &&
            !["salas", "privados", "status", "whois-who"].includes(entry.name)
          )
            continue;
          if (depth >= 2) continue;
          walk(file, depth + 1);
        } else if (
          depth === 2 &&
          entry.isFile() &&
          /^.+--[a-f0-9]{16}\.txt$/.test(entry.name)
        ) {
          const stat = fs.statSync(file);
          out.push({
            id: path.relative(this.directory, file).split(path.sep).join("/"),
            size: stat.size,
            modified: stat.mtime.toISOString(),
          });
        }
      }
    };
    if (fs.existsSync(this.directory)) walk(this.directory, 0);
    return out.sort((a, b) => a.id.localeCompare(b.id));
  }
  resolve(id) {
    const item = this.files().find((f) => f.id === id);
    if (!item) throw new Error("Archivo de historial no disponible.");
    return path.join(this.directory, ...item.id.split("/"));
  }
  read(id, offset = 0) {
    const file = this.resolve(id),
      size = fs.statSync(file).size;
    offset = Math.max(0, Math.min(size, Number(offset) || 0));
    const fd = fs.openSync(file, "r");
    try {
      const buffer = Buffer.alloc(Math.min(1048580, size - offset));
      const read = fs.readSync(fd, buffer, 0, buffer.length, offset);
      let length = Math.min(1048576, read);
      if (length < read)
        while (length > 0 && (buffer[length] & 0xc0) === 0x80) length--;

      return {
        text: buffer.subarray(0, length).toString("utf8"),
        next: offset + length,
        size,
      };
    } finally {
      fs.closeSync(fd);
    }
  }
  search(word, id) {
    word = String(word || "")
      .trim()
      .toLocaleLowerCase();
    if (!word) return [];
    if (word.length > 200) throw new Error("Búsqueda demasiado larga.");
    const rows = [];
    for (const item of this.files().filter((f) => !id || f.id === id)) {
      const file = this.resolve(item.id),
        fd = fs.openSync(file, "r"),
        decoder = new (require("node:string_decoder").StringDecoder)("utf8");
      let pending = "",
        line = 0,
        offset = 0;
      try {
        const b = Buffer.alloc(65536);
        let n;
        while ((n = fs.readSync(fd, b, 0, b.length, null)) > 0) {
          pending += decoder.write(b.subarray(0, n));
          const parts = pending.split("\n");
          pending = parts.pop();
          for (const text of parts) {
            line++;
            if (text.toLocaleLowerCase().includes(word))
              rows.push({
                id: item.id,
                line,
                offset,
                text: text.replace(/\r$/, ""),
              });
            offset += Buffer.byteLength(text + "\n");
            if (rows.length >= 1000) return rows;
          }
          if (pending.length > 1048576) {
            const dropped = pending.slice(0, -1024);
            offset += Buffer.byteLength(dropped);
            pending = pending.slice(-1024);
          }
        }
        pending += decoder.end();
        if (pending.toLocaleLowerCase().includes(word))
          rows.push({ id: item.id, line: line + 1, offset, text: pending });
      } finally {
        fs.closeSync(fd);
      }
    }
    return rows;
  }
  prune() {
    const days = this.options.textLogDays || 0;
    if (days <= 0) return;
    if (this.lastPrune && Date.now() - this.lastPrune < 60000) return;
    this.lastPrune = Date.now();
    const cutoff = Date.now() - days * 86400000;
    for (const item of this.files())
      if (Date.parse(item.modified) < cutoff)
        fs.unlinkSync(this.resolve(item.id));
  }
  file(profile, target) {
    if (typeof target !== "string" || !target) return null;
    if (
      ["*", "*consultas*"].includes(fold(target)) &&
      !Object.keys(this.options).length
    )
      return null;
    const kind = this.kind(target);
    return path.join(
      this.directory,
      "red-" + filename(profile.id, false),
      kind,
      filename(["status", "whois-who"].includes(kind) ? kind : target) + ".txt",
    );
  }

  append(profile, message) {
    if (message.historical || !this.enabled(message.target)) return false;
    this.prune();
    const file = this.file(profile, message.target);
    if (!file) return false;
    const ids = [
      message.clientId && "client:" + message.clientId,
      message.messageId && "server:" + message.messageId,
    ]
      .filter(Boolean)
      .map(
        (id) =>
          profile.id +
          "\0" +
          fold(message.target) +
          "\0" +
          crypto.createHash("sha256").update(id).digest("hex"),
      );
    const duplicate = ids.some((id) => this.seen.has(id));
    if (!duplicate) {
      fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
      if (!fs.existsSync(file)) {
        const clean = (value) =>
          plain(String(value || "")).replace(/[\r\n]/g, " ");
        const header =
          "\ufeffHexDreams IRC — Historial de conversación\r\nRed: " +
          clean(profile.name || profile.host || profile.id) +
          "\r\n" +
          {
            salas: "Sala: ",
            privados: "Privado: ",
            status: "Status de red: ",
            "whois-who": "WHOIS/WHO: ",
          }[this.kind(message.target)] +
          clean(message.target) +
          "\r\n\r\n";
        try {
          fs.writeFileSync(file, header, {
            encoding: "utf8",
            mode: 0o600,
            flag: "wx",
          });
        } catch (error) {
          if (error.code !== "EEXIST") throw error;
        }
      }
      const stamp = timestamp(message.time);
      const nick = plain(String(message.nick || ""));
      const prefix = message.event
        ? "*** "
        : message.action
          ? "* " + nick + " "
          : message.notice
            ? "-" + nick + "- "
            : "<" + nick + "> ";
      const lines =
        plain(String(message.text || ""))
          .split(/\n|\u2028|\u2029/)
          .map((line) => "[" + stamp + "] " + prefix + line)
          .join("\r\n") + "\r\n";
      const max = (this.options.textLogMaxMB || 0) * 1048576;
      if (max > 0) {
        const size = fs.statSync(file).size;
        if (Buffer.byteLength(lines) > max) return false;
        if (size + Buffer.byteLength(lines) > max) {
          const bytes = fs.readFileSync(file);
          const keep = Math.max(0, max - Buffer.byteLength(lines) - 3);
          let tail = bytes.subarray(Math.max(0, bytes.length - keep));
          const newline = tail.indexOf(10);
          tail = newline < 0 ? Buffer.alloc(0) : tail.subarray(newline + 1);
          fs.writeFileSync(file, Buffer.concat([Buffer.from("\ufeff"), tail]), {
            mode: 0o600,
          });
        }
      }
      fs.appendFileSync(file, lines, { encoding: "utf8", mode: 0o600 });
    }
    for (const id of ids) {
      this.seen.add(id);
      while (this.seen.size > 20000)
        this.seen.delete(this.seen.values().next().value);
    }
    return !duplicate;
  }

  open() {
    fs.mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    return this.directory;
  }
}
module.exports = { TextLogs, timestamp, filename };
