'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Store, DEFAULTS, sanitizeData, validateSettings } = require('../src/storage');
const data = { settings: { ...DEFAULTS, sidebarWidth: 320, showUsers: false }, profiles: [{ id: 'libera', name: 'Libera', host: 'irc.libera.chat', port: 6697, nick: 'Dreamer', tls: true, channels: ['#dreams'], password: 'MUST_NOT_PERSIST' }] };
test('Saved profiles and layout survive reopening without persisting passwords', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dreams-store-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const store = new Store(dir); store.save(data);
  const reopened = new Store(dir).load();
  assert.equal(reopened.settings.sidebarWidth, 320); assert.equal(reopened.settings.showUsers, false);
  assert.equal(reopened.profiles[0].host, 'irc.libera.chat'); assert.equal(reopened.profiles[0].password, undefined);
  assert.ok(!fs.readFileSync(store.file, 'utf8').includes('MUST_NOT_PERSIST'));
  store.save({ ...data, settings: { ...DEFAULTS, fontSize: 18 } });
  assert.equal(new Store(dir).load().settings.fontSize, 18); assert.ok(!fs.existsSync(store.file + '.tmp'));
});
test('Corrupt configuration is backed up and does not stop the next launch', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dreams-corrupt-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'settings.json'), '{broken'); const warnings = [];
  const store = new Store(dir, m => warnings.push(m)), loaded = store.load();
  assert.deepEqual(loaded.settings, DEFAULTS); assert.equal(warnings.length, 1);
  const backup = fs.readdirSync(dir).find(name => name.startsWith('settings.json.recovery-'));
  assert.equal(fs.readFileSync(path.join(dir, backup), 'utf8'), '{broken');
  store.save({ settings: loaded.settings, profiles: [] }); assert.deepEqual(new Store(dir).load().profiles, []);
});
test('Settings are bounded and profile identifiers cannot collide', () => {
  const settings = validateSettings({ fontSize: 999, sidebarWidth: -100, showUsers: 'no' });
  assert.equal(settings.fontSize, 24); assert.equal(settings.sidebarWidth, 160); assert.equal(settings.showUsers, true);
  assert.throws(() => sanitizeData({ ...data, profiles: [data.profiles[0], data.profiles[0]] }), /Identificador/);
});
