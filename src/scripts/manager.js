"use strict";
const { Worker } = require("node:worker_threads");
const { EventEmitter } = require("node:events");
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { HexVM } = require("./interpreter");
const PERMISSIONS = [
  "read",
  "intercept",
  "send",
  "raw",
  "http",
  "ui",
  "persist",
  "crypto",
];
class ScriptManager extends EventEmitter {
  constructor(
    directory,
    {
      host = async () => {},
      web,
      fields = () => ({}),
      getState = () => ({}),
    } = {},
  ) {
    super();
    this.file = path.join(directory, "scripts.json");
    this.host = host;
    this.web = web;
    this.fields = fields;
    this.getState = getState;
    this.scripts = [];
    this.debug = [];
    this.pending = new Map();
    this.timers = new Map();
    this.serial = Promise.resolve();
    this.count = 0;
    this.inFlight = 0;
    this.rate = new Map();
    try {
      const data = JSON.parse(fs.readFileSync(this.file, "utf8"));
      if (Array.isArray(data))
        for (const script of data.slice(0, 50)) {
          try {
            this.validate(script);
            script.permissions = [...PERMISSIONS];
            this.scripts.push(script);
          } catch (e) {
            this.report(script.id, "Script guardado desactivado: " + e.message);
          }
        }
    } catch {}
  }
  validate(s) {
    if (
      !s ||
      typeof s.id !== "string" ||
      !/^[a-z\d_-]{1,80}$/i.test(s.id) ||
      typeof s.enabled !== "boolean" ||
      typeof s.name !== "string" ||
      s.name.length > 100 ||
      typeof s.source !== "string" ||
      Buffer.byteLength(s.source, "utf8") > 262144 ||
      !Array.isArray(s.permissions) ||
      s.permissions.some((p) => !PERMISSIONS.includes(p)) ||
      !Array.isArray(s.domains) ||
      s.domains.length > 30 ||
      s.domains.some(
        (d) => typeof d !== "string" || !/^[a-z\d][a-z\d.-]*$/i.test(d),
      )
    )
      throw new Error("Script o permisos no válidos.");
    new HexVM().install([s]);
  }
  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(
      this.file + ".tmp",
      JSON.stringify(this.scripts, null, 2),
      { mode: 0o600 },
    );
    fs.renameSync(this.file + ".tmp", this.file);
    this.emit("changed");
  }
  list() {
    return this.scripts.map((s) => ({
      id: s.id,
      name: s.name,
      enabled: s.enabled === true,
      permissions: s.permissions,
      domains: s.domains,
    }));
  }
  install(name, source) {
    if (this.scripts.length >= 50)
      throw new Error("Límite de scripts instalados.");
    const script = {
      id: crypto.randomUUID(),
      name,
      source,
      permissions: [...PERMISSIONS],
      domains: [],
      enabled: false,
    };
    this.validate(script);
    this.scripts.push(script);
    this.save();
    return script.id;
  }
  read(id) {
    const script = this.scripts.find((s) => s.id === id);
    if (!script) throw Error("Script no encontrado.");
    return {
      id: script.id,
      name: script.name,
      source: script.source,
      revision: crypto
        .createHash("sha256")
        .update(script.name + "\0" + script.source)
        .digest("hex"),
    };
  }
  async update(id, { name, source, revision }) {
    const old = this.scripts.find((s) => s.id === id);
    if (!old) throw Error("Script no encontrado.");
    if (revision !== this.read(id).revision)
      throw Error(
        "El script cambió desde que lo abriste. Vuelve a cargarlo antes de guardar.",
      );
    const next = {
      ...old,
      name,
      source,
      enabled: false,
      permissions: [...PERMISSIONS],
      domains: [],
    };
    this.validate(next);
    Object.assign(old, next);
    this.save();
    await this.restart();
    return this.read(id);
  }
  help(id) {
    const s = this.scripts.find((s) => s.id === id);
    if (!s) throw Error("Script no encontrado.");
    this.helpCache ||= new Map();
    const key = crypto.createHash("sha256").update(s.source).digest("hex");
    let cached = this.helpCache.get(id);
    if (cached?.key !== key) {
      cached = { key, commands: require("./catalog").catalog(s.source) };
      this.helpCache.set(id, cached);
    }
    return {
      id: s.id,
      name: s.name,
      enabled: s.enabled,
      commands: cached.commands,
    };
  }
  completions() {
    const byName = new Map();
    for (const script of this.scripts.filter((s) => s.enabled))
      for (const command of this.help(script.id).commands)
        byName.set(command.name.toLowerCase(), {
          ...command,
          script: script.name,
        });
    return [...byName.values()];
  }
  domainsFor(script, callers, url) {
    for (const id of new Set([script, ...(callers || [])]))
      this.allowed(id, "http");
    return [new URL(url).hostname.replace(/^\[|\]$/g, "")];
  }
  async configure(id, { enabled, permissions, domains }) {
    const old = this.scripts.find((s) => s.id === id);
    if (!old) throw new Error("Script no encontrado.");
    const next = {
      ...old,
      enabled: enabled === true,
      permissions: [...PERMISSIONS],
      domains: Array.isArray(domains) ? domains : old.domains,
    };
    this.validate(next);
    Object.assign(old, next);
    this.save();
    await this.restart();
  }
  async remove(id) {
    this.scripts = this.scripts.filter((s) => s.id !== id);
    this.save();
    await this.restart();
  }
  report(script, text) {
    const item = {
      script,
      text: String(text).slice(0, 2000),
      time: new Date().toISOString(),
    };
    this.debug.push(item);
    if (this.debug.length > 200) this.debug.shift();
    this.emit("error-report", item);
  }
  stopWorker() {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    this.worker?.terminate();
    this.worker = null;
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(new Error("El motor de scripts se reinició."));
    }
    this.pending.clear();
  }
  async restart() {
    this.stopWorker();
    const scripts = this.scripts
      .filter((s) => s.enabled)
      .map((s) => ({
        ...s,
        state: s.permissions.includes("persist") ? this.getState(s.id) : {},
      }));
    if (!scripts.length) return;
    this.worker = new Worker(path.join(__dirname, "worker.js"), {
      resourceLimits: { maxOldGenerationSizeMb: 64, stackSizeMb: 2 },
    });
    this.worker.on("message", (message) => {
      const p = this.pending.get(message.id);
      if (!p) return;
      this.pending.delete(message.id);
      clearTimeout(p.timer);
      message.error
        ? p.reject(new Error(message.error))
        : p.resolve(message.result);
    });
    this.worker.on("error", (error) => {
      this.report("", error.message);
      this.stopWorker();
    });
    const result = await this.request({ type: "install", scripts });
    this.aliasNames = result.aliases;
    await this.event("LOAD", {});
  }
  request(message) {
    if (!this.worker)
      return Promise.resolve({
        actions: [],
        text: message.fields?.text || "",
        halted: false,
        handled: false,
      });
    return new Promise((resolve, reject) => {
      const id = ++this.count,
        timer = setTimeout(() => {
          this.pending.delete(id);
          reject(
            new Error("Se detuvo un script por exceder el tiempo permitido."),
          );
          this.report(
            "",
            "Motor detenido por presupuesto o expresión regular bloqueante. Desactiva el script defectuoso y vuelve a habilitar los demás.",
          );
          this.stopWorker();
        }, 600);
      timer.unref();
      this.pending.set(id, { resolve, reject, timer });
      this.worker.postMessage({ id, ...message });
    });
  }
  async run(message) {
    if (this.inFlight >= 100) {
      this.report(
        "",
        "Se omitió un evento de script para mantener IRC operativo.",
      );
      return { text: message.fields?.text || "", actions: [], halted: false };
    }
    this.inFlight++;
    const execute = async () => {
      try {
        const result = await this.request({
          ...message,
          fields: { ...this.fields(message.fields), ...message.fields },
        });
        await this.actions(result.actions || [], message.fields || {});
        return result;
      } catch (e) {
        this.report("", e.message);
        return {
          text: message.fields?.text || "",
          actions: [],
          halted: false,
          handled: false,
        };
      } finally {
        this.inFlight--;
      }
    };
    const result = this.serial.catch(() => {}).then(execute);
    this.serial = result.then(
      () => {},
      () => {},
    );
    return result;
  }
  event(name, fields, args = []) {
    if (!this.worker)
      return Promise.resolve({
        text: fields.text || "",
        halted: false,
        actions: [],
      });
    return this.run({ type: "event", name, fields, args });
  }
  alias(name, fields, args = []) {
    if (!this.worker || !this.aliasNames?.includes(name.toLowerCase()))
      return Promise.resolve({ handled: false, actions: [] });
    return this.run({ type: "alias", name, fields, args });
  }
  allowed(script, permission, callers = []) {
    let owner;
    for (const id of new Set([script, ...callers])) {
      const s = this.scripts.find((s) => s.id === id && s.enabled);
      if (!s || !s.permissions.includes(permission))
        throw new Error("El script no tiene permiso: " + permission);
      if (id === script) owner = s;
    }
    return owner;
  }
  async actions(actions, fields) {
    for (const action of actions) {
      try {
        const owner = action.script;
        if (action.type === "error") {
          this.report(owner, action.text);
          continue;
        }
        if (action.type === "disable") {
          const s = this.scripts.find((s) => s.id === owner);
          if (s) {
            s.enabled = false;
            this.save();
            await this.request({ type: "disable", script: owner });
          }
          continue;
        }
        const times = (this.rate.get(owner) || []).filter(
          (t) => Date.now() - t < 1000,
        );
        if (times.length >= 40)
          throw new Error("Límite de acciones por segundo del script.");
        times.push(Date.now());
        this.rate.set(owner, times);
        if (action.type === "timer") {
          this.allowed(owner, "read", action.callers);
          if (this.timers.size >= 100)
            throw new Error("Demasiados temporizadores de script.");
          const id = crypto.randomUUID(),
            timer = setTimeout(() => {
              this.timers.delete(id);
              this.event(
                "SIGNAL:" + String(action.signal).toUpperCase(),
                {
                  ...action.fields,
                  __scriptCallers: action.callers,
                  network: fields.network,
                  buffer: fields.buffer,
                  chan: fields.chan,
                },
                action.args,
              ).catch((e) => this.report(owner, e.message));
            }, action.ms);
          timer.unref();
          this.timers.set(id, timer);
          continue;
        }
        if (action.type === "http") {
          const s = this.allowed(owner, "http", action.callers);
          const body =
            action.body === undefined ? undefined : Buffer.from(action.body);
          if (body && body.length > 1048576)
            throw new Error("Petición HTTP de script demasiado grande.");
          const headers = { ...action.headers };
          if (
            body &&
            !Object.keys(headers).some(
              (k) => k.toLowerCase() === "content-type",
            )
          )
            headers["Content-Type"] = /^\s*[\[{]/.test(action.body)
              ? "application/json"
              : /^[^\s]+=[^\s]*$/.test(action.body)
                ? "application/x-www-form-urlencoded"
                : "text/plain; charset=utf-8";
          this.web
            .request(action.url, {
              domains: this.domainsFor(owner, action.callers, action.url),
              method: action.method,
              headers,
              body,
            })
            .then(
              (response) =>
                this.event(
                  "SIGNAL:" + action.signal.toUpperCase(),
                  {
                    ...action.fields,
                    __scriptCallers: action.callers,
                    httpok: String(
                      response.status >= 200 && response.status < 300,
                    ),
                    httpstatus: String(response.status),
                    httpbody: response.body.toString("utf8"),
                    httplocation: response.headers.location,
                    httperror: "",
                  },
                  action.args,
                ),
              (error) =>
                this.event(
                  "SIGNAL:" + action.signal.toUpperCase(),
                  {
                    ...action.fields,
                    __scriptCallers: action.callers,
                    httpok: "false",
                    httpstatus: "0",
                    httpbody: "",
                    httplocation: "",
                    httperror: error.message,
                  },
                  action.args,
                ),
            )
            .catch((e) => this.report(owner, e.message));
          continue;
        }
        if (["log", "debug"].includes(action.type)) {
          this.report(owner, action.text);
          continue;
        }
        if (action.type === "media.pick")
          this.allowed(owner, "ui", action.callers);
        else if (action.type === "media.upload")
          this.allowed(owner, "http", action.callers);
        else if (action.type === "raw")
          this.allowed(owner, "raw", action.callers);
        else if (
          [
            "msg",
            "me",
            "join",
            "part",
            "cycle",
            "topic",
            "mode",
            "invite",
            "kick",
            "knock",
            "names",
            "who",
            "whois",
            "whowas",
            "list",
            "notice",
            "ctcp",
            "nick",
            "away",
            "back",
            "op",
            "deop",
            "voice",
            "devoice",
            "ban",
            "unban",
            "ignore",
            "unignore",
          ].includes(action.type)
        )
          this.allowed(owner, "send", action.callers);
        else if (action.type.startsWith("age."))
          this.allowed(owner, "crypto", action.callers);
        else if (action.type.startsWith("state."))
          this.allowed(owner, "persist", action.callers);
        else if (["echo", "view", "toast", "sidebar"].includes(action.type))
          this.allowed(owner, "ui", action.callers);
        else throw new Error("Comando .hex no soportado: " + action.type);
        await this.host(action, {
          ...action.fields,
          __scriptCallers: action.callers,
          network: fields.network ?? action.fields?.network,
          buffer: fields.buffer ?? action.fields?.buffer,
          script: owner,
        });
      } catch (e) {
        this.report(action.script, e.message);
      }
    }
  }
  close() {
    this.stopWorker();
  }
}
module.exports = { ScriptManager, PERMISSIONS };
