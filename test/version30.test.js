'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {IrcClient}=require('../src/irc'),{SessionManager}=require('../src/services/sessions'),{Presence}=require('../src/services/presence');
test('Session startup executes login commands, waits for room confirmations, then starts Notify',t=>{
 t.mock.timers.enable({apis:['setTimeout']});let client;const wire=[];
 const manager=new SessionManager({clientFactory:p=>{client=new IrcClient(p);client.connect=()=>{};client.sendRaw=line=>{wire.push(line);client.presence.observe(line);};return client;}});
 manager.connect({id:'a',host:'localhost',port:6667,nick:'Me',tls:false,channels:['#one','#two'],commands:[],commandDelay:1000,notifyNicks:['Alice']},{commands:['/identify secret','/mode Me +x']});
 client.receive(Buffer.from(':s 001 Me :Welcome\r\n:s 005 Me MONITOR=30 :supported\r\n'));assert.deepEqual(wire,[]);
 t.mock.timers.tick(0);assert.deepEqual(wire,['PRIVMSG NickServ :IDENTIFY secret']);t.mock.timers.tick(1000);assert.deepEqual(wire.slice(0,4),['PRIVMSG NickServ :IDENTIFY secret','MODE Me +x','JOIN #one','JOIN #two']);assert.ok(!wire.some(l=>/^(MONITOR|ISON)/.test(l)));
 client.receive(Buffer.from(':Me!u@h JOIN :#one\r\n'));assert.ok(!wire.some(l=>/^(MONITOR|ISON)/.test(l)));
 client.receive(Buffer.from(':Me!u@h JOIN :#two\r\n'));assert.ok(wire.includes('MONITOR + Alice'));assert.equal(client.startupPending,false);client.presence.stop();client.clones.stop();manager.close();
});
test('A rejected startup room does not leave Notify blocked after other rooms were joined',t=>{
 t.mock.timers.enable({apis:['setTimeout']});let client;const wire=[];const manager=new SessionManager({clientFactory:p=>{client=new IrcClient(p);client.connect=()=>{};client.sendRaw=l=>wire.push(l);return client;}});
 manager.connect({id:'a',host:'localhost',port:6667,nick:'Me',channels:['#one','#locked'],commands:[],notifyNicks:['Alice']});client.receive(Buffer.from(':s 001 Me :Welcome\r\n:s 005 Me MONITOR=30 :supported\r\n'));t.mock.timers.tick(0);client.receive(Buffer.from(':Me!u@h JOIN :#one\r\n:s 473 Me #locked :Invite only\r\n'));assert.equal(client.startupPending,false);assert.ok(wire.includes('MONITOR + Alice'));client.presence.stop();client.clones.stop();manager.close();
});
test('Notify respects advertised MONITOR capacity and polls remaining nicks using ISON',()=>{
 const wire=[],events=[],client={ready:true,nick:'Me',profile:{nick:'Me'},emit:(...args)=>events.push(args)};const p=new Presence(client,['Alice','Bob','Carol']);client.sendRaw=l=>{wire.push(l);p.observe(l);};p.setMonitor(true,2);assert.ok(wire.includes('MONITOR + Alice,Bob'));assert.ok(!wire.some(l=>l.startsWith('MONITOR + ')&&l.includes('Carol')));assert.ok(wire.includes('ISON Carol'));p.handle({command:'303',params:['Me','Carol']});assert.equal(p.snapshot().find(n=>n.nick==='Carol').online,true);p.stop();
});
