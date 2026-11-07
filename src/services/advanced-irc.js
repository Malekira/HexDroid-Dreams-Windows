"use strict";
const net = require("node:net"),
  tls = require("node:tls"),
  crypto = require("node:crypto"),
  iconv = require("iconv-lite");
const { SocksClient } = require("socks");
const { ScramSha256, base64 } = require("./sasl");
const { redactProtocol } = require("./protocol-log");
const SUPPORTED = [
  "server-time",
  "message-tags",
  "echo-message",
  "batch",
  "labeled-response",
  "away-notify",
  "account-notify",
  "extended-join",
  "multi-prefix",
  "userhost-in-names",
  "chghost",
  "setname",
  "standard-replies",
  "draft/chathistory",
  "chathistory",
  "draft/multiline",
  "draft/read-marker",
  "draft/message-redaction",
  "draft/metadata-2",
  "soju.im/bouncer-networks",
  "soju.im/bouncer-networks-notify",
];
const escapeTag = (s) =>
  String(s)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\:")
    .replace(/ /g, "\\s")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
module.exports = (Base, { parseLine, fold, token, cleanText }) =>
  class AdvancedIrcClient extends Base {
    constructor(profile, secrets = {}) {
      super(
        profile,
        typeof secrets === "string" ? secrets : secrets.serverPassword || "",
      );
      this.secrets =
        typeof secrets === "string" ? { serverPassword: secrets } : secrets;
      this.capabilities = new Set();
      this.advertised = new Map();
      this.batches = new Map();
      this.pendingEcho = new Map();
      this.clones=new (require("./clones").CloneTracker)(this);
      this.labels = new Map();
      this.joined = new Map();
      this.byteBuffer = Buffer.alloc(0);
      this.nickAttempts = 0;
      this.userStates = new Map();
      this.userModes=new Set();
      this.presence=new (require("./presence").Presence)(this,this.profile.notifyNicks);this.ownAvatarTemplate=profile.ownAvatarTemplate||this.profile.photoUrl;
      this.pendingWhois = new Map();this.avatarDiscovery=profile.avatarDiscovery!==false;this.avatarSequence=0;
    }
    updateAvatar(nick,patch){
      nick=nick==='*'?this.nick:String(nick||'').split('!')[0];if(!nick||/^[#&+!]/.test(nick))return;
      const old=this.userStates.get(fold(nick))||{},next={...old,...patch,avatarVersion:++this.avatarSequence};
      if(patch.metadata)next.metadata={...old.metadata,...patch.metadata};
      this.userStates.set(fold(nick),next);this.emit('user-state',{nick,...next,avatarVersion:next.avatarVersion,key:patch.metadata?'avatar':undefined,value:patch.metadata?.avatar});
    }
    learnPhoto(nick,realName){const photo=require('./avatar-policy').legacyPhoto(realName);this.updateAvatar(nick,{legacyPhoto:photo});}
    publishOwnAvatar(force=false){
      if(!this.ready)return{pending:true};if(this.profile.publishPhoto&&!this.ownAvatarTemplate)return{missing:true};if(!this.capabilities.has('draft/metadata-2'))return{unsupported:true};
      const url=this.profile.publishPhoto?require('./avatar-policy').resolveAvatar({nick:this.nick,explicit:this.ownAvatarTemplate,refresh:true}).url||'':'';
      const base=url?new URL(url):null;if(base&&base.hostname==='chat-avatars.chateagratis.net')base.searchParams.delete('v');const key=base?.toString()||'';
      if(!force&&this.lastPublishedAvatar===key)return{unchanged:true};
      const line='METADATA * SET avatar'+(url?' :'+url:'');if(Buffer.byteLength(line)>510)throw new Error('La dirección de foto es demasiado larga para publicarla por IRC.');
      this.sendRaw(line);this.lastPublishedAvatar=key;this.emit('avatar-publish',{state:'sent',url});return{ok:true,url};
    }
    syncAvatars(){if(!this.capabilities.has('draft/metadata-2'))this.avatarSubscribed=false;if(!this.ready||!this.capabilities.has('draft/metadata-2'))return;try{this.publishOwnAvatar();}catch(e){this.emit('problem',e.message);}if(!this.avatarDiscovery||this.avatarSubscribed)return;this.avatarSubscribed=true;this.sendRaw('METADATA * SUB avatar');this.sendRaw('METADATA * GET avatar');for(const channel of this.joined.values())this.sendRaw('METADATA '+channel+' SYNC');}

    connect() {
      if (this.socket && !this.socket.destroyed)
        throw new Error("La red ya está conectada.");
      this.lastPublishedAvatar=undefined;this.closed = false;this.avatarSubscribed=false;this.userStates.clear();
      this.open().catch((e) => this.fail(e.message));
    }
    async open() {
      const p = this.profile;
      if (p.sasl !== "none" && !p.tls)
        throw new Error("SASL requiere una conexión TLS verificada.");
      this.emit("status", { state: "connecting", text: "Conectando…" });
      let tunnel;
      if (p.proxy) {
        const result = await SocksClient.createConnection({
          proxy: {
            ...p.proxy,
            userId: this.secrets.proxyUser || undefined,
            password: this.secrets.proxyPassword || undefined,
          },
          command: "connect",
          destination: { host: p.host, port: p.port },
          timeout: 20000,
        });
        tunnel = result.socket;
        if (this.closed) {
          tunnel.destroy();
          return;
        }
      }
      const connected = () => {
        if (this.closed) return this.socket.destroy();
        this.socket.setTimeout(0);
        this.sendRaw("CAP LS 302");
        this.capTimer = setTimeout(
          () => {
            if (p.sasl !== "none") this.fail("El servidor no negoció SASL.");
            else this.registerIdentity();
          },
          p.sasl === "none" ? 1000 : 15000,
        );
        this.capTimer.unref();
      };
      this.tlsAccepted=false;
      const pin = this.secrets.tlsPin && (!this.secrets.tlsPin.host || this.secrets.tlsPin.host===p.host&&this.secrets.tlsPin.port===p.port) ? this.secrets.tlsPin : null,
        material = this.secrets.clientCertificate || {};
      const options = {
        host: p.host,
        port: p.port,
        servername: net.isIP(p.host) ? undefined : p.host,
        // Registration stays gated below until PKI validation or an explicit endpoint pin succeeds.
        rejectUnauthorized: !!(material.pfx || material.cert),
        minVersion: "TLSv1.2",
        ...(tunnel ? { socket: tunnel } : {}),
        ...(this.secrets.ca
          ? { ca: [...tls.rootCertificates, this.secrets.ca] }
          : {}),
        ...(pin?.pem ? { ca: [...tls.rootCertificates, pin.pem] } : {}),
        ...(material.pfx
          ? {
              pfx: Buffer.from(material.pfx, "base64"),
              passphrase: material.passphrase,
            }
          : {}),
        ...(material.cert
          ? {
              cert: material.cert,
              key: material.key,
              passphrase: material.passphrase,
            }
          : {}),
        checkServerIdentity: (host, cert) => {
          if(pin?.fingerprint && cert.fingerprint256?.replace(/:/g,'').toLowerCase()===pin.fingerprint)return;
          const error = tls.checkServerIdentity(host, cert);
          if (error) return error;
          if (
            pin?.fingerprint &&
            cert.fingerprint256.replace(/:/g, "").toLowerCase() !==
              pin.fingerprint
          )
            return new Error(
              "El certificado cambió respecto a la huella fijada.",
            );
        },
      };
      this.socket = p.tls
        ? tls.connect(options, () => {
            const cert = this.socket.getPeerCertificate();
            const fingerprint=cert.raw&&crypto.createHash('sha256').update(cert.raw).digest('hex');
            const pinned=!!pin?.fingerprint&&pin.fingerprint===fingerprint;
            const identityError=cert.raw?tls.checkServerIdentity(p.host,cert):new Error('Certificado ausente');
            if(!pinned&&(!this.socket.authorized||identityError)||pin&&!pinned){
              if(cert.raw)this.emit('certificate',{host:p.host,port:p.port,trusted:false,pem:new crypto.X509Certificate(cert.raw).toString(),fingerprint,subject:cert.subject,issuer:cert.issuer,validFrom:cert.valid_from,validTo:cert.valid_to,reason:pin?'El certificado cambió respecto al aprobado.':identityError?.message||String(this.socket.authorizationError)});
              this.emit('problem','TLS: '+(this.socket.authorizationError||identityError?.message||'certificate changed')+'. Revisa y aprueba el certificado de esta red.');this.socket.destroy();return;
            }
            this.tlsAccepted=true;
            if (p.tofu && !pin && cert.raw)
              this.emit("certificate", {
                host: p.host,
                port: p.port,
                trusted: true,
                pem: new crypto.X509Certificate(cert.raw).toString(),
                fingerprint: crypto
                  .createHash("sha256")
                  .update(cert.raw)
                  .digest("hex"),
              });
            connected();
          })
        : tunnel ||
          net.createConnection({ host: p.host, port: p.port }, connected);
      if (tunnel && !p.tls) queueMicrotask(connected);
      this.socket.setTimeout(20000);
      this.socket.on("timeout", () =>
        this.fail("Se agotó el tiempo de conexión."),
      );
      this.socket.on("data", (data) => {if(!p.tls||this.tlsAccepted)this.receive(data);});
      this.socket.on("error", (e) => {
        if (p.tls && p.tofu) {
          let cert;
          try {
            cert = this.socket.getPeerCertificate?.(true);
          } catch {}
          if (cert?.raw)
            this.emit("certificate", {
              host: p.host,
              port: p.port,
              trusted: false,
              pem: new crypto.X509Certificate(cert.raw).toString(),
              fingerprint: crypto
                .createHash("sha256")
                .update(cert.raw)
                .digest("hex"),
              reason: e.message,
            });
        }
        this.emit("problem", e.message);
      });
      this.socket.on("close", () => {
        clearTimeout(this.capTimer);
        clearInterval(this.nickRecovery);this.presence.stop();
        clearTimeout(this.registrationTimer);
        clearTimeout(this.closeTimer);
        this.socket = null;
        this.ready = false;
        this.members.clear();
        for (const [clientId, item] of this.pendingEcho) {
          clearTimeout(item.timer);
          this.emit("delivery", {
            clientId,
            failed: true,
            text: "Conexión cerrada antes de confirmar el mensaje.",
          });
        }
        this.pendingEcho.clear();
        this.clones.stop();
        this.emit("status", { state: "disconnected", text: "Desconectado" });
      });
    }
    fail(message) {
      clearTimeout(this.capTimer);
      this.emit("problem", message);
      if (this.socket) this.socket.destroy();
      else this.emit("status", { state: "disconnected", text: "Desconectado" });
    }
    registerIdentity() {
      if (this.identitySent || this.closed) return;
      clearTimeout(this.capTimer);
      this.identitySent = true;
      if (this.password) this.sendRaw("PASS " + this.password);
      this.password = "";
      this.sendRaw("NICK " + this.nick);
      this.sendRaw(
        `USER ${this.profile.username} 0 * :${this.profile.realName}`,
      );
      this.registrationTimer = setTimeout(
        () => this.fail("El servidor no completó el registro IRC."),
        30000,
      );
      this.registrationTimer.unref();
      if (!this.saslInProgress && !this.pendingCaps?.size) this.endCap();
    }
    endCap() {
      if (!this.capEnded) {
        this.capEnded = true;
        this.sendRaw("CAP END");
        this.emit("capabilities", {
          capabilities: [...this.capabilities],
          advertised: [...this.advertised.keys()],
        });
      }
    }
    receive(data) {
      this.byteBuffer = Buffer.concat([
        this.byteBuffer,
        Buffer.isBuffer(data) ? data : Buffer.from(data),
      ]);
      if (this.byteBuffer.length > 131072)
        return this.fail("Respuesta del servidor demasiado grande.");
      let i;
      while ((i = this.byteBuffer.indexOf(10)) >= 0) {
        const b = this.byteBuffer.subarray(0, i);
        this.byteBuffer = this.byteBuffer.subarray(i + 1);
        if (b.length > 16384) {
          this.fail("Línea IRC demasiado grande.");
          return;
        }
        const decoded = iconv
          .decode(b, this.profile.encoding)
          .replace(/\r$/, "");
        this.emit("protocol", {
          direction: "in",
          line: redactProtocol(decoded),
        });
        const m = parseLine(decoded);
        if (m)
          try {
            this.handle(m);
          } catch (e) {
            this.fail(e.message);
          }
      }
    }
    sendRaw(line) {
      cleanText(line);
      const command = line.replace(/^@[^ ]+ /, "");
      const outgoing = /^(?:PRIVMSG|NOTICE) ([^ ]+) :/i.exec(command);
      if (
        outgoing &&
        !this.encryptedWire &&
        outgoing[1].split(",").some((target) => this.protectedTarget?.(target))
      )
        throw new Error(
          "Usa el envío cifrado para esta conversación; se ha bloqueado el texto directo.",
        );
      const b = iconv.encode(line, this.profile.encoding);
      const tagEnd = line.startsWith("@") ? line.indexOf(" ") : -1;
      if (
        b.length > (tagEnd > 0 ? 8190 : 510) ||
        tagEnd > 4096 ||
        iconv.encode(command, this.profile.encoding).length > 510
      )
        throw new Error("Mensaje demasiado largo para IRC.");
      if (!this.socket || this.socket.destroyed || !this.socket.writable)
        throw new Error("La red no está conectada.");
      this.socket.write(Buffer.concat([b, Buffer.from("\r\n")]));this.presence.observe(command);
      this.emit("protocol", {
        direction: "out",
        line: redactProtocol(command),
      });
    }
    sendEncryptedWire(line) {
      this.encryptedWire = true;
      try {
        return this.sendRaw(line);
      } finally {
        this.encryptedWire = false;
      }
    }
    sendTagged(command, tags = {}) {
      if (
        Object.keys(tags).length &&
        !this.capabilities.has("message-tags") &&
        !Object.keys(tags).every(
          (k) => k === "label" && this.capabilities.has("labeled-response"),
        )
      )
        throw new Error("El servidor no admite etiquetas de mensajes.");
      const entries = Object.entries(tags);
      for (const [k, v] of entries)
        if (!/^[+a-zA-Z0-9./-]+$/.test(k) || /[\0]/.test(String(v)))
          throw new Error("Etiqueta no válida.");
      this.sendRaw(
        (entries.length
          ? "@" +
            entries.map(([k, v]) => k + "=" + escapeTag(v)).join(";") +
            " "
          : "") + command,
      );
    }
    authSend(text) {
      const encoded = Buffer.from(text).toString("base64");
      if (!encoded) {
        this.sendRaw("AUTHENTICATE +");
        return;
      }
      for (let i = 0; i < encoded.length; i += 400)
        this.sendRaw("AUTHENTICATE " + encoded.slice(i, i + 400));
      if (encoded.length % 400 === 0) this.sendRaw("AUTHENTICATE +");
    }
    capabilitiesMessage(m) {
      const p = m.params,
        verb = p[1],
        words = (p.at(-1) || "").split(" ").filter(Boolean);
      if (verb === "LS" || verb === "NEW") {
        for (const word of words) {
          const [k, ...v] = word.split("=");
          this.advertised.set(k, v.join("="));
        }
        if (verb === "LS" && p[2] === "*") return;
        clearTimeout(this.capTimer);
        const sts = this.advertised.get("sts");
        if (sts) {
          const attrs = Object.fromEntries(
            sts.split(",").map((x) => x.split("=")),
          );
          const port = Number(attrs.port),
            duration = Number(attrs.duration);
          if (this.profile.tls && Number.isFinite(duration))
            this.emit("sts", {
              host: this.profile.host,
              port: this.profile.port,
              expires:
                Date.now() + Math.max(0, Math.min(31536000, duration)) * 1000,
            });
          if (
            !this.profile.tls &&
            Number.isInteger(port) &&
            port > 0 &&
            port <= 65535
          ) {
            this.emit("upgrade", { port });
            return;
          }
        }
        const desired = SUPPORTED.filter(
          (k) => this.advertised.has(k) && !this.capabilities.has(k),
        );
        if (verb === "LS" && this.profile.sasl !== "none") {
          const mechanisms = this.advertised.get("sasl");
          if (
            mechanisms === undefined ||
            (mechanisms && !mechanisms.split(",").includes(this.profile.sasl))
          )
            return this.fail(
              "El servidor no anuncia el mecanismo SASL solicitado.",
            );
          desired.push("sasl");
          this.saslInProgress = true;
        }
        this.pendingCaps = new Set([...(this.pendingCaps || []), ...desired]);
        if (verb === "LS") this.registerIdentity();
        if (desired.length) {
          this.sendRaw("CAP REQ :" + desired.join(" "));
        } else this.endCap();
      } else if (verb === "ACK" || verb === "NAK") {
        for (const word of words) {
          const k = word.replace(/^-/, "").split("=")[0];
          this.pendingCaps?.delete(k);
          if (verb === "ACK" && !word.startsWith("-")) this.capabilities.add(k);
          else this.capabilities.delete(k);
        }
        if (verb === "NAK" && words.includes("sasl"))
          return this.fail("El servidor rechazó SASL.");
        if (this.capabilities.has("sasl") && !this.authStarted) {
          this.authStarted = true;
          this.sendRaw("AUTHENTICATE " + this.profile.sasl);
        } else if (!this.saslInProgress && !this.pendingCaps?.size)
          this.endCap();
        this.emit("capabilities", {
          capabilities: [...this.capabilities],
          advertised: [...this.advertised.keys()],
        });
      } else if (verb === "DEL") {
        for (const k of words) {
          this.advertised.delete(k);
          this.capabilities.delete(k);
        }
        this.emit("capabilities", {
          capabilities: [...this.capabilities],
          advertised: [...this.advertised.keys()],
        });
      }
    }
    handle(m) {
      const { command: c, params: p } = m;const ownNickChange=c==='NICK'&&fold(m.nick)===fold(this.nick);this.presence.handle(m);this.clones.observe(m);if(c==="CHGHOST")this.clones.schedule();
      if(c==='381'||c==='221'||c==='MODE'&&fold(p[0])===fold(this.nick)){
        if(c==='381')this.userModes.add('o');else{if(c==='221')this.userModes.clear();let adding=true;for(const mode of (c==='221'?p.at(-1):p[1])||''){if(mode==='+')adding=true;else if(mode==='-')adding=false;else if(adding)this.userModes.add(mode);else this.userModes.delete(mode);}}
        this.emit('oper-state',{oper:this.userModes.has('o')||this.userModes.has('O'),modes:[...this.userModes].join('')});
      }
      if(['311','312','313','317','318','319','330','301','401','402'].includes(c)){
        this.emit('user-profile',{nick:p[1],code:c,params:p.slice(2),...(c==='311'?{realName:require('./avatar-policy').displayRealName(p[5])}:{}),complete:c==='318',error:c==='401'||c==='402'});
      }
      if(c==='321')this.emit('room-list',{reset:true});
      if(c==='322')this.emit('room-list',{name:p[1],members:Number(p[2])||0,topic:p[3]||''});
      if(c==='323')this.emit('room-list',{complete:true});
      if (c === "005") {
        for (const item of p.slice(1, -1)) {
          const at = item.indexOf("="),
            name = (at < 0 ? item : item.slice(0, at)).toUpperCase(),
            value =
              at < 0
                ? ""
                : item
                    .slice(at + 1)
                    .replace(/\\x([a-f\d]{2})/gi, (_, h) =>
                      String.fromCharCode(parseInt(h, 16)),
                    );
          if (["SOJU.IM/FILEHOST", "DRAFT/FILEHOST", "FILEHOST"].includes(name))
            this.filehost = value;
          if(name==="MONITOR")this.presence.setMonitor(true);if(name==="-MONITOR")this.presence.setMonitor(false);
          if(name==="REALNAMELEN"&&/^\d+$/.test(value))this.realNameLimit=Number(value);
          if(name==="WHOX")this.whox=true;
          if (["ICON", "DRAFT/ICON"].includes(name)) this.networkIcon = value;
        }
        this.emit("features", {
          realNameLimit: this.realNameLimit,
          filehost: this.filehost,
          networkIcon: this.networkIcon,
        });
      }
      if(c==='761'&&p.length>=5){
        const nick=String(p[1]).split('!')[0],key=p[2],value=p[4];
        if(key==='avatar'||key==='avatar-url')this.updateAvatar(nick,{metadata:{[key]:value}});
        else{const old=this.userStates.get(fold(nick))||{};this.userStates.set(fold(nick),{...old,metadata:{...old.metadata,[key]:value}});this.emit('user-state',{nick,key,value});}return;
      }
      if(c==='METADATA'){const key=p[1];if(key==='avatar'||key==='avatar-url')this.updateAvatar(p[0],{metadata:{[key]:p[3]||''}});return;}
      if(c==='JOIN'&&p.length>=3)this.learnPhoto(m.nick,p[2]);
      if(c==='SETNAME')this.learnPhoto(m.nick,p[0]);
      if(c==='311'&&p.length>=6)this.learnPhoto(p[1],p[5]);
      if(c==='352'&&p.length>=8)this.learnPhoto(p[5],p[7].replace(/^\d+ /,''));
      if(c==='354'&&p[1]==='152'&&p.length>=9)this.learnPhoto(p[5],p.at(-1));
      if((c==='900'&&this.ready)||(c==='ACCOUNT'&&fold(m.nick)===fold(this.nick)&&p[0]!=='*')||(c==='MODE'&&fold(p[0])===fold(this.nick)&&/\+[^-]*r/.test(p[1]||'')))try{this.publishOwnAvatar(true);}catch(e){this.emit('problem',e.message);}
      if(c==='QUIT')this.userStates.delete(fold(m.nick));
      if(c==='NICK'){const old=this.userStates.get(fold(m.nick));this.userStates.delete(fold(m.nick));if(old)this.userStates.set(fold(p[0]),old);}
      if (c === "CAP") {
        this.capabilitiesMessage(m);this.syncAvatars();
        return;
      }
      if (c === "421" && p.includes("CAP")) {
        if (this.profile.sasl !== "none")
          this.fail("El servidor no soporta CAP/SASL.");
        else this.registerIdentity();
        return;
      }
      if (c === "AUTHENTICATE") {
        if (!this.saslInProgress) return this.fail("Desafío SASL inesperado.");
        if (p[0] !== "+") {
          this.authBuffer = (this.authBuffer || "") + p[0];
          if (this.authBuffer.length > 32768)
            return this.fail("Desafío SASL demasiado grande.");
          if (p[0].length === 400) return;
        }
        const challenge = this.authBuffer
          ? base64(this.authBuffer).toString("utf8")
          : "";
        this.authBuffer = "";
        if (this.profile.sasl === "PLAIN") {
          if (this.authSent) return this.fail("Desafío PLAIN repetido.");
          this.authSent = true;
          this.authSend(
            "\0" +
              this.profile.saslUsername +
              "\0" +
              (this.secrets.saslPassword || ""),
          );
        } else if (this.profile.sasl === "EXTERNAL") {
          if (this.authSent) return this.fail("Desafío EXTERNAL repetido.");
          this.authSent = true;
          this.authSend(this.profile.saslUsername || "");
        } else {
          if (!this.scram) {
            this.scram = new ScramSha256(
              this.profile.saslUsername,
              this.secrets.saslPassword || "",
            );
            this.authSend(this.scram.first());
          } else this.authSend(this.scram.challenge(challenge));
        }
        return;
      }
      if (c === "903") {
        if (this.profile.sasl === "SCRAM-SHA-256" && !this.scram?.verified)
          return this.fail("SCRAM no verificó al servidor.");
        this.saslInProgress = false;
        this.endCap();
        return;
      }
      if (["904", "905", "906", "907"].includes(c) && this.saslInProgress)
        return this.fail("La autenticación SASL no se completó.");
      if (c === "001" && this.saslInProgress)
        return this.fail("El servidor intentó registrar sin completar SASL.");
      if (c === "433" && !this.ready && this.nickAttempts++ < 3) {
        this.nick =
          this.nickAttempts === 1
            ? this.profile.alternateNick
            : this.profile.alternateNick.slice(0, 24) + crypto.randomInt(10000);
        this.sendRaw("NICK " + this.nick);
        return;
      }
      if (c === "BATCH") {
        if (p[0]?.startsWith("+")) {
          if (this.batches.size >= 100)
            return this.fail("Demasiados lotes IRC.");
          this.batches.set(p[0].slice(1), {
            type: p[1],
            target: p[2],
            label: m.tags.label,
            parent: m.tags.batch,
            lines: [],
          });
        } else if (p[0]?.startsWith("-")) {
          const id = p[0].slice(1),
            b = this.batches.get(id);
          this.batches.delete(id);
          if (b?.type === "draft/multiline" && b.lines.length) {
            const first = b.lines[0];
            first.params[1] = b.lines
              .map(
                (line, i) =>
                  (i && !Object.hasOwn(line.tags, "draft/multiline-concat")
                    ? "\n"
                    : "") + (line.params[1] || ""),
              )
              .join("");
            if (b.parent) first.tags.batch = b.parent;
            else delete first.tags.batch;
            this.handle(first);
          }
        }
        return;
      }
      const batch = m.tags.batch && this.batches.get(m.tags.batch);
      if (
        batch?.type === "draft/multiline" &&
        (c === "PRIVMSG" || c === "NOTICE")
      ) {
        if (
          batch.lines.length >= 64 ||
          batch.lines.reduce(
            (sum, line) => sum + (line.params[1]?.length || 0),
            0,
          ) +
            (p[1]?.length || 0) >
            65536
        )
          return this.fail("Lote multilínea demasiado grande.");
        batch.lines.push(m);
        return;
      }
      if (c === "TAGMSG") {
        const target = fold(p[0]) === fold(this.nick) ? m.nick : p[0],
          reply = m.tags["+draft/reply"];
        if (m.tags["+draft/react"] && reply)
          this.emit("reaction", {
            target,
            messageId: reply,
            nick: m.nick,
            emoji: m.tags["+draft/react"],
            remove: m.tags["+draft/unreact"] === "1",
          });
        if (m.tags["+typing"])
          this.emit("typing", {
            target,
            nick: m.nick,
            state: m.tags["+typing"],
          });
        return;
      }
      if (c === "REDACT") {
        this.emit("redact", { target: p[0], messageId: p[1], nick: m.nick });
        return;
      }
      if (c === "MARKREAD") {
        this.emit("read-marker", { target: p[0], time: p[1] });
        return;
      }
      if (
        c === "AWAY" ||
        c === "ACCOUNT" ||
        c === "CHGHOST" ||
        c === "METADATA"
      ) {
        const target = c === "METADATA" ? p[0] : m.nick;
        const update =
          c === "AWAY"
            ? { away: p[0] || false }
            : c === "ACCOUNT"
              ? { account: p[0] === "*" ? "" : p[0] }
              : c === "METADATA"
                ? { key: p[1], value: p.at(-1) }
                : { host: p[1] };
        const oldState = this.userStates.get(fold(target)) || {};
        this.userStates.set(fold(target), {
          ...oldState,
          ...update,
          ...(c === "METADATA"
            ? { metadata: { ...oldState.metadata, [p[1]]: p.at(-1) } }
            : {}),
        });
        this.emit("user-state", { nick: target, ...update });
        if (c !== "METADATA") return;
      }
      if (c === "BOUNCER") {
        this.emit("bouncer", { params: p });
        return;
      }
      if (
        (c === "PRIVMSG" || c === "NOTICE") &&
        p[1]?.startsWith("\x01") &&
        !p[1].startsWith("\x01ACTION ")
      ) {
        if (p[1].endsWith("\x01")) {
          const body = p[1].slice(1, -1),
            split = body.indexOf(" ");
          this.emit("ctcp", {
            nick: m.nick,
            target: p[0],
            command: (split < 0 ? body : body.slice(0, split)).toUpperCase(),
            args: split < 0 ? "" : body.slice(split + 1),
            notice: c === "NOTICE",
          });
        }
        return;
      }
      if (c === "JOIN" && fold(m.nick) === fold(this.nick))
        this.joined.set(fold(p[0]), p[0]);
      if (
        c === "001" &&
        this.profile.bouncerNetwork &&
        this.capabilities.has("soju.im/bouncer-networks")
      )
        this.sendRaw("BOUNCER BIND " + this.profile.bouncerNetwork);
      if(c==='KILL')for(const [key,target]of this.joined)if(this.members.get(key)?.has(fold(p[0])))this.emit('room-event',{target,text:p[0]+' recibió KILL de '+m.nick+' · '+(p[1]||''),eventType:'sanction'});
      if(c==='MODE'&&/^[#&!+]/.test(p[0]||''))this.emit('room-event',{target:p[0],text:m.nick+' cambió modos: '+p.slice(1).join(' '),eventType:'sanction'});
      if(['474','475','471','473','477','489'].includes(c)&&/^[#&!+]/.test(p[1]||''))this.emit('room-event',{target:p[1],text:'Servidor · '+p.slice(1).join(' '),eventType:'sanction'});
      if(c==='465'||c==='ERROR'||c==='NOTICE'&&!m.prefix.includes('!')&&/\b(?:[zgkq]-?line[ds]?|bann?ed|ban|expuls|kill)\b/i.test(p.at(-1)||''))for(const [key,target] of this.joined)if(this.members.has(key))this.emit('room-event',{target,text:'Servidor · '+(p.at(-1)||''),eventType:'sanction'});
      const previous = this.currentMessage;
      this.currentMessage = m;
      try {
        super.handle(m);
        if(["JOIN","PART","QUIT","KICK","NICK","CHGHOST","352","354","353","366"].includes(c))this.clones.schedule();
        if(c==='001'){this.syncAvatars();this.presence.start();}if(ownNickChange)try{this.publishOwnAvatar();}catch(e){this.emit('problem',e.message);}
        if(c==='JOIN'&&fold(m.nick)===fold(this.nick)){if(this.avatarDiscovery){this.syncAvatars();if(this.capabilities.has('draft/metadata-2'))this.sendRaw('METADATA '+p[0]+' SYNC');}this.sendRaw('WHO '+p[0]+(this.whox?' %tcuhnfar,152':''));}
      } finally {
        this.currentMessage = previous;
      }
    }
    emit(type, data, ...rest) {
      const m = this.currentMessage;
      if(type==='problem'&&m&&this.pendingWhois.has(fold(m.params[1]||''))){type='server';data={text:String(data),error:true};}
      if (type === "server" && m)
        data = {
          ...data,
          code: /^\d{3}$/.test(m.command) ? m.command : "",
          target: this.labels.get(m.tags.label)?.target,
          whois: !!this.pendingWhois.get(fold(m.params[1] || "")),
        };
      if (type === "message" && m) {
        const own = fold(m.nick) === fold(this.nick),
          batch = m.tags.batch && this.batches.get(m.tags.batch);
        data = {
          ...data,
          own,
          messageId: m.tags.msgid || m.tags["draft/msgid"],
          replyTo: m.tags["+draft/reply"],
          account: m.tags.account,
          historical: !!batch && /chathistory/.test(batch.type),
          tags: m.tags,
        };
        if (own && !data.historical && !data.notice) {
          const label=m.tags.label||(m.tags.batch&&this.batches.get(m.tags.batch)?.label);
          const candidates=[...this.pendingEcho].filter(([,v])=>fold(v.target)===fold(data.target)&&!!v.action===!!data.action);
          const plain=require('../formatting').plain;
          // Labels identify an echo even if the server strips styles. Without a
          // label, consume one pending send in FIFO order, never a past message.
          const found=(label&&candidates.find(([id])=>id===label))||candidates.find(([,v])=>v.wire===data.text)||candidates.find(([,v])=>plain(v.wire)===plain(data.text));
          if (found) {
            const [id, item] = found;
            clearTimeout(item.timer);
            this.pendingEcho.delete(id);
            data = {
              ...item.message,
              ...data,
              text: item.message.text,
              clientId: id,
              pending: false,
            };
          }
        }
      }
      if (type === "server" && m) {
        const label =
            m.tags.label ||
            (m.tags.batch && this.batches.get(m.tags.batch)?.label),
          context = this.labels.get(label);
        data = {
          ...data,
          code: m.command,
          target:
            context?.target ||
            this.pendingWhois.get(fold(m.params[1] || ""))?.target ||
            (['352','354','315'].includes(m.command)&&this.pendingWho&&Date.now()-this.pendingWho.time<30000?this.pendingWho.target:null) || "*",
          time: m.tags.time,
        };
        if (/^4|^5/.test(m.command) && context?.clientId)
          super.emit("delivery", {
            clientId: context.clientId,
            failed: true,
            text: data.text,
          });
      }
      if (type === "server" && m && m.command === "318")
        this.pendingWhois.delete(fold(m.params[1] || ""));
      return super.emit(type, data, ...rest);
    }
    sendMessage(target, text, action = false, options = {}) {
      if (!this.ready) throw new Error("Espera a que termine la conexión.");
      token(target, "Destino");
      cleanText(text);
      if (!text.trim()) return;
      const clientId = options.clientId || crypto.randomUUID();
      const frames = this.cipher
        ? this.cipher.encrypt(target, text, { ...options, clientId, action })
        : [text];
      const tags = {
        ...(options.replyTo ? { "+draft/reply": options.replyTo } : {}),
        ...(this.capabilities.has("echo-message")&&this.capabilities.has("labeled-response")?{label:clientId}:{}),
      };
      for (const frame of frames) {
        const wire = action ? "\x01ACTION " + frame + "\x01" : frame;
        this.encryptedWire = true;
        try {
          this.sendTagged(`PRIVMSG ${target} :${wire}`, tags);
        } finally {
          this.encryptedWire = false;
        }
      }
      const pending =
        frames.length === 0 ||
        (this.capabilities.has("echo-message") && frames.length === 1);
      const message = {
        target,
        nick: this.nick,
        text,
        action,
        own: true,
        time: new Date().toISOString(),
        clientId,
        pending,
      };
      if (pending && frames.length) {
        const timer = setTimeout(() => {
          if (this.pendingEcho.delete(clientId))
            this.emit("delivery", {
              clientId,
              failed: true,
              text: "El servidor no confirmó el mensaje.",
            });
        }, 15000);
        timer.unref();
        this.pendingEcho.set(clientId, {
          target,
          wire: frames[0],
          action,
          message,
          timer,
        });
      }
      if (!options.noEcho) this.emit("message", message);
    }
    sendMultiline(target, lines) {
      if (!this.ready) throw new Error("Conecta primero esta red.");
      token(target, "Destino");
      if (
        !this.capabilities.has("draft/multiline") ||
        !this.capabilities.has("batch") ||
        !this.capabilities.has("message-tags") ||
        this.protectedTarget?.(target)
      ) {
        for (const line of lines) this.sendMessage(target, line);
        return;
      }
      const limits = Object.fromEntries(
        (this.advertised.get("draft/multiline") || "")
          .split(",")
          .map((p) => p.split("=")),
      );
      const text = lines.join("\n");
      if (
        lines.length > Math.min(20, Number(limits["max-lines"]) || 20) ||
        Buffer.byteLength(text) >
          Math.min(65536, Number(limits["max-bytes"]) || 4096)
      )
        throw new Error(
          "El mensaje supera los límites multilínea del servidor.",
        );
      for (const line of lines) {
        cleanText(line);
        if (
          iconv.encode("PRIVMSG " + target + " :" + line, this.profile.encoding)
            .length > 510
        )
          throw new Error("Línea demasiado larga.");
      }
      const batch = crypto.randomUUID();
      this.sendRaw("BATCH +" + batch + " draft/multiline " + target);
      for (const line of lines)
        this.sendTagged("PRIVMSG " + target + " :" + line, { batch });
      this.sendRaw("BATCH -" + batch);
      const clientId = crypto.randomUUID(),
        pending = this.capabilities.has("echo-message"),
        message = {
          target,
          nick: this.nick,
          text,
          own: true,
          time: new Date().toISOString(),
          clientId,
          pending,
        };
      if (pending) {
        const timer = setTimeout(() => {
          if (this.pendingEcho.delete(clientId))
            this.emit("delivery", {
              clientId,
              failed: true,
              text: "El servidor no confirmó el mensaje multilínea.",
            });
        }, 15000);
        timer.unref();
        this.pendingEcho.set(clientId, {
          target,
          wire: text,
          action: false,
          message,
          timer,
        });
      }
      this.emit("message", message);
    }
    request(command, target) {
      if(/^WHO /i.test(command))this.pendingWho={target,time:Date.now()};
      if (/^WHOIS /i.test(command)) {
        const nick = command.split(" ").at(-1);
        this.pendingWhois.set(fold(nick), { target, time: Date.now() });
        if (this.pendingWhois.size > 100)
          this.pendingWhois.delete(this.pendingWhois.keys().next().value);
      }
      if (!this.capabilities.has("labeled-response"))
        return this.sendRaw(command);
      const label = crypto.randomUUID();
      this.labels.set(label, { target, time: Date.now() });
      if (this.labels.size > 200)
        this.labels.delete(this.labels.keys().next().value);
      this.sendTagged(command, { label });
    }
    requestHistory(target, limit = 100, before) {
      token(target, "Canal");
      if (
        !this.capabilities.has("draft/chathistory") &&
        !this.capabilities.has("chathistory")
      )
        throw new Error("El servidor no admite CHATHISTORY.");
      this.sendRaw(
        `CHATHISTORY ${before ? "BEFORE" : "LATEST"} ${target} ${before ? "timestamp=" + new Date(before).toISOString() : "*"} ${Math.max(1, Math.min(500, limit))}`,
      );
    }
    sendTyping(target, state) {
      if(target==="*"||target==="*consultas*")return;
      if (!this.capabilities.has("message-tags")) return;
      token(target, "Destino");
      if (!["active", "paused", "done"].includes(state)) return;
      this.sendTagged("TAGMSG " + target, { "+typing": state });
    }
    react(target, messageId, emoji) {
      token(target, "Destino");
      token(messageId, "Mensaje");
      if (
        typeof emoji !== "string" ||
        emoji.length > 32 ||
        /[\0\r\n]/.test(emoji)
      )
        throw new Error("Reacción no válida.");
      this.sendTagged("TAGMSG " + target, {
        "+draft/reply": messageId,
        "+draft/react": emoji,
      });
    }
    redact(target, messageId) {
      if (!this.capabilities.has("draft/message-redaction"))
        throw new Error("El servidor no admite eliminar mensajes.");
      token(target, "Destino");
      token(messageId, "Mensaje");
      this.sendRaw(`REDACT ${target} ${messageId} :Eliminado por su autor`);
    }
    markRead(target) {
      if (target === "*" || target === "*consultas*") return;
      if (this.capabilities.has("draft/read-marker")) {
        token(target, "Destino");
        this.sendRaw(
          `MARKREAD ${target} timestamp=${new Date().toISOString()}`,
        );
      }
    }
    join(channel) {
      token(channel, "Canal");
      if (!/^[#&+!]/.test(channel)) throw new Error("Canal no válido.");
      const key = this.secrets.channelKeys?.[channel];
      if (key) token(key, "Clave de canal");
      this.sendRaw("JOIN " + channel + (key ? " " + key : ""));
    }
    disconnect() {
      this.closed = true;
      clearTimeout(this.capTimer);
      super.disconnect();
    }
  };
