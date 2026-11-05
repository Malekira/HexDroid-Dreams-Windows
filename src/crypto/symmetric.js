"use strict";
// Interoperable HexDroid +AGM v1 and legacy FiSH (+OK). See Android wire specifications.
const { Blowfish } = require("egoroof-blowfish");
const {
  crypto,
  concat,
  hash,
  seal,
  open,
  safety,
  b64,
} = require("./primitives");
function context(me, target) {
  if (/^[#&+!]/.test(target)) return Buffer.from(target.toLowerCase());
  return Buffer.from(
    [me.toLowerCase(), target.toLowerCase()]
      .sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)))
      .join("\0"),
  );
}
class AgmCipher {
  constructor(key) {
    if (key.length !== 32)
      throw new Error("AGM necesita una clave aleatoria de 32 bytes.");
    this.key = Buffer.from(key);
    this.seen = new Map();
  }
  fingerprint() {
    return safety(hash(concat(Buffer.from([0]), this.key)), 8);
  }
  encrypt(text, me, target) {
    const nonce = crypto.randomBytes(12);
    return (
      "+AGM " +
      concat(
        Buffer.from([1]),
        nonce,
        seal(this.key, nonce, Buffer.from(text), context(me, target)),
      )
        .toString("base64")
        .replace(/=+$/, "")
    );
  }
  decrypt(text, me, target, { historical = false } = {}) {
    if (!text.startsWith("+AGM ")) throw new Error("Prefijo AGM no válido.");
    const raw = b64(text.slice(5));
    if (raw.length < 29 || raw[0] !== 1)
      throw new Error("Mensaje AGM truncado o de versión desconocida.");
    const nonce = raw.subarray(1, 13),
      id = context(me, target).toString("base64") + ":" + nonce.toString("hex");
    if (this.seen.has(id) && !historical)
      throw new Error("Repetición AGM rechazada.");
    const plaintext = open(
      this.key,
      nonce,
      raw.subarray(13),
      context(me, target),
    ).toString("utf8");
    this.seen.set(id, Date.now());
    if (this.seen.size > 4096) this.seen.delete(this.seen.keys().next().value);
    return plaintext;
  }
}
class FishCipher {
  constructor(key) {
    if (key.length < 4 || key.length > 56)
      throw new Error("FiSH requiere una clave de 4–56 bytes.");
    this.key = Buffer.from(key);
  }
  fingerprint() {
    return safety(hash(concat(Buffer.from([1]), this.key)), 8);
  }
  encrypt(text) {
    const iv = crypto.randomBytes(8),
      b = new Blowfish(this.key, Blowfish.MODE.CBC, Blowfish.PADDING.NULL);
    b.setIv(iv);
    return (
      "+OK *" +
      concat(iv, Buffer.from(b.encode(Buffer.from(text)))).toString("base64")
    );
  }
  decrypt(text) {
    if (!text.startsWith("+OK ")) throw new Error("Prefijo FiSH no válido.");
    let raw, mode, iv;
    if (text[4] === "*") {
      raw = b64(text.slice(5));
      if (raw.length < 16 || raw.length % 8)
        throw new Error("FiSH CBC truncado.");
      iv = raw.subarray(0, 8);
      raw = raw.subarray(8);
      mode = Blowfish.MODE.CBC;
    } else {
      const alphabet =
          "./0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
        body = text.slice(4);
      if (!body.length || body.length % 12)
        throw new Error("FiSH ECB no válido.");
      raw = Buffer.alloc((body.length / 12) * 8);
      for (let i = 0; i < body.length; i += 12) {
        let right = 0n,
          left = 0n;
        for (let j = 0; j < 6; j++) {
          const r = alphabet.indexOf(body[i + j]),
            l = alphabet.indexOf(body[i + j + 6]);
          if (r < 0 || l < 0) throw new Error("FiSH base64 no válido.");
          right |= BigInt(r) << BigInt(6 * j);
          left |= BigInt(l) << BigInt(6 * j);
        }
        if (right > 0xffffffffn || left > 0xffffffffn)
          throw new Error("Palabra FiSH fuera de rango.");
        raw.writeUInt32BE(Number(left), (i / 12) * 8);
        raw.writeUInt32BE(Number(right), (i / 12) * 8 + 4);
      }
      mode = Blowfish.MODE.ECB;
    }
    const b = new Blowfish(this.key, mode, Blowfish.PADDING.NULL);
    if (iv) b.setIv(iv);
    return Buffer.from(b.decode(raw, Blowfish.TYPE.UINT8_ARRAY))
      .toString("utf8")
      .replace(/\0+$/, "");
  }
}
module.exports = { AgmCipher, FishCipher, context };
