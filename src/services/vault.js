'use strict';
const fs = require('node:fs');
const path = require('node:path');
class SecretVault {
  constructor(directory, storage) { this.file = path.join(directory,'secrets.bin'); this.storage = storage; this.values = null; }
  available() {
    return this.storage.isEncryptionAvailable() && (!this.storage.getSelectedStorageBackend || this.storage.getSelectedStorageBackend() !== 'basic_text');
  }
  load() {
    if (this.values) return;
    if (!this.available()) throw new Error('El almacén seguro del sistema no está disponible. No se guardarán secretos sin cifrar.');
    if (!fs.existsSync(this.file)) this.values = Object.create(null);
    else {
      const parsed = JSON.parse(this.storage.decryptString(fs.readFileSync(this.file)));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Almacén seguro no válido.');
      this.values = Object.assign(Object.create(null),parsed);
    }
  }
  get(key) { this.load(); return structuredClone(this.values[key]); }
  keys() { this.load(); return Object.keys(this.values); }
  set(key,value) {
    if (typeof key !== 'string' || key.length > 500) throw new Error('Identificador de secreto no válido.');
    this.load(); const next = Object.assign(Object.create(null),this.values);
    if (value === undefined) delete next[key]; else next[key] = structuredClone(value);
    const encrypted = this.storage.encryptString(JSON.stringify(next));
    fs.mkdirSync(path.dirname(this.file),{recursive:true}); const temp=this.file+'.tmp'; fs.writeFileSync(temp,encrypted,{mode:0o600}); fs.renameSync(temp,this.file); this.values=next;
  }
  exportValues() { this.load(); return structuredClone(this.values); }
}
module.exports = { SecretVault };
