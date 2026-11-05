'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { validateProfile } = require('./irc');
const { sanitizeWorkspace } = require('./workspace');
const DEFAULTS = { fontSize: 14, sidebarWidth: 240, usersWidth: 192, showPrivates: true, showUsers: true, showTopic: true, timestamps: true, showEvents: true, compact: false, autoScroll: true, fontFamily: 'Segoe UI', lineHeight: 1.65, messageSpacing: 9, ownNickColor: '#c0adf1', privateSort: 'manual' };
function validateSettings(input) {
  const s = { ...DEFAULTS };
  if (!input || typeof input !== 'object') return s;
  for (const key of ['showPrivates','showUsers','showTopic','timestamps','showEvents','compact','autoScroll']) if (typeof input[key] === 'boolean') s[key] = input[key];
  if (Number.isFinite(input.fontSize)) s.fontSize = Math.max(11, Math.min(24, Math.round(input.fontSize)));
  if (Number.isFinite(input.sidebarWidth)) s.sidebarWidth = Math.max(160, Math.min(420, Math.round(input.sidebarWidth)));
  if (Number.isFinite(input.usersWidth)) s.usersWidth = Math.max(140, Math.min(360, Math.round(input.usersWidth)));
  if (Number.isFinite(input.lineHeight)) s.lineHeight = Math.max(1.2, Math.min(2.4, input.lineHeight));
  if (Number.isFinite(input.messageSpacing)) s.messageSpacing = Math.max(0, Math.min(20, Math.round(input.messageSpacing)));
  if (['Segoe UI','Consolas','Arial','Cascadia Mono'].includes(input.fontFamily)) s.fontFamily = input.fontFamily;
  if (typeof input.ownNickColor === 'string' && /^#[0-9a-f]{6}$/i.test(input.ownNickColor)) s.ownNickColor = input.ownNickColor;
  if (['manual','alphabetical','unread'].includes(input.privateSort)) s.privateSort = input.privateSort;
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
  return { version: 2, settings: validateSettings(data.settings), profiles, workspace: sanitizeWorkspace(data.workspace, profiles) };
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
      return { version: 2, settings: { ...DEFAULTS }, profiles: [], workspace: sanitizeWorkspace(null, []) };
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
