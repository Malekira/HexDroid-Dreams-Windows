"use strict";
const fs = require("node:fs");
const path = require("node:path");
class HistoryStore {
  constructor(directory) {
    this.legacyFile = path.join(directory, "history.sqlite");
    this.directory = path.join(directory, "HexDreams-IRC-history");
    this.file = path.join(this.directory, "hexdreams-history.sqlite");
  }
  open() {
    if (this.db) return;
    const { DatabaseSync } = require("node:sqlite");
    fs.mkdirSync(this.directory, { recursive: true });
    this.db = new DatabaseSync(this.file);
    try {
      const owner = this.db.prepare("PRAGMA application_id").get().application_id;
      if (owner !== 0 && owner !== 0x48445848) throw Error("El archivo de historial pertenece a otra aplicación.");
      if (owner === 0 && this.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().length) throw Error("El archivo de historial no es una base exclusiva de HexDreams.");
      this.db.exec("PRAGMA application_id=1212438600;");
      this.db
        .exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON;
        CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY,network TEXT NOT NULL,target TEXT NOT NULL,nick TEXT NOT NULL,text TEXT NOT NULL,time TEXT NOT NULL,msgid TEXT,clientid TEXT,action INTEGER DEFAULT 0,own INTEGER DEFAULT 0,event INTEGER DEFAULT 0);
        CREATE UNIQUE INDEX IF NOT EXISTS msgid_unique ON messages(network,msgid) WHERE msgid IS NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS clientid_unique ON messages(network,clientid) WHERE clientid IS NOT NULL;
        CREATE INDEX IF NOT EXISTS conversation_time ON messages(network,target,time);
        CREATE VIRTUAL TABLE IF NOT EXISTS search USING fts5(text,nick,content='messages',content_rowid='id');
        CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN INSERT INTO search(rowid,text,nick) VALUES(new.id,new.text,new.nick); END;
        CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN INSERT INTO search(search,rowid,text,nick) VALUES('delete',old.id,old.text,old.nick); END;`);
      if (
        !this.db
          .prepare("PRAGMA table_info(messages)")
          .all()
          .some((column) => column.name === "event")
      )
        this.db.exec("ALTER TABLE messages ADD COLUMN event INTEGER DEFAULT 0");
      this.importLegacy(DatabaseSync);
    } catch (error) {
      this.close();
      throw error;
    }
  }
  importLegacy(DatabaseSync) {
    this.db.exec("CREATE TABLE IF NOT EXISTS hexdreams_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL)");
    if (this.db.prepare("SELECT value FROM hexdreams_meta WHERE key='legacy-import'").get()) return;
    let source;
    try {
      this.db.exec("BEGIN IMMEDIATE");
      if (fs.existsSync(this.legacyFile)) {
        source = new DatabaseSync(this.legacyFile, { readOnly: true });
        const columns = source.prepare("PRAGMA table_info(messages)").all();
        if (!columns.length) throw Error("La base anterior no contiene la tabla de mensajes.");
        const event = columns.some(c => c.name === "event") ? "event" : "0 AS event";
        const insert = this.db.prepare("INSERT INTO messages(id,network,target,nick,text,time,msgid,clientid,action,own,event) VALUES(?,?,?,?,?,?,?,?,?,?,?)");
        for (const row of source.prepare("SELECT id,network,target,nick,text,time,msgid,clientid,action,own," + event + " FROM messages ORDER BY id").iterate()) {
          insert.run(row.id,row.network,row.target,row.nick,row.text,row.time,row.msgid,row.clientid,row.action,row.own,row.event);
        }
      }
      this.db.prepare("INSERT INTO hexdreams_meta VALUES('legacy-import',?)").run(source ? "copied" : "absent");
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw new Error("No se pudo copiar el historial anterior; se conserva intacto. " + error.message);
    } finally {
      source?.close();
    }
  }
  append(network, message) {
    this.open();
    const t = new Date(message.time || Date.now());
    if (Number.isNaN(t.valueOf()))
      throw new Error("Fecha de historial no válida.");
    if (message.clientId && message.messageId)
      this.db
        .prepare(
          "UPDATE messages SET msgid=COALESCE(msgid,?) WHERE network=? AND clientid=? AND target=?",
        )
        .run(
          message.messageId,
          network,
          message.clientId,
          message.target.toLowerCase(),
        );
    return (
      this.db
        .prepare(
          "INSERT OR IGNORE INTO messages(network,target,nick,text,time,msgid,clientid,action,own,event) VALUES(?,?,?,?,?,?,?,?,?,?)",
        )
        .run(
          network,
          message.target.toLowerCase(),
          message.nick || "",
          message.text,
          t.toISOString(),
          message.messageId || null,
          message.clientId || null,
          message.action ? 1 : 0,
          message.own ? 1 : 0,
          message.event ? 1 : 0,
        ).changes > 0
    );
  }
  query(
    { network, target, text = "", nick = "", limit = 100, before } = {},
    maximum = 500,
  ) {
    this.open();
    const args = [],
      where = [];
    if (network) {
      where.push("m.network=?");
      args.push(network);
    }
    if (target) {
      where.push("m.target=?");
      args.push(target.toLowerCase());
    }
    if (nick) {
      where.push("m.nick=? COLLATE NOCASE");
      args.push(nick);
    }
    if (before) {
      where.push("m.time<?");
      args.push(new Date(before).toISOString());
    }
    if (text) {
      where.push("m.id IN (SELECT rowid FROM search WHERE search MATCH ?)");
      args.push('"' + String(text).slice(0, 500).replace(/"/g, '""') + '"');
    }
    args.push(Math.max(1, Math.min(maximum, Number(limit) || 100)));
    return this.db
      .prepare(
        "SELECT m.*,m.msgid AS messageId,m.clientid AS clientId,(m.event=1 OR m.target='*consultas*') AS event FROM messages m" +
          (where.length ? " WHERE " + where.join(" AND ") : "") +
          " ORDER BY m.time DESC,m.id DESC LIMIT ?",
      )
      .all(...args)
      .reverse();
  }
  prune(days) {
    this.open();
    if (Number(days) > 0)
      this.db
        .prepare("DELETE FROM messages WHERE time<?")
        .run(
          new Date(Date.now() - Math.min(36500, days) * 86400000).toISOString(),
        );
  }
  redact(network, msgid) {
    this.open();
    this.db
      .prepare("DELETE FROM messages WHERE network=? AND msgid=?")
      .run(network, msgid);
  }
  clear() {
    this.open();
    this.db.exec("DELETE FROM messages; PRAGMA wal_checkpoint(TRUNCATE);");
  }
  close() {
    this.db?.close();
    this.db = null;
  }
}
module.exports = { HistoryStore };
