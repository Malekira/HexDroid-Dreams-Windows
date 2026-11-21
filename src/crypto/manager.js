"use strict";
const fs = require("node:fs"),
  path = require("node:path");
const { EventEmitter } = require("node:events");
const A = require("./age");
const P = require("./primitives");
const { AgmCipher, FishCipher } = require("./symmetric");
const keyOf = (s) => s.toLowerCase();
const channel = (s) => /^[#&+!]/.test(s);
class AgeNetwork extends EventEmitter {
  constructor({ state, save, nick, wire }) {
    super();
    this.state = state;
    this.save = () => save(this.state);
    this.nick = nick;
    this.wire = wire;
    this.me = A.identity(state.identity);
    if (!state.identity) {
      state.identity = {
        sigSeed: this.me.sigSeed.toString("base64"),
        dhSeed: this.me.dhSeed.toString("base64"),
      };
      this.save();
    }
    this.fp = A.fingerprint(this.me);
    this.state.pins ||= {};
    this.state.sequence ||= {};
    this.state.outbox ||= [];
    this.groups = new Map();
    this.peers = new Map();
    this.rosters = new Map();
    this.enabled = new Set();
    this.announced = new Set();
    this.invites = new Map();
    this.fragments = new A.Fragments();
    this.pendingPins = new Map();
    this.announcedBack = new Set();
    this.invited = new Set();
  }
  send(target, line) {
    for (const frame of A.fragments(line, target)) this.wire(target, frame);
  }
  announce(target, force = false) {
    const key = keyOf(target);
    if (!force && this.announced.has(key)) return;
    this.announced.add(key);
    this.send(target, A.ident(this.me));
  }
  pin(nick, identity) {
    const fp = A.fingerprint(identity),
      old = Object.entries(this.state.pins).find(
        ([, p]) => keyOf(p.nick) === keyOf(nick),
      );
    const existing = this.state.pins[fp];
    if (
      (old && old[0] !== fp) ||
      (existing && keyOf(existing.nick) !== keyOf(nick))
    ) {
      this.pendingPins.set(keyOf(nick), { nick, identity, fp });
      this.emit("security", {
        type: "identity-conflict",
        nick,
        fingerprint: fp,
        previous: old?.[0] || fp,
      });
      return false;
    }
    if (!existing) {
      if (Object.keys(this.state.pins).length >= 1000)
        throw new Error("Límite de identidades AGE alcanzado.");
      this.state.pins[fp] = {
        nick,
        sigPub: identity.sigPub.toString("base64"),
        dhPub: identity.dhPub.toString("base64"),
        verified: false,
      };
      this.save();
    }
    return fp;
  }
  confirm(nick, expected) {
    const p = this.pendingPins.get(keyOf(nick));
    if (!p || p.fp !== expected)
      throw new Error("La identidad pendiente cambió.");
    for (const [fp, pin] of Object.entries(this.state.pins))
      if (keyOf(pin.nick) === keyOf(nick)) delete this.state.pins[fp];
    delete this.state.pins[p.fp];
    this.pendingPins.delete(keyOf(nick));
    this.pin(nick, p.identity);
    this.peers.delete(keyOf(nick));
    this.announce(nick, true);
  }
  peer(nick) {
    const match = Object.entries(this.state.pins).find(
      ([, p]) => keyOf(p.nick) === keyOf(nick),
    );
    return match
      ? {
          fp: match[0],
          ...match[1],
          sigPub: P.b64(match[1].sigPub),
          dhPub: P.b64(match[1].dhPub),
        }
      : null;
  }
  enable(target) {
    this.enabled.add(keyOf(target));
    this.announce(target);
    if (channel(target)) {
      if (!this.groups.has(keyOf(target))) this.mint(target);
      this.invitePeers(target);
    } else if (this.peers.has(keyOf(target))) this.startPm(target);
  }
  reserve(id, key, seq) {
    const name = id + "|" + P.hash(key).toString("hex");
    if (seq > (this.state.sequence[name] ?? -1)) {
      this.state.sequence[name] = seq + 512;
      this.save();
    }
  }
  group(target, key, owner) {
    const name = keyOf(target),
      id = target,
      seqKey = id + "|" + P.hash(key).toString("hex");
    const first = Math.max(
      Math.floor((Date.now() - 1767225600000) / 500),
      (this.state.sequence[seqKey] ?? -1) + 1,
    );
    const g = new A.Group(id, key, this.me, 0, first, (seq) =>
      this.reserve(id, key, seq),
    );
    g.owner = owner;
    this.groups.set(name, g);
    for (const [fp, nick] of this.rosters.get(name) || []) {
      const p = this.peer(nick);
      if (p) g.members.set(fp, p.sigPub);
    }
    return g;
  }
  mint(target) {
    const g = this.group(target, P.crypto.randomBytes(32), this.fp);
    this.emit("security", {
      type: "group-ready",
      target,
      fingerprint: this.fp,
    });
    return g;
  }
  owner(target) {
    return [
      this.fp,
      ...(this.rosters.get(keyOf(target))?.keys() || []),
    ].sort()[0];
  }
  invitePeers(target) {
    if (this.owner(target) !== this.fp) return;
    const g = this.groups.get(keyOf(target)) || this.mint(target),
      members = [
        { nick: this.nick(), fp: this.fp },
        ...[...(this.rosters.get(keyOf(target)) || [])].map(([fp, nick]) => ({
          nick,
          fp,
        })),
      ];
    for (const m of members) {
      if (m.fp === this.fp) continue;
      const p = this.peer(m.nick);
      if (!p) continue;
      g.members.set(m.fp, p.sigPub);
      const inviteKey =
        keyOf(target) + "|" + m.fp + "|" + P.hash(g.key).toString("hex");
      if (this.invited.has(inviteKey)) continue;
      if (this.invited.size > 5000) this.invited.clear();
      this.invited.add(inviteKey);
      const blob = A.invite(this.me, p, m.nick, {
          id: target,
          key: g.key,
          params: "",
          members,
          issued: Date.now(),
          expires: Date.now() + 300000,
        }),
        encoded = blob.toString("base64"),
        id = P.crypto.randomBytes(8).toString("hex"),
        count = Math.ceil(encoded.length / 350);
      if (count > 64) throw new Error("Invitación AGE demasiado grande.");
      for (let i = 0; i < count; i++)
        this.send(
          target,
          `AGE INVITE ${id} ${i + 1}/${count} ${encoded.slice(i * 350, (i + 1) * 350)}`,
        );
    }
  }
  startPm(nick) {
    const p = this.peer(nick),
      s = this.peers.get(keyOf(nick));
    if (
      !p ||
      !s ||
      s.ratchet ||
      s.helloSent ||
      this.fp > p.fp ||
      !this.enabled.has(keyOf(nick))
    )
      return;
    s.ek = A.ephemeral();
    s.helloSent = true;
    this.send(
      nick,
      "AGE HELLO " + A.hello(this.me, s.ek, p).toString("base64"),
    );
    this.emit("security", { type: "negotiating", target: nick });
  }
  pmAad(fp) {
    return Buffer.from([this.fp, fp].sort().join("|"));
  }
  encode(target, text) {
    if (channel(target)) {
      const g = this.groups.get(keyOf(target));
      if (!g) throw new Error("El canal AGE no tiene clave negociada.");
      const m = g.encrypt(Buffer.from(text));
      return A.fragments(
        `AGE CHAT ${m.id} ${m.fp} ${m.epoch} ${m.seq} ${m.ciphertext.toString("base64")}`,
        target,
      );
    }
    const p = this.peer(target),
      s = this.peers.get(keyOf(target));
    if (!p || !s?.ratchet) return null;
    const m = s.ratchet.encrypt(Buffer.from(text), this.pmAad(p.fp));
    return A.fragments(
      `AGE PM ${m.pub.toString("base64")} ${m.pn} ${m.n} ${m.ciphertext.toString("base64")}`,
      target,
    );
  }
  encrypt(target, text, options) {
    this.enable(target);
    const frames = this.encode(target, text);
    if (frames) return frames;
    if (this.state.outbox.length >= 100)
      throw new Error("La cola cifrada está llena.");
    this.state.outbox.push({
      target,
      text,
      clientId: options.clientId,
      created: Date.now(),
      action: options.action === true,
    });
    this.save();
    this.emit("security", {
      type: "pending",
      target,
      text: "Esperando a que el destinatario active AGE. No se transmitirá texto sin cifrar.",
    });
    return [];
  }
  flush(nick) {
    const kept = [];
    for (const pending of this.state.outbox) {
      if (keyOf(pending.target) !== keyOf(nick)) {
        kept.push(pending);
        continue;
      }
      const frames = this.encode(nick, pending.text);
      if (!frames) {
        kept.push(pending);
        continue;
      }
      for (const frame of frames)
        this.wire(
          nick,
          pending.action ? "\x01ACTION " + frame + "\x01" : frame,
        );
      this.emit("delivery", { clientId: pending.clientId, pending: false });
    }
    this.state.outbox = kept;
    this.save();
  }
  receive(target, nick, line) {
    line = this.fragments.receive(nick, line);
    if (!line) return null;
    const t = line.split(" ");
    if (t[0] !== "AGE") return undefined;
    if (t[1] === "IDENT") {
      const identity = A.parseIdent(line),
        fp = this.pin(nick, identity);
      if (!fp || fp === this.fp) return null;
      const key = keyOf(target);
      if (!this.rosters.has(key)) this.rosters.set(key, new Map());
      this.rosters.get(key).set(fp, nick);
      const old = this.peers.get(keyOf(nick));
      if (!old || old.fp !== fp) this.peers.set(keyOf(nick), { fp });
      const g = this.groups.get(key);
      if (g) g.members.set(fp, identity.sigPub);
      if (!this.enabled.has(key)) {
        this.emit("security", {
          type: "interest",
          target,
          nick,
          fingerprint: fp,
        });
        return null;
      }
      const back = key + "|" + fp;
      if (!this.announcedBack.has(back)) {
        this.announcedBack.add(back);
        this.announce(target, true);
      }
      if (channel(target)) {
        if (this.owner(target) === this.fp) this.invitePeers(target);
      } else this.startPm(nick);
      return null;
    }
    const peer = this.peer(nick);
    if (!peer || this.pendingPins.has(keyOf(nick)))
      throw new Error("Identidad AGE no fijada o en conflicto.");
    if (t[1] === "HELLO" && t.length === 3) {
      if (!this.enabled.has(keyOf(nick)))
        throw new Error("AGE no está activado para este privado.");
      const ekA = A.openHello(this.me, P.b64(t[2]), peer),
        ekB = A.ephemeral(),
        s = {
          fp: peer.fp,
          ek: ekB,
          ratchet: new A.Ratchet(
            A.shared(this.me, ekB, peer, ekA, false),
            ekB,
            ekA,
            false,
          ),
        };
      this.peers.set(keyOf(nick), s);
      this.send(
        nick,
        "AGE ACK " + A.ack(this.me, ekB, peer, ekA).toString("base64"),
      );
      this.emit("security", {
        type: "established",
        target: nick,
        fingerprint: peer.fp,
      });
      this.flush(nick);
      return null;
    }
    if (t[1] === "ACK" && t.length === 3) {
      const s = this.peers.get(keyOf(nick));
      if (!s?.ek || !s.helloSent) throw new Error("ACK AGE inesperado.");
      const ekB = A.openAck(this.me, P.b64(t[2]), peer, s.ek.pub);
      s.ratchet = new A.Ratchet(
        A.shared(this.me, s.ek, peer, ekB, true),
        s.ek,
        ekB,
        true,
      );
      this.emit("security", {
        type: "established",
        target: nick,
        fingerprint: peer.fp,
      });
      this.flush(nick);
      return null;
    }
    if (t[1] === "PM" && t.length === 6) {
      if (!/^\d+$/.test(t[3]) || !/^\d+$/.test(t[4]))
        throw new Error("Cabecera AGE PM no válida.");
      const s = this.peers.get(keyOf(nick));
      if (!s?.ratchet) throw new Error("AGE PM sin sesión negociada.");
      return s.ratchet
        .decrypt(
          {
            pub: P.b64(t[2]),
            pn: Number(t[3]),
            n: Number(t[4]),
            ciphertext: P.b64(t[5]),
          },
          this.pmAad(peer.fp),
        )
        .toString("utf8");
    }
    if (t[1] === "INVITE" && t.length === 5) {
      const m = /^(\d+)\/(\d+)$/.exec(t[3]);
      if (!m || +m[1] < 1 || +m[1] > +m[2] || +m[2] > 64 || t[4].length > 350)
        throw new Error("Invitación fragmentada no válida.");
      for (const [id, record] of this.invites)
        if (Date.now() - (record.created || 0) > 60000) this.invites.delete(id);
      const id = keyOf(nick) + "|" + t[2];
      if (this.invites.size >= 32 && !this.invites.has(id))
        throw new Error("Demasiadas invitaciones pendientes.");
      let record = this.invites.get(id);
      if (!record || record.length !== +m[2]) {
        record = Array(+m[2]).fill(null);
        record.created = Date.now();
        this.invites.set(id, record);
      }
      record[+m[1] - 1] = t[4];
      if (record.some((x) => x === null)) return null;
      this.invites.delete(id);
      const pl = A.openInvite(
          this.me,
          this.nick(),
          P.b64(record.join("")),
          peer,
        ),
        key = keyOf(pl.id),
        old = this.groups.get(key);
      if (!this.enabled.has(key))
        throw new Error("El destino de la invitación no tiene AGE activado.");
      if (
        old &&
        !P.equal(old.key, pl.key) &&
        old.owner !== peer.fp &&
        this.owner(pl.id) !== peer.fp
      )
        throw new Error(
          "El remitente no está autorizado a cambiar la clave del canal.",
        );
      const g =
        old && P.equal(old.key, pl.key)
          ? old
          : this.group(pl.id, pl.key, peer.fp);
      for (const member of pl.members) {
        const p = this.peer(member.nick);
        if (p && p.fp === member.fp) g.members.set(p.fp, p.sigPub);
      }
      this.emit("security", {
        type: "group-ready",
        target: pl.id,
        fingerprint: peer.fp,
      });
      return null;
    }
    if ((t[1] === "CHAT" || t[1] === "MSG") && t.length === 7) {
      if (
        keyOf(t[2]) !== keyOf(target) ||
        !/^[a-f0-9]{64}$/i.test(t[3]) ||
        t[3].toLowerCase() !== peer.fp ||
        !/^\d+$/.test(t[4]) ||
        !/^\d+$/.test(t[5])
      )
        throw new Error("Cabecera AGE no válida.");
      const group = this.groups.get(keyOf(target));
      if (!group) throw new Error("Falta la clave AGE del canal.");
      return group
        .decrypt({
          id: t[2],
          fp: t[3],
          epoch: Number(t[4]),
          seq: Number(t[5]),
          ciphertext: P.b64(t[6]),
        })
        .toString("utf8");
    }
    if (t[1] === "REKEY" && t.length === 4) return null;
    throw new Error("Trama AGE desconocida o mal formada.");
  }
  left(target, nick) {
    const roster = this.rosters.get(keyOf(target));
    if (!roster) return;
    for (const [fp, n] of roster)
      if (keyOf(n) === keyOf(nick)) {
        roster.delete(fp);
        this.groups.get(keyOf(target))?.members.delete(fp);
      }
    if (this.enabled.has(keyOf(target)) && this.owner(target) === this.fp) {
      this.mint(target);
      this.invitePeers(target);
    }
  }
}
function validateTargets(data) {
  if (!Array.isArray(data) || data.length > 1000)
    throw new Error("Metadatos de cifrado no válidos.");
  const seen = new Set();
  for (const d of data) {
    if (
      !d ||
      typeof d.network !== "string" ||
      !/^[a-z\d_-]{1,80}$/i.test(d.network) ||
      typeof d.target !== "string" ||
      !d.target ||
      d.target.length > 200 ||
      /[\s\0\r\n,:]/.test(d.target) ||
      !["AGM", "FiSH", "AGE"].includes(d.scheme)
    )
      throw new Error("Destino cifrado no válido.");
    const key = d.network + "\0" + keyOf(d.target);
    if (seen.has(key)) throw new Error("Destino cifrado duplicado.");
    seen.add(key);
  }
  return data.map(({ network, target, scheme }) => ({
    network,
    target,
    scheme,
  }));
}
class CryptoManager extends EventEmitter {
  constructor(directory, vault) {
    super();
    this.file = path.join(directory, "encryption.json");
    this.vault = vault;
    this.networks = new Map();
    this.symmetric = new Map();
    this.targets = [];
    if (fs.existsSync(this.file)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.file, "utf8"));
        if (
          !Array.isArray(data) ||
          data.some(
            (x) =>
              typeof x.network !== "string" ||
              typeof x.target !== "string" ||
              !["AGM", "FiSH", "AGE"].includes(x.scheme),
          )
        )
          throw new Error("metadata");
        this.targets = validateTargets(data);
      } catch {
        this.corrupt = true;
      }
    } else if (vault.available()) {
      try {
        const saved = vault.get("crypto-targets");
        if (saved) {
          if (!Array.isArray(saved)) throw new Error("metadata");
          this.targets = validateTargets(saved);
          this.write();
        }
      } catch {
        this.corrupt = true;
      }
    }
  }
  write() {
    if (this.vault.available()) this.vault.set("crypto-targets", this.targets);
    const temp = this.file + ".tmp";
    fs.writeFileSync(temp, JSON.stringify(this.targets), { mode: 0o600 });
    fs.renameSync(temp, this.file);
  }
  descriptor(network, target) {
    if (this.corrupt)
      throw new Error(
        "Metadatos de cifrado dañados: restaura una copia antes de enviar.",
      );
    return this.targets.find(
      (t) => t.network === network && keyOf(t.target) === keyOf(target),
    );
  }
  attach(network, client) {
    this.networks.delete(network);
    for (const key of this.symmetric.keys())
      if (key.startsWith(network + "\0")) this.symmetric.delete(key);
    const getAge = () => {
      let a = this.networks.get(network);
      if (!a) {
        const state = this.vault.get("crypto:" + network) || {};
        a = new AgeNetwork({
          state,
          save: (s) => this.vault.set("crypto:" + network, s),
          nick: () => client.nick,
          wire: (target, line) =>
            client.sendEncryptedWire(`PRIVMSG ${target} :${line}`),
        });
        a.on("security", (data) => this.emit("security", { network, ...data }));
        a.on("delivery", (data) => client.emit("delivery", data));
        this.networks.set(network, a);
      }
      return a;
    };
    const symmetric = (target, d) => {
      const id = network + "\0" + keyOf(target);
      let cipher = this.symmetric.get(id);
      if (!cipher) {
        const key = this.vault.get("key:" + id);
        if (!key)
          throw new Error("La conversación está cifrada pero falta su clave.");
        cipher =
          d.scheme === "AGM"
            ? new AgmCipher(P.b64(key))
            : new FishCipher(P.b64(key));
        this.symmetric.set(id, cipher);
      }
      return cipher;
    };
    client.protectedTarget = (target) => !!this.descriptor(network, target);
    client.cipher = {
      encrypt: (target, text, options) => {
        const d = this.descriptor(network, target);
        if (!d) return [text];
        if (d.scheme === "AGE") return getAge().encrypt(target, text, options);
        return [symmetric(target, d).encrypt(text, client.nick, target)];
      },
    };
    client.on("channel", (data) => {
      if (
        data.own &&
        data.action === "join" &&
        this.descriptor(network, data.target)?.scheme === "AGE"
      )
        getAge().enable(data.target);
      if (!data.own && ["part", "kick", "quit"].includes(data.action))
        this.networks.get(network)?.left(data.target, data.nick);
    });
    return {
      receive: (message) => {
        if (message.own) {
          if (
            !message.clientId &&
            /^(?:AGE |\+AGM |\+OK )/.test(message.text)
          ) {
            if (!message.historical || message.text.startsWith("AGE "))
              return null;
          } else return message;
        }
        const d = this.descriptor(network, message.target);
        try {
          if (message.text.startsWith("AGE ")) {
            const text = getAge().receive(
              message.target,
              message.nick,
              message.text,
            );
            return text === null
              ? null
              : { ...message, text, encrypted: "AGE" };
          }
          if (!d) return message;
          if (d.scheme === "AGE")
            throw new Error("Mensaje sin cifrar en una conversación AGE.");
          const expected = d.scheme === "AGM" ? "+AGM " : "+OK ";
          if (!message.text.startsWith(expected))
            throw new Error(
              "Mensaje sin cifrar en una conversación protegida.",
            );
          return {
            ...message,
            text: symmetric(message.target, d).decrypt(
              message.text,
              client.nick,
              message.target,
              { historical: message.historical },
            ),
            encrypted: d.scheme,
          };
        } catch (e) {
          this.emit("security", {
            network,
            target: message.target,
            type: "rejected",
            text: e.message,
          });
          return null;
        }
      },
      age: getAge,
    };
  }
  configure(network, target, scheme, key) {
    if (this.corrupt)
      throw new Error(
        "Restaura los metadatos de cifrado antes de modificar esta configuración.",
      );
    if (
      typeof network !== "string" ||
      typeof target !== "string" ||
      !target ||
      /[\0\r\n ]/.test(target)
    )
      throw new Error("Destino no válido.");
    const id = network + "\0" + keyOf(target);
    if (!["none", "AGM", "FiSH", "AGE"].includes(scheme))
      throw new Error("Esquema no válido.");
    if (scheme !== "none" && !this.vault.available())
      throw new Error("El almacén seguro no está disponible.");
    let cipher;
    if (scheme === "AGM" || scheme === "FiSH") {
      const bytes = key ? P.b64(key) : P.crypto.randomBytes(32);
      cipher = scheme === "AGM" ? new AgmCipher(bytes) : new FishCipher(bytes);
      this.vault.set("key:" + id, bytes.toString("base64"));
    }
    const age = this.networks.get(network);
    if (age && scheme !== "AGE") {
      age.enabled.delete(keyOf(target));
      age.peers.delete(keyOf(target));
      age.state.outbox = age.state.outbox.filter(
        (m) => keyOf(m.target) !== keyOf(target),
      );
      age.save();
    }
    this.targets = this.targets.filter(
      (t) => !(t.network === network && keyOf(t.target) === keyOf(target)),
    );
    if (scheme !== "none") this.targets.push({ network, target, scheme });
    this.corrupt = false;
    this.write();
    this.symmetric.delete(id);
    return { scheme, fingerprint: cipher?.fingerprint() };
  }
  status(network, target) {
    const d = this.descriptor(network, target);
    if (!d) return { scheme: "none" };
    return {
      ...d,
      ...(d.scheme === "AGE" && this.networks.has(network)
        ? {
            fingerprint: A.safety(
              Buffer.from(this.networks.get(network).fp, "hex"),
            ),
            pins: Object.entries(this.networks.get(network).state.pins).map(
              ([fp, p]) => ({
                fingerprint: fp,
                nick: p.nick,
                verified: p.verified,
              }),
            ),
            pendingPins: [
              ...this.networks.get(network).pendingPins.values(),
            ].map((p) => ({ nick: p.nick, fingerprint: p.fp })),
            pendingMessages: this.networks.get(network).state.outbox.length,
          }
        : {}),
    };
  }
}
module.exports = { CryptoManager, AgeNetwork, validateTargets };
