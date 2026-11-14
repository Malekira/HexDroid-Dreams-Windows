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
test('Real name survives past 200 characters and rejects oversized wire data instead of silently cutting it',()=>{
 const {validateProfile}=require('../src/services/profiles');const p=data.profiles[0];const realName='\x0313'+('Nombre 🌙 ').repeat(26)+'\x0f';assert.ok(realName.length>200);assert.equal(validateProfile({...p,realName}).realName,realName);assert.throws(()=>validateProfile({...p,realName:'🌙'.repeat(140)}),/no se ha recortado/);
});
test('Named themes preserve visual settings while excluding credentials and nested saved themes',()=>{
 const s=validateSettings({savedThemes:[{id:'my-theme',name:'Morado mío',settings:{theme:'violet',fontSize:18,roomAppearance:{background:'#112233'},customColors:{accent:'#bb77ee'},password:'secret',savedThemes:[{id:'evil'}]}}]});
 assert.equal(s.savedThemes.length,1);const t=s.savedThemes[0].settings;assert.equal(t.theme,'violet');assert.equal(t.roomAppearance.background,'#112233');assert.equal(t.fontSize,18);assert.equal(t.password,undefined);assert.equal(t.savedThemes,undefined);assert.equal(validateSettings({savedThemes:[...s.savedThemes,...s.savedThemes]}).savedThemes.length,1);
});
test('Point spacing, separate window background and restore limits persist while old spacing remains compatible',()=>{const s=validateSettings({lineHeight:1.8,messageSpacing:10,lineHeightPt:18.2,messageSpacingPt:4.5,historyRoomRows:20,historyPrivateRows:40,roomAppearance:{background:'#ffffff',windowBackground:'#34205a'}});assert.equal(s.lineHeightPt,18.2);assert.equal(s.messageSpacingPt,4.5);assert.equal(s.roomAppearance.windowBackground,'#34205a');assert.equal(s.historyRoomRows,20);assert.equal(s.historyPrivateRows,40);const old=validateSettings({lineHeight:1.8,messageSpacing:10,historyEnabled:true});assert.equal(old.lineHeightPt,null);assert.equal(old.lineHeight,1.8);assert.equal(old.historyRoomRows,300);assert.equal(validateSettings({historyRoomRows:99999}).historyRoomRows,600);});
