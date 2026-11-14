"use strict";
const crypto = require("node:crypto");
const { promisify } = require("node:util");
const { sanitizeData } = require("../storage");
const scrypt = promisify(crypto.scrypt);
async function derive(password, salt) {
  return scrypt(password, salt, 32, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
}
async function createBackup(config, secrets, password, history, sections) {
  const result = {
    format: "hexdroid-dreams-backup",
    version: 1,
    created: new Date().toISOString(),
    config: sanitizeData(config),
  };
  if(sections)result.sections=require("./config-selection").selection(sections);
  if(history)result.history=validateHistory(history,result.config);
  if (secrets) {
    if (typeof password !== "string" || password.length < 12)
      throw new Error(
        "Usa una frase de paso de al menos 12 caracteres para exportar secretos.",
      );
    const salt = crypto.randomBytes(16),
      iv = crypto.randomBytes(12),
      key = await derive(password, salt);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(Buffer.from("hexdroid-dreams-backup/v1"));
    const data = Buffer.concat([
      cipher.update(JSON.stringify(secrets), "utf8"),
      cipher.final(),
    ]);
    key.fill(0);
    result.secrets = {
      kdf: "scrypt-32768-8-1",
      salt: salt.toString("base64"),
      iv: iv.toString("base64"),
      data: data.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
    };
  }
  return JSON.stringify(result, null, 2);
}
async function readBackup(text, password) {
  if (typeof text !== "string" || Buffer.byteLength(text) > 64 * 1024 * 1024)
    throw new Error("Respaldo demasiado grande.");
  const parsed = JSON.parse(text);
  if (parsed.format !== "hexdroid-dreams-backup" || parsed.version !== 1)
    throw new Error("Formato de respaldo no reconocido.");
  const result = { config: sanitizeData(parsed.config) };
  if(parsed.sections)result.sections=require("./config-selection").selection(parsed.sections);
  if(parsed.history)result.history=validateHistory(parsed.history,result.config);
  if (parsed.secrets) {
    const s = parsed.secrets;
    if (s.kdf !== "scrypt-32768-8-1" || typeof password !== "string")
      throw new Error("El respaldo requiere su frase de paso.");
    const salt = Buffer.from(s.salt, "base64"),
      iv = Buffer.from(s.iv, "base64"),
      tag = Buffer.from(s.tag, "base64");
    if (salt.length !== 16 || iv.length !== 12 || tag.length !== 16)
      throw new Error("Respaldo cifrado no válido.");
    const key = await derive(password, salt),
      decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    try {
      decipher.setAAD(Buffer.from("hexdroid-dreams-backup/v1"));
      decipher.setAuthTag(tag);
      result.secrets = JSON.parse(
        Buffer.concat([
          decipher.update(Buffer.from(s.data, "base64")),
          decipher.final(),
        ]).toString("utf8"),
      );
    } catch {
      throw new Error("Frase incorrecta o respaldo alterado.");
    } finally {
      key.fill(0);
    }
  }
  return result;
}
function validateHistory(rows,config){
 if(!Array.isArray(rows)||rows.length>100000)throw new Error('Historial de respaldo demasiado grande.');
 const ids=new Set(config.profiles.map(p=>p.id));let bytes=0;
 return rows.map(m=>{if(!ids.has(m.network)||typeof m.target!=='string'||!m.target||m.target.length>200||/[\s\0\r\n:,]/.test(m.target)||typeof m.text!=='string'||m.text.length>10000||typeof m.nick!=='string'||m.nick.length>200||!Number.isFinite(Date.parse(m.time)))throw new Error('Historial de respaldo no válido.');bytes+=Buffer.byteLength(m.text);if(bytes>52428800)throw new Error('Historial de respaldo demasiado grande.');return{network:m.network,target:m.target,nick:m.nick,text:m.text,time:new Date(m.time).toISOString(),messageId:typeof m.messageId==='string'?m.messageId.slice(0,500):null,clientId:typeof m.clientId==='string'?m.clientId.slice(0,500):null,own:!!m.own,action:!!m.action,event:!!m.event};});
}
module.exports = { createBackup, readBackup };
