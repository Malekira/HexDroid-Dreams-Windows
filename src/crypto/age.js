"use strict";
// Protocol adaptation of HexDroid AGE (boxlabs, GPL-3.0-or-later).
// Transcript labels follow the Android implementation (HELLO/ACK v2), not outdated examples.
const P = require("./primitives");
const {
  crypto,
  concat,
  hash,
  mac,
  hkdf,
  equal,
  publicFrom,
  sign,
  verify,
  dh,
  seal,
  open,
  Writer: W,
  Reader: R,
  b64,
  safety,
} = P;
const label = (s) => Buffer.from("hexdroid/+AGE/" + s),
  zero = Buffer.alloc(32);
const u32 = (x) => new W().u32(x).build();
function identity(saved) {
  const sigSeed = saved ? b64(saved.sigSeed) : crypto.randomBytes(32),
    dhSeed = saved ? b64(saved.dhSeed) : crypto.randomBytes(32);
  return {
    sigSeed,
    dhSeed,
    sigPub: publicFrom(sigSeed, "ed"),
    dhPub: publicFrom(dhSeed, "dh"),
  };
}
function fingerprint(i) {
  return hash(
    new W()
      .str("hexdroid/+AGE/identity/v1")
      .bytes(i.sigPub)
      .bytes(i.dhPub)
      .build(),
  ).toString("hex");
}
function ident(i, created = Date.now()) {
  const body = new W()
    .str("hexdroid/+AGE/ident/v1")
    .bytes(i.sigPub)
    .bytes(i.dhPub)
    .u64(created)
    .build();
  return `AGE IDENT 1 ${i.sigPub.toString("base64")} ${i.dhPub.toString("base64")} ${created} ${sign(i.sigSeed, body).toString("base64")}`;
}
function parseIdent(line) {
  const t = line.split(" ");
  if (
    t.length !== 7 ||
    t[0] !== "AGE" ||
    t[1] !== "IDENT" ||
    t[2] !== "1" ||
    !/^\d+$/.test(t[5])
  )
    throw new Error("IDENT AGE no válido.");
  const i = { sigPub: b64(t[3]), dhPub: b64(t[4]) },
    timestamp = Number(t[5]);
  if (
    i.sigPub.length !== 32 ||
    i.dhPub.length !== 32 ||
    !Number.isSafeInteger(timestamp)
  )
    throw new Error("Identidad AGE no válida.");
  const body = new W()
    .str("hexdroid/+AGE/ident/v1")
    .bytes(i.sigPub)
    .bytes(i.dhPub)
    .u64(timestamp)
    .build();
  if (!verify(i.sigPub, body, b64(t[6])))
    throw new Error("Firma IDENT incorrecta.");
  return i;
}
function box(recipient, text, aad) {
  const seed = crypto.randomBytes(32),
    pub = publicFrom(seed, "dh"),
    okm = hkdf(
      dh(seed, recipient),
      concat(pub, recipient),
      label("seal/v1"),
      44,
    );
  return concat(pub, seal(okm.subarray(0, 32), okm.subarray(32), text, aad));
}
function unbox(me, data, aad) {
  if (data.length < 48) throw new Error("AGE seal truncado.");
  const pub = data.subarray(0, 32),
    okm = hkdf(dh(me.dhSeed, pub), concat(pub, me.dhPub), label("seal/v1"), 44);
  return open(okm.subarray(0, 32), okm.subarray(32), data.subarray(32), aad);
}
const ephemeral = () => {
  const seed = crypto.randomBytes(32);
  return { seed, pub: publicFrom(seed, "dh") };
};
function hello(me, ek, peer) {
  const body = new W()
    .bytes(me.sigPub)
    .bytes(me.dhPub)
    .bytes(ek.pub)
    .bytes(peer.dhPub)
    .build();
  return box(
    peer.dhPub,
    new W()
      .bytes(body)
      .bytes(sign(me.sigSeed, concat(label("hello-sign/v2"), body)))
      .build(),
    label("hello/v1"),
  );
}
function openHello(me, data, peer) {
  const reader = new R(unbox(me, data, label("hello/v1"))),
    body = reader.bytes(),
    sig = reader.bytes();
  reader.end();
  const r = new R(body),
    sigPub = r.bytes(),
    dhPub = r.bytes(),
    ek = r.bytes(),
    recipient = r.bytes();
  r.end();
  if (
    !equal(sigPub, peer.sigPub) ||
    !equal(dhPub, peer.dhPub) ||
    !equal(recipient, me.dhPub) ||
    !verify(sigPub, concat(label("hello-sign/v2"), body), sig)
  )
    throw new Error("HELLO no coincide con la identidad fijada.");
  return ek;
}
function ack(me, ek, peer, ekA) {
  const body = new W()
    .bytes(ek.pub)
    .bytes(peer.sigPub)
    .bytes(peer.dhPub)
    .bytes(ekA)
    .bytes(me.sigPub)
    .build();
  return box(
    peer.dhPub,
    new W()
      .bytes(body)
      .bytes(sign(me.sigSeed, concat(label("ack-sign/v2"), body)))
      .build(),
    label("ack/v1"),
  );
}
function openAck(me, data, peer, ekA) {
  const reader = new R(unbox(me, data, label("ack/v1"))),
    body = reader.bytes(),
    sig = reader.bytes();
  reader.end();
  const r = new R(body),
    ekB = r.bytes(),
    a = r.bytes(),
    b = r.bytes(),
    e = r.bytes(),
    c = r.bytes();
  r.end();
  if (
    !equal(a, me.sigPub) ||
    !equal(b, me.dhPub) ||
    !equal(e, ekA) ||
    !equal(c, peer.sigPub) ||
    !verify(peer.sigPub, concat(label("ack-sign/v2"), body), sig)
  )
    throw new Error("ACK no coincide con el transcript.");
  return ekB;
}
function shared(me, ek, peer, theirEk, initiator) {
  return hkdf(
    initiator
      ? concat(
          dh(me.dhSeed, theirEk),
          dh(ek.seed, peer.dhPub),
          dh(ek.seed, theirEk),
        )
      : concat(
          dh(ek.seed, peer.dhPub),
          dh(me.dhSeed, theirEk),
          dh(ek.seed, theirEk),
        ),
    zero,
    label("handshake/v1"),
    32,
  );
}
class Ratchet {
  constructor(sk, ek, remote, initiator) {
    this.seed = ek.seed;
    this.pub = ek.pub;
    this.remote = null;
    this.root = sk;
    this.sendChain = null;
    this.receiveChain = null;
    this.ns = 0;
    this.nr = 0;
    this.pn = 0;
    this.skipped = new Map();
    this.initial = initiator ? null : remote;
    if (initiator) {
      this.remote = remote;
      [this.root, this.sendChain] = this.rootStep(dh(this.seed, remote));
    }
  }
  rootStep(shared) {
    const m = hkdf(shared, this.root, label("ratchet/rk/v1"), 64);
    return [m.subarray(0, 32), m.subarray(32)];
  }
  chainStep(chain) {
    return [mac(chain, Buffer.from([2])), mac(chain, Buffer.from([1]))];
  }
  step(remote) {
    this.pn = this.ns;
    this.ns = 0;
    this.nr = 0;
    this.remote = remote;
    this.initial = null;
    [this.root, this.receiveChain] = this.rootStep(dh(this.seed, remote));
    const e = ephemeral();
    this.seed = e.seed;
    this.pub = e.pub;
    [this.root, this.sendChain] = this.rootStep(dh(this.seed, remote));
  }
  header(m) {
    return new W().bytes(m.pub).u32(m.pn).u32(m.n).build();
  }
  key(mk) {
    return hkdf(mk, zero, label("ratchet/msg/v1"), 44);
  }
  encrypt(text, aad) {
    if (!this.sendChain) {
      if (!this.initial) throw new Error("Ratchet incompleto.");
      this.step(this.initial);
    }
    if (this.ns >= 0x7ffffffe) throw new Error("Ratchet agotado.");
    const [next, mk] = this.chainStep(this.sendChain),
      m = { pub: this.pub, pn: this.pn, n: this.ns },
      key = this.key(mk);
    m.ciphertext = seal(
      key.subarray(0, 32),
      key.subarray(32),
      text,
      concat(aad, this.header(m)),
    );
    this.ns++;
    this.sendChain = next;
    return m;
  }
  skip(until) {
    if (!this.receiveChain) return;
    if (
      until - this.nr > 1000 ||
      this.skipped.size + Math.max(0, until - this.nr) > 1000
    )
      throw new Error("Límite de claves omitidas.");
    while (this.nr < until) {
      const [next, mk] = this.chainStep(this.receiveChain);
      this.skipped.set(this.remote.toString("hex") + "|" + this.nr, mk);
      this.receiveChain = next;
      this.nr++;
    }
  }
  decrypt(m, aad) {
    if (
      m.pub.length !== 32 ||
      !Number.isSafeInteger(m.n) ||
      !Number.isSafeInteger(m.pn) ||
      m.n < 0 ||
      m.pn < 0
    )
      throw new Error("Cabecera ratchet no válida.");
    const keyId = m.pub.toString("hex") + "|" + m.n,
      oldKey = this.skipped.get(keyId);
    if (oldKey) {
      const key = this.key(oldKey),
        text = open(
          key.subarray(0, 32),
          key.subarray(32),
          m.ciphertext,
          concat(aad, this.header(m)),
        );
      this.skipped.delete(keyId);
      return text;
    }
    const snapshot = { ...this, skipped: new Map(this.skipped) };
    try {
      if (!this.remote || !equal(this.remote, m.pub)) {
        this.skip(m.pn);
        this.step(m.pub);
      }
      if (m.n < this.nr) throw new Error("Repetición ratchet.");
      this.skip(m.n);
      if (!this.receiveChain) throw new Error("Sin cadena receptora.");
      const [next, mk] = this.chainStep(this.receiveChain),
        key = this.key(mk),
        text = open(
          key.subarray(0, 32),
          key.subarray(32),
          m.ciphertext,
          concat(aad, this.header(m)),
        );
      this.receiveChain = next;
      this.nr++;
      return text;
    } catch (e) {
      Object.assign(this, snapshot);
      throw e;
    }
  }
}
class Group {
  constructor(id, key, me, epoch = 0, firstSeq = 0, reserve = () => {}) {
    if (key.length !== 32) throw new Error("Clave AGE no válida.");
    this.id = id;
    this.key = key;
    this.me = me;
    this.fp = fingerprint(me);
    this.epoch = epoch;
    this.sequence = firstSeq;
    this.members = new Map([[this.fp, me.sigPub]]);
    this.last = new Map();
    this.reserve = reserve;
  }
  senderKey(fp) {
    return hkdf(
      this.key,
      zero,
      concat(
        label("msg-key/v1"),
        Buffer.from(fp.toLowerCase()),
        u32(this.epoch),
      ),
      32,
    );
  }
  nonce(fp, seq) {
    return concat(Buffer.from(fp.slice(0, 16), "hex"), u32(seq));
  }
  aad(id, fp, seq) {
    return concat(label("msg/v1"), Buffer.from(id), Buffer.from(fp), u32(seq));
  }
  encrypt(text) {
    if (this.sequence >= 0x7ffffffe)
      throw new Error("Secuencia AGE agotada: cambia la clave.");
    const seq = this.sequence;
    this.reserve(seq);
    this.sequence++;
    const inner = new W()
        .str(this.id)
        .u32(this.epoch)
        .u32(seq)
        .str(this.fp)
        .bytes(text)
        .build(),
      signed = new W()
        .bytes(inner)
        .bytes(sign(this.me.sigSeed, concat(label("msg-sign/v1"), inner)))
        .build();
    return {
      id: this.id,
      fp: this.fp,
      epoch: this.epoch,
      seq,
      ciphertext: seal(
        this.senderKey(this.fp),
        this.nonce(this.fp, seq),
        signed,
        this.aad(this.id, this.fp, seq),
      ),
    };
  }
  decrypt(m) {
    if (
      m.id !== this.id ||
      m.epoch !== this.epoch ||
      !/^[a-f0-9]{64}$/i.test(m.fp) ||
      !this.members.has(m.fp.toLowerCase())
    )
      throw new Error("Grupo, época o miembro AGE desconocido.");
    const body = open(
        this.senderKey(m.fp),
        this.nonce(m.fp, m.seq),
        m.ciphertext,
        this.aad(m.id, m.fp, m.seq),
      ),
      r = new R(body),
      inner = r.bytes(),
      sig = r.bytes();
    r.end();
    if (
      !verify(
        this.members.get(m.fp.toLowerCase()),
        concat(label("msg-sign/v1"), inner),
        sig,
      )
    )
      throw new Error("Firma AGE incorrecta.");
    const ir = new R(inner),
      id = ir.str(),
      epoch = ir.u32(),
      seq = ir.u32(),
      fp = ir.str(),
      text = ir.bytes();
    ir.end();
    if (
      id !== m.id ||
      epoch !== m.epoch ||
      seq !== m.seq ||
      fp.toLowerCase() !== m.fp.toLowerCase() ||
      seq <= (this.last.get(fp.toLowerCase()) ?? -1)
    )
      throw new Error("Cabecera alterada o repetición AGE.");
    this.last.set(fp.toLowerCase(), seq);
    return text;
  }
}
function invite(me, peer, nick, payload) {
  const w = new W()
    .u32(1)
    .str(payload.id)
    .bytes(payload.key)
    .str(payload.params || "")
    .u32(payload.members.length);
  for (const m of payload.members) w.str(m.nick).str(m.fp);
  const body = w
    .bytes(me.sigPub)
    .u64(payload.issued)
    .u64(payload.expires)
    .build();
  return box(
    peer.dhPub,
    new W()
      .bytes(body)
      .bytes(sign(me.sigSeed, concat(label("invite-sign/v1"), body)))
      .build(),
    concat(label("invite-aad/v1"), Buffer.from(nick)),
  );
}
function openInvite(me, nick, blob, host) {
  const reader = new R(
      unbox(me, blob, concat(label("invite-aad/v1"), Buffer.from(nick))),
    ),
    body = reader.bytes(),
    sig = reader.bytes();
  reader.end();
  if (!verify(host.sigPub, concat(label("invite-sign/v1"), body), sig))
    throw new Error("Firma de invitación AGE incorrecta.");
  const r = new R(body);
  if (r.u32() !== 1) throw new Error("Invitación AGE de versión desconocida.");
  const id = r.str(),
    key = r.bytes(),
    params = r.str(),
    count = r.u32();
  if (count > 1000 || key.length !== 32)
    throw new Error("Invitación AGE no válida.");
  const members = [];
  for (let i = 0; i < count; i++) members.push({ nick: r.str(), fp: r.str() });
  const hostKey = r.bytes(),
    issued = r.u64(),
    expires = r.u64();
  r.end();
  const now = Date.now();
  if (
    !equal(hostKey, host.sigPub) ||
    issued > now + 300000 ||
    expires < now ||
    expires - issued > 86400000 ||
    !members.some(
      (m) =>
        m.fp === fingerprint(me) && m.nick.toLowerCase() === nick.toLowerCase(),
    )
  )
    throw new Error("Invitación expirada o no dirigida a esta identidad.");
  return { id, key, params, members, issued, expires };
}
function fragments(line, target) {
  if (Buffer.byteLength("PRIVMSG " + target + " :" + line + "\r\n") <= 480)
    return [line];
  const encoded = Buffer.from(line).toString("base64"),
    n = Math.ceil(encoded.length / 350);
  if (n > 64) throw new Error("Mensaje AGE demasiado grande.");
  const id = crypto.randomBytes(8).toString("hex");
  return Array.from(
    { length: n },
    (_, i) =>
      `AGE FRAG ${id} ${i + 1}/${n} ${encoded.slice(i * 350, (i + 1) * 350)}`,
  );
}
class Fragments {
  constructor() {
    this.pending = new Map();
  }
  receive(sender, line) {
    if (!line.startsWith("AGE FRAG ")) return line;
    const t = line.split(" "),
      m = /^(\d+)\/(\d+)$/.exec(t[3] || "");
    if (
      t.length !== 5 ||
      !m ||
      Number(m[1]) < 1 ||
      Number(m[1]) > Number(m[2]) ||
      Number(m[2]) > 64 ||
      !/^[A-Za-z0-9+/=]{1,350}$/.test(t[4])
    )
      throw new Error("Fragmento AGE no válido.");
    for (const [k, v] of this.pending)
      if (Date.now() - v.time > 60000) this.pending.delete(k);
    const key = sender.toLowerCase() + "|" + t[2],
      index = Number(m[1]) - 1,
      count = Number(m[2]);
    if (this.pending.size >= 32 && !this.pending.has(key))
      throw new Error("Demasiados fragmentos AGE.");
    let record = this.pending.get(key);
    if (!record || record.parts.length !== count) {
      record = { parts: Array(count).fill(null), time: Date.now() };
      this.pending.set(key, record);
    }
    record.parts[index] = t[4];
    if (record.parts.some((x) => x === null)) return null;
    this.pending.delete(key);
    const decoded = b64(record.parts.join("")).toString("utf8");
    if (!decoded.startsWith("AGE ") || decoded.startsWith("AGE FRAG "))
      throw new Error("Fragmentación AGE anidada rechazada.");
    return decoded;
  }
}
module.exports = {
  identity,
  fingerprint,
  ident,
  parseIdent,
  box,
  unbox,
  ephemeral,
  hello,
  openHello,
  ack,
  openAck,
  shared,
  Ratchet,
  Group,
  invite,
  openInvite,
  fragments,
  Fragments,
  safety,
};
