const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Workspace, sanitizeWorkspace, panelSizes } = require('../src/workspace');
const { sanitizeData, DEFAULTS } = require('../src/storage');
const profiles = ['one','two'].map(id => ({ id,name:id,nick:'Dreamer',host:'localhost',port:6667,tls:false,channels:[] }));
test('Networks, private drafts and channel messages remain independent', () => {
  const w = new Workspace(profiles);
  w.conversation('one','Alice').draft = 'private draft'; w.conversation('two','Alice').draft = 'other network';
  w.conversation('one','#room').draft = 'channel draft';
  w.choose('one','#room'); w.addMessage('one','#room',{nick:'Bob',text:'first'});
  w.choose('one','Alice'); assert.equal(w.conversation('one','Alice').draft,'private draft');
  assert.equal(w.conversation('two','Alice').draft,'other network'); assert.equal(w.conversation('one','#room').messages.length,1);
  assert.equal(w.conversation('one','Alice').kind,'private'); assert.equal(w.conversation('one','#room').kind,'channel');
});
test('Mentions and unread markers distinguish real messages from events and own messages', () => {
  const w = new Workspace(profiles); w.choose('one','#active');
  w.addMessage('one','#other',{id:'one',nick:'Alice',text:'Dreamer: hello'});
  w.addMessage('one','#other',{id:'one',nick:'Alice',text:'ordinary'});
  w.addMessage('one','#other',{nick:'Alice',text:'join',event:true});
  w.addMessage('one','#other',{nick:'Dreamer',text:'my reply',own:true});
  const c = w.conversation('one','#other'); assert.equal(c.unread,2); assert.equal(c.mentions,1);
  assert.equal(c.firstUnreadId,c.messages[0].id); assert.notEqual(c.messages[0].id,c.messages[1].id);
  w.choose('one','#other'); assert.equal(c.unread,0); c.follow = false;
  w.addMessage('one','#other',{nick:'Alice',text:'while reading'}); assert.equal(c.unread,1);
});
test('Order, silence and active conversation survive serialization without messages or drafts', () => {
  const w = new Workspace(profiles); w.choose('one','#a'); w.conversation('one','#b').muted = true;
  w.conversation('one','Alice').draft = 'private password'; w.conversation('one','Alice').messages.push({text:'private text'});
  assert.equal(w.move('one','#b','#a'),true); assert.equal(w.move('one','Alice','#a'),false);
  const saved = w.serialize(), json = JSON.stringify(saved);
  assert.ok(!json.includes('private password')); assert.ok(!json.includes('private text'));
  const restored = new Workspace(profiles,saved);
  assert.deepEqual([...restored.network('one').conversations.values()].filter(c => c.kind === 'channel').map(c => c.name),['#b','#a']);
  assert.equal(restored.conversation('one','#b').muted,true); assert.equal(restored.active.target,'#a');
});
test('Workspace imports reject unknown networks and duplicates and bound data sizes', () => {
  const saved = sanitizeWorkspace({networks:[{id:'one',conversations:[{name:'#a'},{name:'#A'},{name:'bad\r\nOPER'},{name:'Alice',muted:true,draft:'secret'}]},{id:'unknown',conversations:[{name:'X'}]}],active:{id:'unknown',target:'X'}},profiles);
  assert.equal(saved.networks.length,2); assert.equal(saved.networks[0].conversations.length,2); assert.equal(saved.active,null);
  assert.equal(saved.networks[0].conversations[1].draft,undefined);
  const migrated = sanitizeData({version:1,settings:{sidebarWidth:300},profiles});
  assert.equal(migrated.version,2); assert.equal(migrated.settings.sidebarWidth,300); assert.equal(migrated.settings.usersWidth,192);
});
test('Panel layout keeps chat usable at small widths without losing preferred dimensions', () => {
  const settings = {...DEFAULTS,sidebarWidth:420,usersWidth:360}; const size = panelSizes(820,settings);
  assert.ok(size.left + size.right + 10 <= 460); assert.equal(settings.sidebarWidth,420);
  assert.deepEqual(panelSizes(1600,settings),{left:420,right:360});
  assert.equal(panelSizes(820,{...settings,showPrivates:false}).left,0);
});
