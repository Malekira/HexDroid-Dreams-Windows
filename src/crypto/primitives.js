"use strict";
const crypto = require("node:crypto");
const buffer = (x) => (Buffer.isBuffer(x) ? x : Buffer.from(x));
const concat = (...xs) => Buffer.concat(xs.map(buffer));
const hash = (x) => crypto.createHash("sha256").update(x).digest();
const mac = (key, text) =>
  crypto.createHmac("sha256", key).update(text).digest();
const hkdf = (key, salt, info, length) =>
  Buffer.from(crypto.hkdfSync("sha256", key, salt, info, length));
const equal = (a, b) =>
  Buffer.isBuffer(a) &&
  Buffer.isBuffer(b) &&
  a.length === b.length &&
  crypto.timingSafeEqual(a, b);
function privateKey(seed, kind) {
  if (seed.length !== 32) throw new Error("Semilla no válida.");
  return crypto.createPrivateKey({
    key: concat(
      Buffer.from(
        kind === "ed"
          ? "302e020100300506032b657004220420"
          : "302e020100300506032b656e04220420",
        "hex",
      ),
      seed,
    ),
    format: "der",
    type: "pkcs8",
  });
}
function publicKey(raw, kind) {
  if (raw.length !== 32) throw new Error("Clave pública no válida.");
  return crypto.createPublicKey({
    key: concat(
      Buffer.from(
        kind === "ed" ? "302a300506032b6570032100" : "302a300506032b656e032100",
        "hex",
      ),
      raw,
    ),
    format: "der",
    type: "spki",
  });
}
function publicFrom(seed, kind) {
  return crypto
    .createPublicKey(privateKey(seed, kind))
    .export({ format: "der", type: "spki" })
    .subarray(-32);
}
const sign = (seed, data) => crypto.sign(null, data, privateKey(seed, "ed"));
function verify(pub, data, signature) {
  try {
    return (
      signature.length === 64 &&
      crypto.verify(null, data, publicKey(pub, "ed"), signature)
    );
  } catch {
    return false;
  }
}
function dh(seed, pub) {
  const result = crypto.diffieHellman({
    privateKey: privateKey(seed, "dh"),
    publicKey: publicKey(pub, "dh"),
  });
  if (equal(result, Buffer.alloc(32)))
    throw new Error("Clave DH de orden bajo rechazada.");
  return result;
}
function seal(key, nonce, text, aad) {
  const c = crypto.createCipheriv("aes-256-gcm", key, nonce);
  c.setAAD(aad);
  return concat(c.update(text), c.final(), c.getAuthTag());
}
function open(key, nonce, text, aad) {
  if (text.length < 16) throw new Error("Mensaje cifrado truncado.");
  const c = crypto.createDecipheriv("aes-256-gcm", key, nonce);
  c.setAAD(aad);
  c.setAuthTag(text.subarray(-16));
  return concat(c.update(text.subarray(0, -16)), c.final());
}
class Writer {
  constructor() {
    this.parts = [];
  }
  u32(x) {
    if (!Number.isInteger(x) || x < 0 || x > 0xffffffff)
      throw new Error("Entero de protocolo no válido.");
    const b = Buffer.alloc(4);
    b.writeUInt32BE(x);
    this.parts.push(b);
    return this;
  }
  u64(x) {
    const b = Buffer.alloc(8);
    b.writeBigUInt64BE(BigInt(x));
    this.parts.push(b);
    return this;
  }
  bytes(x) {
    const b = buffer(x);
    this.u32(b.length);
    this.parts.push(b);
    return this;
  }
  str(x) {
    return this.bytes(Buffer.from(x, "utf8"));
  }
  build() {
    return Buffer.concat(this.parts);
  }
}
class Reader {
  constructor(b) {
    this.b = buffer(b);
    this.at = 0;
  }
  raw(n) {
    if (n < 0 || this.at + n > this.b.length) throw new Error("TLV truncado.");
    const r = this.b.subarray(this.at, this.at + n);
    this.at += n;
    return r;
  }
  u32() {
    return this.raw(4).readUInt32BE();
  }
  u64() {
    const n = this.raw(8).readBigUInt64BE();
    if (n > BigInt(Number.MAX_SAFE_INTEGER))
      throw new Error("Entero fuera de rango.");
    return Number(n);
  }
  bytes() {
    return this.raw(this.u32());
  }
  str() {
    return new TextDecoder("utf8", { fatal: true }).decode(this.bytes());
  }
  end() {
    if (this.at !== this.b.length)
      throw new Error("Datos sobrantes en el mensaje.");
  }
}
function safety(bytes, chars = 16) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let bits = 0,
    acc = 0,
    out = "";
  for (const b of bytes) {
    acc = (acc << 8) | b;
    bits += 8;
    while (bits >= 5 && out.length < chars) {
      bits -= 5;
      out += alphabet[(acc >>> bits) & 31];
    }
    if (out.length === chars) break;
  }
  return out.match(/.{1,4}/g).join("-");
}
function b64(s) {
  if (
    typeof s !== "string" ||
    s.length > 100000 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(s) ||
    s.length % 4 === 1
  )
    throw new Error("Base64 no válido.");
  const b = Buffer.from(s, "base64");
  if (b.toString("base64").replace(/=+$/, "") !== s.replace(/=+$/, ""))
    throw new Error("Base64 no canónico.");
  return b;
}
module.exports = {
  crypto,
  buffer,
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
  Writer,
  Reader,
  safety,
  b64,
};
