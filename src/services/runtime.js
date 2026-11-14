"use strict";
const fs = require("node:fs"),
  path = require("node:path");
const { IrcClient } = require("../irc");
const { SessionManager } = require("./sessions");
const { SecretVault } = require("./vault");
const { HistoryStore } = require("./history");
const { CryptoManager, validateTargets } = require("../crypto/manager");
const { ScriptManager } = require("../scripts/manager");
const { DccManager } = require("./dcc");
const { ProtocolLog } = require("./protocol-log");
const { ScriptMedia } = require("./script-media");
const { WebClient, imageMime, titleOf } = require("./web");
const { createBackup, readBackup } = require("./backups");
const { executeInput } = require("../commands");
class Runtime {
  constructor({ directory, electron, getWindow, getConfig, saveConfig, emit }) {
    Object.assign(this, {
      directory,
      electron,
      getWindow,
      getConfig,
      saveConfig,
      emit,
    });
    this.memory = new Map();
    this.cryptoAdapters = new Map();
    this.queues = new Map();
    this.sts = {};
    this.mediaCache = new Map();
    this.avatarCache=new Map();this.pendingCertificates=new Map();this.trustedCertificates={};
    try{this.trustedCertificates=JSON.parse(fs.readFileSync(path.join(directory,'server-certificates.json'),'utf8'));}catch{}
    this.launchers = new Map();
    this.badge = 0;
    this.notificationLog = [];
    this.autoAway=new (require('./auto-away').AutoAway)();

    try {
      this.sts = JSON.parse(
        fs.readFileSync(path.join(directory, "sts.json"), "utf8"),
      );
    } catch {}
    this.vault = new SecretVault(directory, electron.safeStorage);
    let historyDirectory = directory;
    try {
      historyDirectory = JSON.parse(
        fs.readFileSync(path.join(directory, "history-folder.json"), "utf8"),
      ).directory;
    } catch {}
    this.history = new HistoryStore(historyDirectory);
    this.textLogs=new (require("./text-logs").TextLogs)(directory);
    try{const selected=JSON.parse(fs.readFileSync(path.join(directory,"text-log-folder.json"),"utf8")).directory;if(typeof selected==="string"&&path.isAbsolute(selected))this.textLogs.directory=selected;}catch{}
    this.protocolLog = new ProtocolLog(directory, electron.safeStorage);
    this.crypto = new CryptoManager(directory, this.vault);
    this.sessions = new SessionManager({
      credentials: (id) => this.credentials(id),
      policy: (host) => this.sts[host],
      clientFactory: (profile, secrets) => {
        const c = new IrcClient({...profile,ownAvatarTemplate:profile.photoUrl||this.getConfig().settings.avatarUrlTemplate||'https://chat-avatars.chateagratis.net/avatar/Chat/{Nick}.png',avatarDiscovery:this.getConfig().settings.mediaEnabled!==false&&this.getConfig().settings.autoAvatars===true&&(this.getConfig().settings.showAvatars!==false||this.getConfig().settings.showMessageAvatars!==false)}, secrets);
        this.cryptoAdapters.set(profile.id, this.crypto.attach(profile.id, c));
        return c;
      },
    });
    this.awayTimer=setInterval(()=>{try{this.autoAway.tick([...this.sessions.sessions.values()].map(s=>({id:s.profile.id,client:s.stopped?null:s.client})),this.getConfig().settings,this.electron.powerMonitor?.getSystemIdleTime()||0);}catch(e){this.emit(null,'problem',{text:e.message});}},1000);this.awayTimer.unref();
    this.web = new WebClient({
      canConnect: () =>
        ![...this.sessions.sessions.values()].some(
          (s) => !s.stopped && s.profile.proxy,
        ),
    });
    this.scripts = new ScriptManager(directory, {
      web: this.web,
      host: (a, f) => this.scriptAction(a, f),
      getState: (id) =>
        this.vault.available()
          ? this.vault.get("script-state:" + id) || {}
          : {},
      fields: (f) => ({
        me: this.sessions.get(f?.network)?.nick || "",
        settings: {
          applang: electron.app.getLocale().split("-")[0],
          lang: electron.app.getLocale().split("-")[0],
        },
        ...f,
      }),
    });
    this.scripts.on("changed",()=>this.emit(null,"script-commands",{commands:this.scripts.completions()}));
    this.scriptMedia = new ScriptMedia({
      web: this.web,
      pick: (o) => this.pick(o),
      confirm: (m, d) => this.confirm(m, d),
      allowed: (...args) => this.scripts.allowed(...args),
      domainsFor: (...args)=>this.scripts.domainsFor(...args),
      signal: (owner, name, fields, result, args) =>
        this.scripts
          .event(
            "SIGNAL:" + name.toUpperCase(),
            {
              ...fields,
              ...result,
              __onlyScript: owner,
              __scriptCallers: [owner],
            },
            args,
          )
          .catch((e) => this.scripts.report(owner, e.message)),
    });
    try {
      this.downloadsDirectory = JSON.parse(
        fs.readFileSync(path.join(directory, "downloads-folder.json"), "utf8"),
      ).directory;
    } catch {}
    this.dcc = new DccManager({
      directory,
      settings: () => ({
        ...this.getConfig().settings,
        ...(this.downloadsDirectory
          ? { downloadsDirectory: this.downloadsDirectory }
          : {}),
      }),
      send: (id, nick, line) => this.ctcp(id, nick, line),
      canConnect: (id) =>
        !this.sessions.sessions.get(id)?.profile.proxy ||
        this.getConfig().settings.dccAllowDirect === true,
      trust: (network, nick) =>
        this.vault.available()
          ? this.vault.get("dcc-trust:" + network + ":" + nick.toLowerCase())
          : null,
      tlsMaterial: (host) => this.dccCertificate(host),
    });
    this.sessions.on("event",(id,type,data)=>this.enqueue(id,type,data));
    this.crypto.on("security", (data) =>
      this.emit(data.network, "security", data),
    );
    this.scripts.on("error-report", (data) =>
      this.emit(null, "script-error", data),
    );
    this.dcc.on("update", (data) => this.emit(data.network, "dcc", data));
    this.dcc.on("chat", (data) => this.emit(data.network, "dcc-chat", data));
    this.dcc.on("problem", (text) => this.emit(null, "problem", { text }));
    this.scripts
      .restart()
      .catch((e) => this.emit(null, "problem", { text: e.message }));
  }
  credentials(id) {
    const secrets = (
      this.memory.get(id) ||
      (this.vault.available() ? this.vault.get("network:" + id) : null) ||
      {}
    );
    const pin=this.trustedCertificates?.[id];return pin?{...secrets,tlsPin:pin}:secrets;
  }
  connect({ id, password, credentials, remember = false } = {}) {
    const profile = this.getConfig().profiles.find((p) => p.id === id);
    if (!profile) throw new Error("Guarda la red antes de conectar.");
    let secrets = { ...this.credentials(id) };
    if (password !== undefined) secrets.serverPassword = String(password);
    if (credentials?.channelKeys) {
      if (
        typeof credentials.channelKeys !== "object" ||
        Array.isArray(credentials.channelKeys) ||
        Object.keys(credentials.channelKeys).length > 100
      )
        throw new Error("Claves de canal no válidas.");
      for (const [channel, key] of Object.entries(credentials.channelKeys))
        if (
          !/^[#&+!][^\s,:\0]+$/.test(channel) ||
          typeof key !== "string" ||
          !key ||
          /[\s\0\r\n:,]/.test(key)
        )
          throw new Error("Clave de canal no válida.");
      secrets.channelKeys = credentials.channelKeys;
    }
    if (credentials?.commands) {
      if (
        !Array.isArray(credentials.commands) ||
        credentials.commands.length > 50 ||
        credentials.commands.some(
          (c) =>
            typeof c !== "string" ||
            /[\0\r\n]/.test(c) ||
            Buffer.byteLength(c) > 500,
        )
      )
        throw new Error("Comandos protegidos no válidos.");
      secrets.commands = credentials.commands;
    }
    if (credentials) {
      for (const key of [
        "serverPassword",
        "saslPassword",
        "proxyUser",
        "proxyPassword",
      ])
        if (
          typeof credentials[key] === "string" &&
          credentials[key].length <= 4096
        )
          secrets[key] = credentials[key];
    }
    this.memory.set(id, secrets);
    if (remember) this.vault.set("network:" + id, secrets);
    this.sessions.connect(profile, secrets);
    return { ok: true };
  }
  writeTextLog(id,message){
    if(this.getConfig().settings.textLogsEnabled===false||!this.textLogs)return;
    const profile=this.getConfig().profiles.find(p=>p.id===id);if(!profile)return;
    try{this.textLogs.configure(this.getConfig().settings);this.textLogs.append(profile,message);}catch(error){if(!this.textLogErrorAt||Date.now()-this.textLogErrorAt>30000){this.textLogErrorAt=Date.now();this.emit(id,'problem',{text:'No se pudo guardar el historial TXT: '+error.message});}}
  }
  enqueue(id,type,data){if(this.closed)return;if(type==='delivery'){this.emit(id,type,data);return;}const previous=this.queues.get(id)||Promise.resolve(),next=previous.then(()=>this.receive(id,type,data)).catch(e=>this.emit(id,'problem',{text:e.message}));this.queues.set(id,next);}
  async receive(id, type, data) {
    if(this.closed)return;
    if (type === "protocol") {
      if (this.getConfig().settings.protocolLogging)
        this.protocolLog.append(id, data.direction, data.line);
      return;
    }
    if(type==='certificate'&&!data.trusted){this.pendingCertificates.set(id,data);const s=this.sessions.sessions.get(id);if(s){s.stopped=true;clearTimeout(s.retry);}}
    if (type === "problem") {
      this.writeTextLog(id,{target:"*",event:true,text:String(data)});
      this.emit(id, type, { text: String(data) });
      return;
    }
    if (type === "sts" && data.expires > Date.now()) {
      this.sts[this.sessions.get(id).profile.host] = data;
      fs.writeFileSync(
        path.join(this.directory, "sts.json"),
        JSON.stringify(this.sts),
      );
    }
    if(type==='presence-nick'&&!data.privateOnly){
      const s=this.getConfig().settings;
      if(s.notifications!==false&&s.notifyPresence!==false&&s.notifyNickChanges!==false&&!(s.mutedUsers?.[id]||[]).some(n=>[data.nick,data.old,data.newNick].some(name=>require('../irc').fold(n)===require('../irc').fold(name)))){
        const text=data.old+' → '+data.newNick;
        if(s.notifyPresenceSound!==false)this.electron.shell.beep();
        this.emit(id,'presence-alert',{text:'Notify · '+text,nick:data.nick,old:data.old,newNick:data.newNick});
        if(!this.getWindow()?.isFocused()&&this.electron.Notification.isSupported()){const notification=new this.electron.Notification({title:'Notify · Cambio de nick',body:text,silent:true});notification.show();}
      }
    }
    if(type==='presence'&&!data.privateOnly&&!data.initial&&!data.renamed&&!data.duplicate){const s=this.getConfig().settings;if(s.notifications!==false&&s.notifyPresence!==false&&(data.online||s.notifyPresenceOffline!==false)&&!(s.mutedUsers?.[id]||[]).some(n=>require('../irc').fold(n)===require('../irc').fold(data.nick))){if(s.notifyPresenceSound!==false)this.electron.shell.beep();const text=data.nick+(data.online?' se conectó':' se desconectó');this.emit(id,'presence-alert',{text,nick:data.nick,online:data.online});if(!this.getWindow()?.isFocused()&&this.electron.Notification.isSupported()){const n=new this.electron.Notification({title:'Notify · '+(this.getConfig().profiles.find(p=>p.id===id)?.name||''),body:text,silent:true});n.show();}}}
    if (type === "message") {
      if (
        !data.own &&
        (this.getConfig().settings.ignoredUsers?.[id] || []).some(
          (n) => n.toLowerCase() === data.nick.toLowerCase(),
        )
      )
        return;
      if (
        data.own &&
        /^(?:nickserv|chanserv|hostserv|operserv|auth|q)$/i.test(data.target) &&
        /^(?:identify|register|recover|ghost|release|login|set\s+password)\b/i.test(
          data.text,
        )
      )
        data = { ...data, text: "[Credenciales omitidas]" };
      data = this.cryptoAdapters.get(id).receive(data);
      if (!data) return;
      const privateMessage=!/^[#&+!]/.test(data.target);
      const eventFields={
        private:privateMessage, channel:!privateMessage, notice:!!data.notice, historical:!!data.historical, new:!data.historical, conversation:data.target,
        network: id,
        buffer: data.target,
        chan: data.target,
        nick: data.nick,
        own: !!data.own,
        text: data.text,
      };
      const result=await this.scripts.event(data.action?"ACTION":"TEXT",eventFields);
      if(data.notice){const notice=await this.scripts.event("NOTICE",{...eventFields,text:result.text});result.halted ||= notice.halted;result.text=notice.text;}
      if (result.halted && privateMessage && !data.own && !data.historical) return;
      data = { ...data, text: result.text };
      const outputs=data.notice?require('./notice-policy').destinations(data,this.getConfig().settings,this.activeConversation?.id===id?this.activeConversation:null).map(target=>({...data,target,sourceTarget:data.target})):[data];
      for(const output of outputs){if(this.getConfig().settings.historyEnabled){this.history.append(id,output);this.history.prune(this.getConfig().settings.historyDays);}this.writeTextLog(id,output);}
      if(!data.own&&!data.historical)this.notify(id,{...data,notificationTarget:outputs[0]?.target});
      if(data.notice){for(const output of outputs)this.emit(id,type,output);return;}

    }
    if (type === "server") {
      const r = await this.scripts.event("NUMERIC", {
        network: id,
        buffer: data.target || "*",
        text: data.text,
        code: data.code || "",
        whois: String(data.whois === true),
      });
      if (r.halted) return;
      data = { ...data, text: r.text };
      this.writeTextLog(id,{...data,target:data.target||"*",nick:"Servidor",event:true});
      if(data.target==='*consultas*'&&this.getConfig().settings.queryHistoryEnabled!==false){this.history.append(id,{...data,target:'*consultas*',nick:'Servidor'});this.history.prune(this.getConfig().settings.historyDays);}
    }
    if (
      type === "certificate" &&
      data.trusted &&
      this.sessions.get(id)?.profile.tofu
    ) {
      const secrets = this.credentials(id);
      if (!secrets.tlsPin) {
        secrets.tlsPin = { fingerprint: data.fingerprint, pem: data.pem };
        this.vault.set("network:" + id, secrets);
        this.memory.set(id, secrets);
      }
    }
    if (type === "redact" && this.getConfig().settings.historyEnabled)
      this.history.redact(id, data.messageId);
    if (type === "ctcp" && data.command === "DCC") {
      try {
        this.dcc.offer(id, data.nick, data.args);
      } catch (e) {
        this.emit(id, "problem", { text: e.message });
      }
    }
    if (type === "status" && ["connected", "disconnected"].includes(data.state))
      await this.scripts.event(
        data.state === "connected" ? "CONNECT" : "DISCONNECT",
        { network: id },
      );
    if(type==='nick')await this.scripts.event('NICK',{network:id,buffer:data.nick,chan:data.nick,nick:data.old,newnick:data.nick,own:data.own});
    if(type==='away-state')this.autoAway?.observe(id,data.away);
    if(type==='status'&&data.state==='disconnected')this.autoAway?.forget(id);
    if(type==='status')this.writeTextLog(id,{target:'*',event:true,text:data.text||data.state});
    const roomEvents=[];
    const event=(target,text)=>{if(/^[#&+!]/.test(target||''))roomEvents.push({target,event:true,time:data.time,text});};
    if(type==='room-event')event(data.target,data.text);
    if(type==='channel')event(data.target,(data.nick||'')+' '+({join:'entró en la sala',part:'salió de la sala',quit:'se desconectó',kick:'fue expulsado'}[data.action]||data.action)+(data.by?' por '+data.by:'')+(data.reason?' · '+data.reason:''));
    if(type==='nick')for(const target of data.targets||[])event(target,data.old+' → '+data.nick+' cambió de nick');
    if(type==='clones')event(data.target,'Posibles clones (mismo host): '+data.nicks.join(', '));
    if(type==='topic')event(data.target,'Tema de la sala: '+data.text);
    if(type==='modes')event(data.target,'Modos de la sala: '+data.text);
    for(const message of roomEvents){
      this.writeTextLog(id,message);
      if(this.getConfig().settings.historyEnabled){this.history.append(id,message);this.history.prune(this.getConfig().settings.historyDays);}
    }
    this.emit(id, type, data);
  }
  notify(id, data) {
    const settings = this.getConfig().settings,
      w = this.getWindow();
    const ws = this.getConfig().workspace;
    const record = ws?.networks?.find((n) => n.id === id);
    const focused=!!w?.isFocused(),viewing=focused&&this.activeConversation?.id===id&&require('../irc').fold(this.activeConversation.target)===require('../irc').fold(data.target);
    if((settings.mutedUsers?.[id]||[]).some(n=>require('../irc').fold(n)===require('../irc').fold(data.nick||'')))return;
    const self=this.sessions.get(id)?.nick||'',plain=require('../formatting').plain(data.text||''),fold=require('../irc').fold;
    const mentioned=!!self&&fold(plain).split(/[^\p{L}\p{N}_{}|~\-]+/u).includes(fold(self))||(settings.highlightWords||[]).some(word=>fold(plain).includes(fold(word)));
    if((mentioned||data.notice)&&!data.own&&!data.historical){
      const entry={key:require('node:crypto').randomUUID(),network:id,target:data.notificationTarget||data.target,nick:data.nick||'Servidor',text:plain.slice(0,10000),kind:data.notice?'notice':'mention',time:data.time||new Date().toISOString(),read:false};
      this.notificationLog||=[];this.notificationLog.push(entry);if(this.notificationLog.length>500)this.notificationLog.shift();this.emit(id,'notification-entry',{entry});
    }
    if(!(data.notice?settings.noticePopup!==false:settings.notifications)||focused&&settings.notifyWhileFocused===false||viewing&&settings.notifyInCurrentRoom===false||record?.conversations?.some(c=>require('../irc').fold(c.name)===require('../irc').fold(data.target)&&c.muted))return;
    const nick=this.sessions.get(id)?.nick||'',words=require('../irc').fold(require('../formatting').plain(data.text)).split(/[^\p{L}\p{N}_{}|~\-]+/u),privateMessage=!/^[#&+!]/.test(data.target),mention=!!nick&&words.includes(require('../irc').fold(nick))||(settings.highlightWords||[]).some(word=>data.text.toLowerCase().includes(word.toLowerCase()));
    if(!data.notice&&(mention?settings.notifyMentions===false:privateMessage&&settings.notifyPrivates===false))return;
    const sound=mention?settings.mentionSound!==false:privateMessage?settings.privateSound!==false:settings.channelSound===true;
    if(sound)this.electron.shell.beep();
    if(mention||privateMessage)this.emit(id,'attention',{target:data.target,mention,flash:settings.flashOnMention});
    if(!privateMessage&&!mention&&!data.notice)return;
    this.badge++;
    this.electron.app.setBadgeCount(this.badge);
    if (process.platform === "win32")
      w?.setOverlayIcon(
        this.electron.nativeImage.createFromPath(
          path.join(__dirname, "../assets/tray.png"),
        ),
        this.badge + " mensajes nuevos",
      );
    if ((!focused||data.notice) && this.electron.Notification.isSupported()) {
      const n = new this.electron.Notification({
        title: `${data.nick} · ${data.target}`,
        body: settings.notificationPreview
          ? data.text.slice(0, 200)
          : "Nuevo mensaje",
        silent: true,
      });
      n.on("click", () => {
        w?.show();
        w?.focus();
        this.emit(id, "navigate", { target: data.notificationTarget||data.target });
      });
      n.show();
    }
    if (settings.flashOnMention) w?.flashFrame(true);
  }
  async send({ id, target, text }) {
    if(target==='*consultas*'&&!text.startsWith('/'))throw new Error('Usa /whois nick o /who nick en la conversación de consultas.');
    const ignore = /^\/(ignore|unignore) +([^\s,]+)$/i.exec(text);
    if (ignore) {
      const cfg = structuredClone(this.getConfig());
      cfg.settings.ignoredUsers ||= {};
      const list = new Set(cfg.settings.ignoredUsers[id] || []);
      if (ignore[1].toLowerCase() === "ignore")
        list.add(ignore[2].toLowerCase());
      else list.delete(ignore[2].toLowerCase());
      cfg.settings.ignoredUsers[id] = [...list];
      this.saveConfig(cfg);
      this.emit(id, "preferences", { settings: cfg.settings,patch:{ignoredUsers:cfg.settings.ignoredUsers} });
      this.emit(id, "server", { text: "Lista de ignorados actualizada." });
      return { ok: true };
    }
    const dns = /^\/dns +([a-z\d.:-]+)$/i.exec(text);
    if (dns) {
      if (this.sessions.sessions.get(id)?.profile.proxy)
        throw new Error(
          "La consulta DNS directa está desactivada al usar proxy.",
        );
      const records = await require("node:dns").promises.lookup(dns[1], {
        all: true,
      });
      this.emit(id, "server", {
        text: records.map((r) => r.address).join(", "),
      });
      return { ok: true };
    }
    const input = await this.scripts.event("INPUT", {
      network: id,
      buffer: target,
      chan: target,
      text,
    });
    if (input.halted) return { ok: true };
    text = input.text;
    const fields = { network: id, buffer: target, chan: target, text };
    const m = /^\/([^\s]+)\s*(.*)$/.exec(text);
    if (m) {
      const result = await this.scripts.alias(m[1], fields, m[2].split(/\s+/));
      if (result.handled) return { ok: true };
    }
    if(/^\/(away|back)(?:\s|$)/i.test(text)){const match=/^\/(away|back)\s*(.*)$/i.exec(text);this.autoAway?.setManual(id,match[1].toLowerCase()==="away"&&!!match[2]);}
    executeInput(this.sessions.get(id), target, text, (type, data) =>
      this.emit(id, type, data),
    );
    return { ok: true };
  }
  ctcp(id, nick, line) {
    if (
      typeof nick !== "string" ||
      /[\s\0\r\n]/.test(nick) ||
      /[\0\r\n\x01]/.test(line)
    )
      throw new Error("CTCP inválido.");
    const client = this.sessions.get(id);
    if (!client?.ready) throw new Error("La red no está conectada.");
    if (this.crypto.descriptor(id, nick))
      throw new Error(
        "No se enviará CTCP directo en una conversación cifrada.",
      );
    client.sendRaw(`PRIVMSG ${nick} :\x01${line}\x01`);
  }
  async pick(options) {
    const result = await this.electron.dialog.showOpenDialog(this.getWindow(), {
      properties: ["openFile"],
      ...options,
    });
    return result.canceled ? null : result.filePaths[0];
  }
  async destination(options) {
    const result = await this.electron.dialog.showSaveDialog(
      this.getWindow(),
      options,
    );
    return result.canceled ? null : result.filePath;
  }
  async confirm(message, detail = "") {
    const r = await this.electron.dialog.showMessageBox(this.getWindow(), {
      type: "question",
      message,
      detail,
      buttons: ["Cancelar", "Confirmar"],
      defaultId: 0,
      cancelId: 0,
    });
    return r.response === 1;
  }
  async dccCertificate(host) {
    let material = this.vault.get("dcc-certificate");
    if (!material) {
      const { generate } = require("selfsigned");
      const result = await generate([{ name: "commonName", value: host }], {
        keyType: "ec",
        curve: "P-256",
        algorithm: "sha256",
        extensions: [
          { name: "subjectAltName", altNames: [{ type: 7, ip: host }] },
        ],
      });
      material = { cert: result.cert, key: result.private };
      this.vault.set("dcc-certificate", material);
    }
    return material;
  }
  async scriptAction(action, fields) {
    const id = fields.network,
      target = fields.buffer;
    if (["media.pick", "media.upload"].includes(action.type)) {
      this.scriptMedia
        .run(action, fields)
        .catch((e) => this.scripts.report(fields.script, e.message));
      return;
    }
    if (action.type === "echo") {
      const [buffer, ...rest] = action.args;
      this.emit(id, "message", {
        target: buffer === "-s" ? "*" : buffer || target,
        text: rest.join(" "),
        event: true,
        nick: "script",
      });
      return;
    }
    if (action.type === "sidebar") {
      const [verb, key, command, ...label] = action.args || [];
      if (!key || key.length > 100)
        throw new Error("Lanzador de script inválido.");
      const id = fields.script + ":" + key;
      if (verb === "remove") this.launchers.delete(id);
      else if (verb === "add") {
        if (this.launchers.size >= 100)
          throw new Error("Demasiados lanzadores.");
        this.launchers.set(id, {
          id,
          script: fields.script,
          command,
          label: label.join(" ") || key,
        });
      } else throw new Error("Acción de lanzador inválida.");
      this.emit(null, "script-launchers", {
        launchers: [...this.launchers.values()],
      });
      return;
    }
    if(action.type === "tip"){const Notification=this.electron.Notification;if(Notification.isSupported()){const popup=new Notification({title:action.args?.[0]||"Script",body:(action.args||[]).slice(1).join(" ").slice(0,4000)});popup.show();}return;}
    if (["toast", "view", "view.close"].includes(action.type)) {
      this.emit(id, "script-ui", { ...action, fields, script: fields.script });
      return;
    }
    if (action.type === "raw") {
      this.sessions
        .get(id)
        ?.sendRaw(action.text || action.args?.join(" ") || "");
      return;
    }
    if (action.type === "state.set") {
      const [key, ...rest] = action.args;
      if (!key || key.length > 100 || ["__proto__","constructor","prototype"].includes(key))
        throw new Error("Clave de configuración inválida.");
      const state = this.vault.get("script-state:" + fields.script) || {};
      state[key] = rest.join(" ");
      if (JSON.stringify(state).length > 65536)
        throw new Error("Configuración de script demasiado grande.");
      this.vault.set("script-state:" + fields.script, state);
      await this.scripts.request({
        type: "state",
        script: fields.script,
        state,
      });
      return;
    }
    if (action.type === "state.delete") {
      const state = this.vault.get("script-state:" + fields.script) || {};
      delete state[action.args[0]];
      this.vault.set("script-state:" + fields.script, state);
      await this.scripts.request({
        type: "state",
        script: fields.script,
        state,
      });
      return;
    }
    if (action.type.startsWith("age."))
      throw new Error(
        "Esta acción AGE requiere control explícito desde Cifrado.",
      );
    if (["ignore", "unignore"].includes(action.type))
      return this.send({
        id,
        target,
        text: "/" + action.type + " " + action.text,
      });
    const args = action.args || [];
    executeInput(
      this.sessions.get(id),
      target,
      "/" + action.type + " " + (action.text ?? args.join(" ")),
      (type, data) => this.emit(id, type, data),
    );
  }
  resolvePhoto(id,nick,options={}){
    const client=this.sessions.get(id),p=this.getConfig().profiles.find(p=>p.id===id),own=require('../irc').fold(client?.nick||p?.nick||'')===require('../irc').fold(nick),state=client?.userStates?.get(require('../irc').fold(nick))||{};
    return{...require('./avatar-policy').resolveAvatar({state,nick,template:own&&p?.photoUrl||this.getConfig().settings.avatarUrlTemplate,...options}),client,version:state.avatarVersion||0};
  }
  async action(name, data = {}) {
    const id = data.network,
      client = this.sessions.get(id),
      target = data.target;
    switch (name) {
      case "theme.import": {const file=await this.pick({filters:[{name:'Tema HexDreams',extensions:['json']}]});if(!file)return {cancelled:true};if(fs.statSync(file).size>262144)throw Error('El tema supera 256 KB.');return {theme:require('../theme-files').parseTheme(fs.readFileSync(file,'utf8'))};}
      case "theme.export": {const text=require('../theme-files').serializeTheme(data.name||'Mi tema',data.settings||this.getConfig().settings);const file=await this.destination({defaultPath:'HexDreams-tema.json',filters:[{name:'Tema HexDreams',extensions:['json']}]});if(file)fs.writeFileSync(file,text,'utf8');return {ok:!!file};}

      case 'logs.text.list':this.textLogs.configure(this.getConfig().settings);this.textLogs.prune();return this.textLogs.describe(this.getConfig().profiles);
      case 'logs.text.read':return this.textLogs.read(data.id,data.offset);
      case 'logs.text.search':return this.textLogs.search(data.text,data.id);
      case 'logs.text.folder':{const directory=await this.pick({properties:['openDirectory','createDirectory']});if(!directory)return{cancelled:true};this.textLogs.directory=directory;fs.writeFileSync(path.join(this.directory,'text-log-folder.json'),JSON.stringify({directory}));return{directory};}
      case 'logs.text.status':return{directory:this.textLogs.directory,enabled:this.getConfig().settings.textLogsEnabled!==false};
      case 'logs.text.open':{const error=await this.electron.shell.openPath(this.textLogs.open());if(error)throw new Error(error);return{ok:true};}
      case 'notifications.list':return this.notificationLog||[];
      case 'notifications.read':{const keys=new Set(Array.isArray(data.keys)?data.keys:[]);for(const item of this.notificationLog||[])if(keys.has(item.key))item.read=true;return{ok:true};}
      case 'notifications.clear':this.notificationLog=[];return{ok:true};
      case 'identity.publish':{const p=this.getConfig().profiles.find(p=>p.id===id);if(!p)throw new Error('Guarda la red antes de publicar.');const session=this.sessions.sessions.get(id);if(session){session.profile.publishPhoto=p.publishPhoto;session.profile.photoUrl=p.photoUrl;}if(!client?.ready)return{pending:true};client.profile.publishPhoto=p.publishPhoto;client.ownAvatarTemplate=p.photoUrl||this.getConfig().settings.avatarUrlTemplate||'https://chat-avatars.chateagratis.net/avatar/Chat/{Nick}.png';return client.publishOwnAvatar(true);}
      case 'presence.sync':{const p=this.getConfig().profiles.find(p=>p.id===id);if(!p)throw new Error('Red no válida.');const session=this.sessions.sessions.get(id);if(session)session.profile.notifyNicks=[...p.notifyNicks];if(client){client.profile.notifyNicks=[...p.notifyNicks];client.presence.names=[...p.notifyNicks];if(client.ready)client.presence.start();}return{ok:true};}
      case 'presence.privates':if(client?.ready)client.presence.watchPrivates(data.nicks);return{ok:true};
      case 'presence.status':return client?.ready?client.presence.snapshot():(this.getConfig().profiles.find(p=>p.id===id)?.notifyNicks||[]).map(nick=>({nick,online:null}));

      case 'tls.accept':{
        const cert=this.pendingCertificates.get(id),p=this.getConfig().profiles.find(p=>p.id===id);
        if(!cert||!p||cert.fingerprint!==data.fingerprint||cert.host!==p.host||cert.port!==p.port||!p.tls)throw new Error('La solicitud de certificado ya no corresponde a esta red.');
        this.trustedCertificates[id]={host:cert.host,port:cert.port,fingerprint:cert.fingerprint,pem:cert.pem};
        fs.writeFileSync(path.join(this.directory,'server-certificates.json'),JSON.stringify(this.trustedCertificates),{mode:0o600});this.pendingCertificates.delete(id);this.sessions.disconnect(id);this.connect({id});return{ok:true};}
      case 'user.whois':
        if(!client?.ready)throw new Error('Conecta esta red.');require('../irc').token(data.nick,'Apodo');client.request('WHOIS '+data.nick+' '+data.nick,'*consultas*');return{ok:true};
      case 'rooms.list':
        if(!client?.ready)throw new Error('Conecta esta red.');client.sendRaw('LIST');return{ok:true};
      case 'photo.load':{
        require('../irc').token(data.nick,'Apodo');
        const resolved=this.resolvePhoto(id,data.nick,{explicit:data.url,refresh:true});if(!resolved.url)throw new Error('Este usuario no anuncia una foto válida.');
        const endpoint=new URL(resolved.url);
        if(!data.url&&this.resolvePhoto(id,data.nick,{automatic:true}).blocked&&!(await this.confirm('¿Cargar la foto de '+endpoint.hostname+'?','El servidor web recibirá tu dirección IP.')))return{cancelled:true};
        const r=await this.web.request(endpoint.toString(),{domains:[endpoint.hostname],maxBytes:5242880});if(r.status!==200)throw new Error('Foto no encontrada (HTTP '+r.status+').');const mime=imageMime(r.body);if(!mime)throw new Error('La dirección no devolvió una imagen.');
        const picture=this.electron.nativeImage.createFromBuffer(r.body);if(picture.isEmpty()||picture.getSize().width*picture.getSize().height>32000000)throw new Error('Imagen no válida o demasiado grande.');
        const cacheId=require('node:crypto').randomUUID();if(this.mediaCache.size>=10)this.mediaCache.delete(this.mediaCache.keys().next().value);this.mediaCache.set(cacheId,{bytes:r.body,mime});return{cacheId,image:'data:'+mime+';base64,'+r.body.toString('base64')};}

      case "bouncer.list":
        if (!client?.capabilities.has("soju.im/bouncer-networks"))
          throw new Error("El servidor no admite gestionar redes soju.");
        client.sendRaw("BOUNCER LISTNETWORKS");
        return { ok: true };
      case "network.commands.get":
        return {
          commands: [
            ...(this.getConfig().profiles.find((p) => p.id === id)?.commands ||
              []),
            ...(this.credentials(id).commands || []),
          ],
        };
      case "network.commands.save": {
        if (
          typeof id !== "string" ||
          !/^[a-z\d_-]{1,80}$/i.test(id) ||
          !Array.isArray(data.commands) ||
          data.commands.length > 50 ||
          data.commands.some(
            (c) =>
              typeof c !== "string" ||
              /[\0\r\n]/.test(c) ||
              Buffer.byteLength(c) > 500,
          )
        )
          throw new Error("Comandos de conexión no válidos.");
        const protectedCommands =
          this.vault.available() ||
          data.commands.some((c) =>
            /\b(?:PASS|AUTHENTICATE|OPER|IDENTIFY|LOGIN)\b/i.test(c),
          );
        const secrets = {
          ...this.credentials(id),
          commands: protectedCommands ? data.commands : [],
        };
        if (protectedCommands || this.vault.available())
          this.vault.set("network:" + id, secrets);
        this.memory.set(id, secrets);
        return {
          ok: true,
          publicCommands: protectedCommands ? [] : data.commands,
        };
      }
      case "identity.photo": {
        const file = await this.pick({
          title: "Foto de identidad de esta red",
          filters: [
            {
              name: "Fotos",
              extensions: ["png", "jpg", "jpeg", "webp", "gif"],
            },
          ],
        });
        if (!file) return { cancelled: true };
        if (fs.statSync(file).size > 5242880)
          throw new Error("La foto debe ocupar menos de 5 MB.");
        const bytes = fs.readFileSync(file);
        if (!imageMime(bytes))
          throw new Error("Formato de imagen no compatible.");
        const image = this.electron.nativeImage.createFromBuffer(bytes);
        if (image.isEmpty()) throw new Error("No se pudo decodificar la foto.");
        const size = image.getSize();
        if (size.width * size.height > 32000000)
          throw new Error("La foto tiene demasiados píxeles.");
        return {
          image: image
            .resize({ width: Math.max(1,Math.round(size.width*Math.min(128/size.width,128/size.height))), height: Math.max(1,Math.round(size.height*Math.min(128/size.width,128/size.height))), quality: "good" })
            .toDataURL(),
        };
      }
      case "network.connect":
        return this.connect({
          id,
          credentials: data.credentials,
          remember: data.remember,
        });
      case "status":
        return {
          secureStorage: this.vault.available(),
          scripts: this.scripts.list(),
          scriptRunning: !!this.scripts.worker,
          aliases:this.scripts.worker?(this.scripts.aliasNames||[]):[],
          launchers: [...this.launchers.values()].filter((l) =>
            this.scripts.scripts.some((s) => s.id === l.script && s.enabled),
          ),
          transfers: this.dcc.list(),
          crypto: this.crypto.targets,
          debug: this.scripts.debug,
        };
      case "protocol.read":
        return this.protocolLog.read();
      case "history.folder": {
        const r = await this.electron.dialog.showOpenDialog(this.getWindow(), {
          properties: ["openDirectory", "createDirectory"],
        });
        if (r.canceled) return { cancelled: true };
        this.history.close();
        this.history = new HistoryStore(r.filePaths[0]);
        fs.writeFileSync(
          path.join(this.directory, "history-folder.json"),
          JSON.stringify({ directory: r.filePaths[0] }),
        );
        return { ok: true };
      }
      case "history.search":
        return this.history.query(data,600);
      case "history.clear":
        if (await this.confirm("¿Eliminar todo el historial local?"))
          this.history.clear();
        return { ok: true };
      case "history.export": {
        const rows = this.history.query({ ...data, limit: 100001 }, 100001);
        if (
          rows.length > 100000 ||
          rows.reduce((n, m) => n + Buffer.byteLength(m.text), 0) > 52428800
        )
          throw new Error(
            "La exportación supera 100.000 mensajes o 50 MB. Filtra por red, conversación o texto.",
          );
        const file = await this.destination({
          defaultPath: data.zip ? "historial.zip" : "historial.txt",
          filters: [
            {
              name: data.zip ? "ZIP" : "Texto",
              extensions: [data.zip ? "zip" : "txt"],
            },
          ],
        });
        if (file) {
          if (data.zip) {
            const groups = {};
            for (const m of rows) {
              const name =
                (m.network + "_" + m.target).replace(/[^a-zA-Z0-9_#-]/g, "_") +
                ".txt";
              groups[name] =
                (groups[name] || "") + `[${m.time}] <${m.nick}> ${m.text}\r\n`;
            }
            const { zipSync, strToU8 } = require("fflate");
            fs.writeFileSync(
              file,
              zipSync(
                Object.fromEntries(
                  Object.entries(groups).map(([k, v]) => [k, strToU8(v)]),
                ),
              ),
            );
          } else
            fs.writeFileSync(
              file,
              rows
                .map((m) => `[${m.time}] ${m.target} <${m.nick}> ${m.text}`)
                .join("\r\n"),
              "utf8",
            );
        }
        return { ok: !!file };
      }
      case "history.server":
        client.requestHistory(target, data.limit, data.before);
        return { ok: true };
      case "typing":
        if(this.getConfig().settings.sendTyping!==false || data.state==="done")client?.sendTyping(target, data.state);
        return { ok: true };
      case "reply":
        client.sendMessage(target, data.text, false, {
          replyTo: data.messageId,
        });
        return { ok: true };
      case "reaction":
        client.react(target, data.messageId, data.emoji);
        return { ok: true };
      case "redact":
        client.redact(target, data.messageId);
        return { ok: true };
      case "read":
        this.activeConversation={id,target};
        client.markRead(target);
        return { ok: true };
      case "crypto.export": {
        if (
          !(await this.confirm(
            "¿Copiar la clave de " + target + "?",
            "El portapapeles podrá ser leído por otras aplicaciones. Comparte la clave por un medio seguro.",
          ))
        )
          return { cancelled: true };
        const key = this.vault.get("key:" + id + "\0" + target.toLowerCase());
        if (!key)
          throw new Error("No hay una clave compartida para este destino.");
        this.electron.clipboard.writeText(key);
        return { ok: true };
      }
      case "crypto.verify": {
        const age = this.cryptoAdapters.get(id).age(),
          pin = age.state.pins[data.fingerprint];
        if (!pin) throw new Error("Identidad no encontrada.");
        if (
          await this.confirm(
            "¿Has verificado esta huella por otro medio?",
            data.fingerprint,
          )
        ) {
          pin.verified = true;
          age.save();
        }
        return { ok: true };
      }
      case "crypto.status":
        return this.crypto.status(id, target);
      case "crypto.configure": {
        if (
          !(await this.confirm(
            "¿Cambiar el cifrado de " + target + "?",
            data.scheme === "none"
              ? "Los próximos mensajes se enviarán sin cifrar."
              : "Comparte las claves por un canal seguro y verifica las huellas.",
          ))
        )
          return { cancelled: true };
        const result = this.crypto.configure(id, target, data.scheme, data.key);
        if (data.scheme === "AGE" && client?.ready)
          this.cryptoAdapters.get(id).age().enable(target);
        return result;
      }
      case "crypto.confirm":
        if (
          await this.confirm(
            "¿Aceptar la nueva identidad de " + data.nick + "?",
            data.fingerprint,
          )
        )
          this.cryptoAdapters
            .get(id)
            .age()
            .confirm(data.nick, data.fingerprint);
        return { ok: true };
      case "script.reload":await this.scripts.restart();return{ok:true};
      case 'script.list':return this.scripts.list();
      case 'script.help':return this.scripts.help(data.id);
      case 'script.commands':return this.scripts.completions();
      case 'script.read':return this.scripts.read(data.id);
      case 'script.validate':{if(typeof data.source!=='string'||Buffer.byteLength(data.source)>262144)throw Error('El script supera 256 KB.');new (require('../scripts/interpreter').HexVM)().install([{id:'validation',name:'validation',source:data.source,enabled:false,permissions:[],domains:[]}]);return{ok:true};}
      case 'script.save':{
        if(typeof data.name!=='string'||!data.name.trim()||data.name.length>100)throw Error('Nombre de script no válido.');
        if(data.id)return this.scripts.update(data.id,{...data,name:data.name.trim()});
        const id=this.scripts.install(data.name.trim(),data.source);return this.scripts.read(id);
      }
      case 'script.openFile':{const file=await this.pick({filters:[{name:'Scripts .hex',extensions:['hex']}]});if(!file)return{cancelled:true};if(fs.statSync(file).size>262144)throw Error('El script supera 256 KB.');return{name:path.basename(file),source:fs.readFileSync(file,'utf8')};}
      case 'script.exportSource':{if(typeof data.source!=='string'||Buffer.byteLength(data.source)>262144)throw Error('El script supera 256 KB.');const file=await this.destination({defaultPath:path.basename(String(data.name||'script.hex')),filters:[{name:'Scripts .hex',extensions:['hex']}]});if(file)fs.writeFileSync(file,data.source,{encoding:'utf8',mode:0o600});return{ok:!!file};}
      case "script.import": {
        const file = await this.pick({
          filters: [{ name: "Hex scripts", extensions: ["hex"] }],
        });
        if (!file) return { cancelled: true };
        if (fs.statSync(file).size > 262144)
          throw new Error("El script supera 256 KB.");
        return {
          id: this.scripts.install(
            path.basename(file),
            fs.readFileSync(file, "utf8"),
          ),
        };
      }
      case "script.configure":
        this.scriptMedia.clear();
        await this.scripts.configure(data.id, data);
        return { ok: true };
      case "script.remove":
        this.scriptMedia.clear();
        await this.scripts.remove(data.id);
        return { ok: true };
      case "script.launcher": {
        const launcher = this.launchers.get(data.id);
        if (!launcher) throw new Error("Lanzador no disponible.");
        this.scripts.allowed(launcher.script, "ui");
        if (launcher.command.startsWith("SIGNAL:"))
          await this.scripts.event(
            launcher.command,
            {
              network: id,
              buffer: target,
              __onlyScript: launcher.script,
              __scriptCallers: [launcher.script],
            },
            [],
          );
        else
          await this.scripts.alias(
            launcher.command,
            { network: id, buffer: target, __scriptCallers: [launcher.script] },
            [],
          );
        return { ok: true };
      }
      case "script.signal": {
        this.scripts.allowed(data.script, "ui");
        const form=Object.create(null);
        if(data.form&&typeof data.form==="object"){if(Buffer.byteLength(JSON.stringify(data.form))>65536||Object.keys(data.form).length>200)throw Error("Formulario demasiado grande.");for(const [k,v]of Object.entries(data.form).slice(0,200))if(/^[a-zA-Z0-9_.-]{1,80}$/.test(k)&&["string","boolean","number"].includes(typeof v))form[k]=v;}
        const fields = {
          network: id, form, window:data.windowId||"default", selected:data.selected||"", control:data.control||"", interaction:data.interaction||"click",
          buffer: target,
          __onlyScript: data.script,
          __scriptCallers: [data.script],
        };
        const alias = await this.scripts.alias(
          String(data.signal),
          fields,
          data.args || [],
        );
        if (!alias.handled)
          await this.scripts.event(
            "SIGNAL:" + String(data.signal).toUpperCase(),
            fields,
            data.args || [],
          );
        return { ok: true };
      }
      case "dcc.folder": {
        const r = await this.electron.dialog.showOpenDialog(this.getWindow(), {
          properties: ["openDirectory", "createDirectory"],
        });
        if (r.canceled) return { cancelled: true };
        this.downloadsDirectory = r.filePaths[0];
        fs.writeFileSync(
          path.join(this.directory, "downloads-folder.json"),
          JSON.stringify({ directory: this.downloadsDirectory }),
        );
        return { ok: true };
      }
      case "dcc.cancel":
        this.dcc.cancel(data.id);
        return { ok: true };
      case "dcc.reject":
        this.dcc.cancel(data.id, true);
        return { ok: true };
      case "dcc.accept": {
        const t = this.dcc.transfers.get(data.id);
        if (!t) throw new Error("Oferta no encontrada.");
        if (t.chat) {
          if (
            !(await this.confirm(
              "¿Aceptar DCC CHAT de " + t.nick + "?",
              `Conexión directa a ${t.host}:${t.port}`,
            ))
          )
            return { cancelled: true };
          return this.dcc.accept(data.id);
        }
        const file = await this.destination({ defaultPath: t.name });
        if (!file) return { cancelled: true };
        return this.dcc.accept(data.id, {
          destination: file,
          resume: data.resume === true,
        });
      }
      case "dcc.send": {
        const file = await this.pick({
          title: "Seleccionar archivo para enviar a " + target,
        });
        return file
          ? this.dcc.sendFile(id, target, file, {
              secure: data.secure === true,
              passive: data.passive === true,
            })
          : { cancelled: true };
      }
      case "dcc.chat":
        return this.dcc.startChat(id, target, { secure: data.secure === true });
      case "dcc.message":
        this.dcc.sendChat(data.id, data.text);
        return { ok: true };
      case "dcc.trust": {
        const file = await this.pick({
          filters: [
            { name: "Certificado público", extensions: ["pem", "crt"] },
          ],
        });
        if (file) {
          const cert = fs.readFileSync(file, "utf8");
          new (require("node:crypto").X509Certificate)(cert);
          this.vault.set("dcc-trust:" + id + ":" + target.toLowerCase(), cert);
        }
        return { ok: !!file };
      }
      case "dcc.certificate": {
        const cert = (
          await this.dccCertificate(
            this.getConfig().settings.dccAddress || "127.0.0.1",
          )
        ).cert;
        const file = await this.destination({
          defaultPath: "hexdroid-dcc.crt",
        });
        if (file) fs.writeFileSync(file, cert);
        return { ok: !!file };
      }
      case "tls.import": {
        const file = await this.pick({
          filters: [
            { name: "Certificado", extensions: ["pfx", "p12", "pem", "crt"] },
          ],
        });
        if (!file) return { cancelled: true };
        if (fs.statSync(file).size > 1048576)
          throw new Error("Certificado demasiado grande.");
        const secrets = this.credentials(id);
        if (/\.(pfx|p12)$/i.test(file))
          secrets.clientCertificate = {
            pfx: fs.readFileSync(file).toString("base64"),
            passphrase: data.passphrase || "",
          };
        else secrets.ca = fs.readFileSync(file, "utf8");
        this.vault.set("network:" + id, secrets);
        this.memory.set(id, secrets);
        return { ok: true };
      }
      case "secrets.forget":
        this.vault.set("network:" + id, undefined);
        this.memory.delete(id);
        return { ok: true };
      case "backup.export": {
        const selected=require('./config-selection').exportConfig(this.getConfig(),data.sections);
        if(data.includeHistory&&!selected.sections.includes('networks'))throw Error('Incluye redes para exportar el historial asociado.');
        if(data.includeSecrets&&!selected.sections.includes('networks'))throw Error('Incluye redes para exportar sus credenciales.');
        const secrets = data.includeSecrets
          ? {
              vault: this.vault.exportValues(),
              encryption: this.crypto.targets,
              scripts: this.scripts.scripts,
            }
          : null;
        const contents = await createBackup(
          selected.config,
          secrets,
          data.password,
          data.includeHistory ? this.history.query({limit:100001},100001).filter(m=>selected.config.profiles.some(p=>p.id===m.network)) : undefined,
          selected.sections,
        );
        const file = await this.destination({
          defaultPath: "HexDreams-backup.json",
        });
        if (file) fs.writeFileSync(file, contents, { mode: 0o600 });
        return { ok: !!file };
      }
      case "backup.import": {
        const file = await this.pick({
          filters: [{ name: "Respaldo HexDreams IRC", extensions: ["json"] }],
        });
        if (!file) return { cancelled: true };
        if (fs.statSync(file).size > 67108864)
          throw new Error("Respaldo demasiado grande.");
        const backup = await readBackup(
          fs.readFileSync(file, "utf8"),
          data.password,
        );
        const selectedSections=require('./config-selection').selection(data.sections);
        backup.config=require('./config-selection').importConfig(this.getConfig(),backup.config,selectedSections,backup.sections);
        if(!selectedSections.includes('networks'))delete backup.secrets;
        if(!data.includeHistory)delete backup.history;
        if (backup.secrets) {
          if (
            !backup.secrets ||
            typeof backup.secrets !== "object" ||
            Array.isArray(backup.secrets)
          )
            throw new Error("Secretos de respaldo inválidos.");
          if (backup.secrets.encryption)
            backup.secrets.encryption = validateTargets(
              backup.secrets.encryption,
            );
          if (backup.secrets.scripts) {
            if (
              !Array.isArray(backup.secrets.scripts) ||
              backup.secrets.scripts.length > 50
            )
              throw new Error("Scripts de respaldo inválidos.");
            for (const script of backup.secrets.scripts) {
              script.enabled = false;
              script.permissions = [...require("../scripts/manager").PERMISSIONS];
              script.domains = [];
              this.scripts.validate(script);
            }
          }
          if (!this.vault.available())
            throw new Error(
              "El almacén seguro es necesario para restaurar claves y credenciales.",
            );
        }
        if (
          !(await this.confirm(
            "¿Restaurar el respaldo?",
            `Se restaurarán: ${selectedSections.join(', ')}. Las redes con el mismo identificador se actualizarán; las demás se conservan${backup.history ? '. Incluye historial ('+backup.history.length+' registros)' : ''}. Las conexiones se cerrarán.`,
          ))
        )
          return { cancelled: true };
        this.sessions.close();
        if (backup.secrets) {
          for (const [k, v] of Object.entries(
            backup.secrets.vault || backup.secrets,
          ))
            this.vault.set(k, v);
          if (Array.isArray(backup.secrets.encryption)) {
            this.crypto.targets = backup.secrets.encryption;
            this.crypto.write();
          }
          if (Array.isArray(backup.secrets.scripts)) {
            for (const s of backup.secrets.scripts) {
              s.enabled = false;
              s.permissions = [...require("../scripts/manager").PERMISSIONS];
              s.domains = [];
              this.scripts.validate(s);
            }
            this.scripts.scripts = backup.secrets.scripts;
            this.scripts.save();
            await this.scripts.restart();
          }
        }
        if(backup.history){this.history.open();this.history.db.exec('BEGIN IMMEDIATE');try{this.history.db.exec('DELETE FROM messages');for(const m of backup.history)this.history.append(m.network,m);this.history.db.exec('COMMIT');}catch(e){this.history.db.exec('ROLLBACK');throw e;}}
        this.saveConfig(backup.config);
        return { ok: true, reload: true };
      }
      case "filehost.upload": {
        if (!client?.filehost || !client.profile.tls)
          throw new Error(
            "La red no anuncia un filehost utilizable mediante TLS.",
          );
        const endpoint = new URL(client.filehost);
        if (
          endpoint.protocol !== "https:" ||
          endpoint.username ||
          endpoint.password
        )
          throw new Error("Filehost HTTPS no válido.");
        const file = await this.pick({
          title: "Archivo para compartir mediante " + endpoint.hostname,
        });
        if (!file) return { cancelled: true };
        const stat = fs.statSync(file);
        if (!stat.isFile() || stat.size > 67108864)
          throw new Error("El archivo debe tener hasta 64 MB.");
        const secrets = this.credentials(id),
          password =
            client.profile.sasl === "PLAIN"
              ? secrets.saslPassword
              : secrets.serverPassword,
          user = client.profile.saslUsername || client.nick;
        const authenticated =
          endpoint.hostname.toLowerCase() ===
            client.profile.host.toLowerCase() &&
          password &&
          !user.includes(":");
        if (
          !(await this.confirm(
            "¿Subir " + path.basename(file) + "?",
            `Destino: ${endpoint.origin}\n${authenticated ? "Se autenticará con las credenciales de esta red." : "No se enviarán las credenciales IRC a este destino."}\nEl archivo puede contener metadatos personales.`,
          ))
        )
          return { cancelled: true };
        const headers = {
          "Content-Type": "application/octet-stream",
          "Content-Disposition":
            'attachment; filename="' +
            path
              .basename(file)
              .replace(/["\r\n\0]/g, "_")
              .replace(/[^\x20-\x7e]/g, "_") +
            '"',
          ...(authenticated
            ? {
                Authorization:
                  "Basic " +
                  Buffer.from(user + ":" + password).toString("base64"),
              }
            : {}),
        };
        const r = await this.web.request(endpoint.toString(), {
          domains: [endpoint.hostname],
          method: "POST",
          headers,
          body: fs.createReadStream(file),
          contentLength: stat.size,
          redirects: 0,
        });
        if (r.status !== 201 || !r.headers.location)
          throw new Error(
            "El filehost no confirmó la subida (HTTP " + r.status + ").",
          );
        const url = new URL(r.headers.location, endpoint);
        if (
          !["https:", "http:"].includes(url.protocol) ||
          url.username ||
          url.password
        )
          throw new Error("El filehost devolvió un enlace no permitido.");
        return { url: url.toString() };
      }
      case "network.icon": {
        if (!client?.networkIcon)
          throw new Error("La red no anuncia un icono.");
        return this.action("media.preview", {
          url: client.networkIcon.replace(/\{size\}/g, "64"),
        });
      }
      case 'avatars.sync':{
        this.avatarCache.clear();const s=this.getConfig().settings;
        for(const session of this.sessions.sessions.values()){const c=session.client;if(!c)continue;c.avatarDiscovery=s.mediaEnabled!==false&&s.autoAvatars===true&&(s.showAvatars!==false||s.showMessageAvatars!==false);if(!c.ready||!c.avatarDiscovery)continue;c.avatarSubscribed=false;c.syncAvatars();for(const channel of c.joined.values())c.sendRaw('WHO '+channel+(c.whox?' %tcuhnfar,152':''));}return{ok:true};}
      case 'avatar.load':{
        require('../irc').token(data.nick,'Apodo');
        const settings=this.getConfig().settings;if(settings.mediaEnabled===false||(settings.showAvatars===false&&settings.showMessageAvatars===false)||!settings.autoAvatars)return{disabled:true};
        const now=Date.now(),resolved=this.resolvePhoto(id,data.nick,{automatic:true,now});if(!resolved.url)return{empty:true,blocked:resolved.blocked};
        const key=id+'|'+resolved.version+'|'+resolved.url,saved=this.avatarCache.get(key);if(saved&&now-saved.time<60000)return{image:saved.image};
        const response=await this.web.request(resolved.url,{domains:[new URL(resolved.url).hostname],maxBytes:2097152});if(response.status!==200)throw new Error('Foto no encontrada (HTTP '+response.status+').');if(!imageMime(response.body))throw new Error('La URL de foto no devolvió una imagen compatible.');
        const current=this.resolvePhoto(id,data.nick,{automatic:true,now});if(current.client!==resolved.client||current.version!==resolved.version||current.url!==resolved.url)return{stale:true};
        const picture=this.electron.nativeImage.createFromBuffer(response.body);if(picture.isEmpty())throw new Error('No se pudo decodificar la foto.');const size=picture.getSize();if(size.width*size.height>32000000)throw new Error('Foto demasiado grande.');const image=picture.resize({width:Math.max(1,Math.round(size.width*Math.min(96/size.width,96/size.height))),height:Math.max(1,Math.round(size.height*Math.min(96/size.width,96/size.height))),quality:'good'}).toDataURL();if(this.avatarCache.size>=64)this.avatarCache.delete(this.avatarCache.keys().next().value);this.avatarCache.set(key,{image,time:now});return{image};}
      case "avatar.preview":return this.action('photo.load',{network:id,nick:data.nick});
      case "media.preview": {
        const u = new URL(data.url);
        if (
          !(await this.confirm(
            "¿Cargar contenido de " + u.hostname + "?",
            "El servidor web verá tu dirección IP.",
          ))
        )
          return { cancelled: true };
        const r = await this.web.request(u.toString(), {
          domains: [u.hostname],
          maxBytes: 5242880,
        });
        if (r.status !== 200) throw new Error("Respuesta HTTP " + r.status);
        const mime = imageMime(r.body);
        let cacheId;
        if (mime) {
          cacheId = require("node:crypto").randomUUID();
          if (this.mediaCache.size >= 10)
            this.mediaCache.delete(this.mediaCache.keys().next().value);
          this.mediaCache.set(cacheId, { bytes: r.body, mime });
        }
        return mime
          ? {
              cacheId,
              image: `data:${mime};base64,${r.body.toString("base64")}`,
            }
          : { title: titleOf(r.body.toString("utf8")) };
      }
      case "media.save": {
        const image = this.mediaCache.get(data.cacheId);
        if (!image)
          throw new Error("La vista previa caducó. Vuelve a cargarla.");
        const file = await this.destination({
          defaultPath: "imagen." + image.mime.split("/")[1],
        });
        if (file) fs.writeFileSync(file, image.bytes);
        return { ok: !!file };
      }
      case "link.open": {
        const u = new URL(data.url);
        if (
          !["https:", "http:"].includes(u.protocol) ||
          u.username ||
          u.password
        )
          throw new Error("Enlace no permitido.");
        await this.electron.shell.openExternal(u.toString());
        return { ok: true };
      }
      default:
        throw new Error("Acción no reconocida.");
    }
  }
  close() {
    if(this.closed)return;this.closed=true;
    clearInterval(this.awayTimer);
    this.sessions.close();
    this.scripts.close();
    this.dcc.close();
    this.history.close();
  }
}
module.exports = { Runtime };
