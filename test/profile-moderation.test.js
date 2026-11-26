'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {roomFor}=require('../src/profile-moderation-policy');
function network(){return {state:'connected',nick:'Me',prefixes:'~&@%+',prefixModes:'qaohv',conversations:new Map([['#a',{name:'#a',kind:'channel',joined:true,users:['@Me','Alice']}],['#b',{name:'#b',kind:'channel',joined:true,users:['+Me','Bob']}]])};}
test('profile bans require shared joined room and moderator privileges',()=>{
 const n=network();assert.equal(roomFor(n,'alice'),'#a');assert.equal(roomFor(n,'Bob'),null);assert.equal(roomFor(n,'Absent'),null);
 n.conversations.get('#a').users=['+Me','Alice'];assert.equal(roomFor(n,'Alice'),null);
 n.conversations.get('#a').users=['%Me','Alice'];assert.equal(roomFor(n,'Alice'),'#a');
 n.conversations.get('#a').joined=false;assert.equal(roomFor(n,'Alice'),null);
});
test('disconnected networks and stale profile users do not expose bans',()=>{const n=network();n.state='disconnected';assert.equal(roomFor(n,'Alice'),null);assert.equal(roomFor(null,'Alice'),null);});
