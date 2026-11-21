"use strict";
const fs = require("node:fs"),
  path = require("node:path");
function redactProtocol(line) {
  const command = String(line)
    .replace(/^@[^ ]+ /, "")
    .replace(/^:[^ ]+ /, "");
  if (/^(?:PASS|AUTHENTICATE|OPER|LOGIN|VALIDATE|IDENTIFY|WEBPUSH|BOUNCER)\b/i.test(command))
    return command.split(" ")[0] + " [omitido]";
  if (/^(?:FAIL|WARN|NOTE) WEBPUSH\b/i.test(command))
    return command.split(" ").slice(0, 2).join(" ") + " [omitido]";
  if (/^(?:MODE|324)\b.* [+-][^ ]*k/i.test(command))
    return command.split(" ")[0] + " [clave de canal omitida]";
  if (/^(?:PRIVMSG|NOTICE) /i.test(command))
    return command.replace(/ :[\s\S]*/, " :[contenido omitido]");
  return command.slice(0, 1000);
}
class ProtocolLog {
  constructor(directory, storage) {
    this.file = path.join(directory, "protocol.secure.log");
    this.storage = storage;
  }
  append(network, direction, line) {
    if (
      !this.storage.isEncryptionAvailable() ||
      this.storage.getSelectedStorageBackend?.() === "basic_text"
    )
      throw new Error(
        "Los registros de protocolo requieren el almacén seguro.",
      );
    const value = JSON.stringify({
      time: new Date().toISOString(),
      network,
      direction,
      line: redactProtocol(line),
    });
    if (fs.existsSync(this.file) && fs.statSync(this.file).size > 2097152)
      fs.renameSync(this.file, this.file + ".previous");
    fs.appendFileSync(
      this.file,
      this.storage.encryptString(value).toString("base64") + "\n",
      { mode: 0o600 },
    );
  }
  read() {
    if (!fs.existsSync(this.file)) return [];
    return fs
      .readFileSync(this.file, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) =>
        JSON.parse(this.storage.decryptString(Buffer.from(line, "base64"))),
      );
  }
}
module.exports = { ProtocolLog, redactProtocol };
