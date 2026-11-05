'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { validateProfile } = require('./irc');
const DEFAULTS = { fontSize: 14, sidebarWidth: 240, showUsers: true, timestamps: true, showEvents: true, compact: false, autoScroll: true };
function validateSettings(input) {
  const s = { ...DEFAULTS };
  if (!input || typeof input !== 'object') return s;
  for (const key of ['showUsers','timestamps','showEvents','compact','autoScroll']) if (typeof input[key] === 'boolean') s[key] = input[key];
  if (Number.isFinite(input.fontSize)) s.fontSize = Math.max(11, Math.min(24, Math.round(input.fontSize)));
  if (Number.isFinite(input.sidebarWidth)) s.sidebarWidth = Math.max(160, Math.min(420, Math.round(input.sidebarWidth)));
  return s;
}
function sanitizeData(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.profiles) || data.profiles.length > 30) throw new Error('Configuración de redes no válida.');
  const seen = new Set();
  const profiles = data.profiles.map(p => {
    if (typeof p.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(p.id) || seen.has(p.id)) throw new Error('Identificador de red no válido.');
    seen.add(p.id);
    const profile = validateProfile(p);
    return { id: p.id, name: typeof p.name === 'string' ? p.name.slice(0,80) : p.host, ...profile };
  });
  return { version: 1, settings: validateSettings(data.settings), profiles };
}
class Store {
  constructor(directory, report = () => {}) { this.directory = directory; this.file = path.join(directory, 'settings.json'); this.report = report; }
  load() {
    try { return sanitizeData(JSON.parse(fs.readFileSync(this.file, 'utf8'))); }
    catch (e) {
      if (e.code !== 'ENOENT') {
        this.report('No se pudo leer la configuración. Se usarán valores iniciales. ' + e.message);
        try { fs.copyFileSync(this.file, this.file + '.recovery-' + Date.now()); } catch {}
      }
      return { version: 1, settings: { ...DEFAULTS }, profiles: [] };
    }
  }
  save(data) {
    const safe = sanitizeData(data); fs.mkdirSync(this.directory, { recursive: true });
    const temp = this.file + '.tmp';
    fs.writeFileSync(temp, JSON.stringify(safe, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temp, this.file); return safe;
  }
}
module.exports = { Store, DEFAULTS, validateSettings, sanitizeData };
