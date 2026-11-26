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
    client.startupPending = true;
    if(client.presence)client.presence.suspended = true;
    client.on("startup-room-failed",({target})=>{if(s.client===client&&s.startup){s.startup.waiting.delete(fold(target));s.startup.check();}});
    const events = [
      "status",
      "connection-error",
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
      "protocol", "script-raw",
      "identity-observation", "ban-list", "features", "user-profile", "room-list", "presence", "avatar-publish", "oper-state", "presence-nick", "clones", "room-event", "away-state",
    ];
    for (const type of events)
      client.on(type, (data) => {
        if (s.client !== client || this.sessions.get(s.profile.id)!==s) return;
        if (type === "status" && data.state === "connected") {
          s.attempt = 0;
          this.beginStartup(s, client);
        }

        if (type === "channel" && data.own) {
          if (data.action === "join")
            s.channels.set(fold(data.target), data.target);
          else if (data.action === "part" || data.action === "kick")
            s.channels.delete(fold(data.target));
        }
        if(type === "channel" && data.own && data.action === "join" && s.startup) {
          s.startup.joined.add(fold(data.target));s.startup.waiting.delete(fold(data.target));s.startup.check();
        }
        if(type === "server" && s.startup && ["403","405","471","473","474","475","476","477","489"].includes(String(data.code))) {
          for(const name of s.startup.waiting)if((data.text||"").split(/\s+/).some(word=>fold(word)===name))s.startup.waiting.delete(name);s.startup.check();
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
  beginStartup(s, client) {
    const commands=[...(s.profile.commands||[]),...(s.secrets.commands||[])];
    const targets=[...s.channels.values()];
    for(const line of commands){const m=/^\/?join\s+([^\s]+)/i.exec(line);if(m)targets.push(...m[1].split(','));}
    const phase={waiting:new Set(targets.map(fold)),joined:new Set(),done:false};s.startup=phase;
    phase.check=()=>{
      if(s.stopped||s.client!==client||s.startup!==phase||!phase.done||phase.waiting.size)return;
      s.startup=null;client.startupPending=false;
      client.syncAvatars?.();
      if(client.presence){client.presence.suspended=false;client.presence.start();}
      this.emit('event',s.profile.id,'startup-ready',{});
    };
    const complete=()=>{
      if(s.stopped||s.client!==client||s.startup!==phase)return;
      phase.done=true;
      for(const channel of s.channels.values())if(!phase.joined.has(fold(channel)))try{client.join(channel);}catch(e){phase.waiting.delete(fold(channel));this.emit("event",s.profile.id,"problem",e.message);}
      phase.check();
    };
    (commands.length?commands:[null]).forEach((command,i)=>{
      const timer=setTimeout(()=>{s.timers.delete(timer);if(s.stopped||s.client!==client||!client.ready)return;
        try{if(command){if(command.startsWith('/'))executeInput(client,'*',command,(type,data)=>this.emit('event',s.profile.id,type,data));else client.sendRaw(command);}}catch(e){this.emit('event',s.profile.id,'problem',e.message);}
        if(i===(commands.length||1)-1)complete();
      },(s.profile.commandDelay||1000)*i);timer.unref();s.timers.add(timer);
    });
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
