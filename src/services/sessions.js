"use strict";
const { EventEmitter } = require("node:events");
const { executeInput } = require("../commands");
const { IrcClient, fold } = require("../irc");
class SessionManager extends EventEmitter {
  constructor({
    clientFactory = (p, s) => new IrcClient(p, s),
    credentials = () => ({}),
    policy = () => ({}),
  } = {}) {
    super();
    this.sessions = new Map();
    this.factory = clientFactory;
    this.credentials = credentials;
    this.policy = policy;
  }
  connect(profile, credentials) {
    const old = this.sessions.get(profile.id);
    if (old && !old.stopped)
      throw new Error("La red ya está conectando o conectada.");
    const s = {
      profile: structuredClone(profile),
      secrets: credentials || this.credentials(profile.id) || {},
      stopped: false,
      attempt: 0,
      channels: new Map(profile.channels.map((c) => [fold(c), c])),
      timers: new Set(),
    };
    this.sessions.set(profile.id, s);
    this.start(s);
    return s;
  }
  start(s) {
    if (s.stopped) return;
    let profile = { ...s.profile, channels: [...s.channels.values()] };
    const policy = this.policy(profile.host) || {};
    if (policy.expires > Date.now()) {
      profile.tls = true;
      profile.port = policy.port;
    }
    const client = this.factory(profile, s.secrets);
    s.client = client;
    const events = [
      "status",
      "message",
      "users",
      "channel",
      "nick",
      "topic",
      "modes",
      "server",
      "problem",
      "capabilities",
      "user-state",
      "ctcp",
      "reaction",
      "redact",
      "typing",
      "read-marker",
      "delivery",
      "bouncer",
      "certificate",
      "sts",
      "protocol",
      "features",
    ];
    for (const type of events)
      client.on(type, (data) => {
        if (s.client !== client) return;
        if (type === "status" && data.state === "connected") {
          s.attempt = 0;
          const commands = [
            ...s.profile.commands,
            ...(s.secrets.commands || []),
          ];
          commands.forEach((command, i) => {
            const timer = setTimeout(
              () => {
                s.timers.delete(timer);
                if (!s.stopped && client.ready)
                  try {
                    if (command.startsWith("/"))
                      executeInput(client, "*", command, (type, data) =>
                        this.emit("event", s.profile.id, type, data),
                      );
                    else client.sendRaw(command);
                  } catch (e) {
                    this.emit("event", s.profile.id, "problem", e.message);
                  }
              },
              s.profile.commandDelay * (i + 1),
            );
            timer.unref();
            s.timers.add(timer);
          });
        }
        if (type === "channel" && data.own) {
          if (data.action === "join")
            s.channels.set(fold(data.target), data.target);
          else if (data.action === "part" || data.action === "kick")
            s.channels.delete(fold(data.target));
        }
        this.emit(
          "event",
          s.profile.id,
          type,
          type === "status"
            ? {
                ...data,
                connection: {
                  host: profile.host,
                  port: profile.port,
                  tls: profile.tls,
                },
              }
            : data,
        );
        if (type === "status" && data.state === "disconnected") {
          for (const timer of s.timers) clearTimeout(timer);
          s.timers.clear();
          if (s.upgrading && !s.stopped) {
            s.upgrading = false;
            queueMicrotask(() => this.start(s));
            return;
          }
          if (!s.stopped && s.profile.autoReconnect) {
            const delay = Math.min(
              300000,
              s.profile.reconnectDelay *
                1000 *
                Math.pow(2, Math.min(s.attempt++, 6)),
            );
            this.emit("event", s.profile.id, "status", {
              state: "connecting",
              text: `Reconectando en ${Math.ceil(delay / 1000)} s…`,
              connection: {
                host: profile.host,
                port: profile.port,
                tls: profile.tls,
              },
            });
            s.retry = setTimeout(() => this.start(s), delay);
            s.retry.unref();
          } else s.stopped = true;
        }
      });
    client.on("upgrade", ({ port }) => {
      s.profile.tls = true;
      s.profile.port = port;
      s.upgrading = true;
      client.disconnect();
    });
    try {
      client.connect();
    } catch (e) {
      s.stopped = true;
      throw e;
    }
  }
  get(id) {
    return this.sessions.get(id)?.client;
  }
  disconnect(id) {
    const s = this.sessions.get(id);
    if (!s) return;
    s.stopped = true;
    clearTimeout(s.retry);
    for (const t of s.timers) clearTimeout(t);
    s.timers.clear();
    s.client?.disconnect();
    this.emit("event", id, "status", {
      state: "disconnected",
      text: "Desconectado",
    });
  }
  close() {
    for (const id of this.sessions.keys()) this.disconnect(id);
  }
}
module.exports = { SessionManager };
