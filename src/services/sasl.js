"use strict";
const crypto = require("node:crypto");
const saslprep =
  require("@mongodb-js/saslprep").saslprep || require("@mongodb-js/saslprep");
function base64(value) {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(value) ||
    value.length > 32768 ||
    value.length % 4 === 1
  )
    throw new Error("Base64 SASL no válido.");
  const b = Buffer.from(value, "base64");
  if (b.toString("base64").replace(/=+$/, "") !== value.replace(/=+$/, ""))
    throw new Error("Base64 SASL no canónico.");
  return b;
}
function attributes(text) {
  const result = Object.create(null);
  for (const item of text.split(",")) {
    if (!/^[a-z]=/.test(item) || Object.hasOwn(result, item[0]))
      throw new Error("Desafío SCRAM no válido.");
    result[item[0]] = item.slice(2);
  }
  if (result.m) throw new Error("Extensión SCRAM obligatoria no soportada.");
  return result;
}
class ScramSha256 {
  constructor(
    username,
    password,
    nonce = crypto.randomBytes(24).toString("base64"),
  ) {
    this.username = saslprep(username);
    this.password = saslprep(password);
    this.nonce = nonce;
    this.step = 0;
    this.bare = `n=${this.username.replace(/=/g, "=3D").replace(/,/g, "=2C")},r=${nonce}`;
  }
  first() {
    this.step = 1;
    return "n,," + this.bare;
  }
  challenge(text) {
    if (this.step === 1) {
      const a = attributes(text),
        iterations = Number(a.i);
      if (
        !a.r?.startsWith(this.nonce) ||
        a.r.length <= this.nonce.length ||
        !Number.isSafeInteger(iterations) ||
        iterations < 4096 ||
        iterations > 1000000
      )
        throw new Error("Nonce o coste SCRAM rechazado.");
      const salt = base64(a.s);
      if (salt.length < 8 || salt.length > 1024)
        throw new Error("Sal SCRAM no válida.");
      const salted = crypto.pbkdf2Sync(
        this.password,
        salt,
        iterations,
        32,
        "sha256",
      );
      this.password = "";
      const clientKey = crypto
        .createHmac("sha256", salted)
        .update("Client Key")
        .digest();
      const storedKey = crypto.createHash("sha256").update(clientKey).digest();
      const final = `c=biws,r=${a.r}`,
        auth = `${this.bare},${text},${final}`;
      const signature = crypto
        .createHmac("sha256", storedKey)
        .update(auth)
        .digest();
      const proof = Buffer.from(clientKey.map((b, i) => b ^ signature[i]));
      this.expected = crypto
        .createHmac(
          "sha256",
          crypto.createHmac("sha256", salted).update("Server Key").digest(),
        )
        .update(auth)
        .digest();
      salted.fill(0);
      clientKey.fill(0);
      this.step = 2;
      return `${final},p=${proof.toString("base64")}`;
    }
    if (this.step === 2) {
      const a = attributes(text);
      if (a.e || !a.v) throw new Error("El servidor rechazó SCRAM.");
      const signature = base64(a.v);
      if (
        signature.length !== this.expected.length ||
        !crypto.timingSafeEqual(signature, this.expected)
      )
        throw new Error("Firma SCRAM del servidor incorrecta.");
      this.expected.fill(0);
      this.verified = true;
      this.step = 3;
      return "";
    }
    throw new Error("Estado SCRAM no válido.");
  }
}
module.exports = { ScramSha256, base64 };
