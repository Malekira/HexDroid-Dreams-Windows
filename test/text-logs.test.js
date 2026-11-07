"use strict";
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {TextLogs}=require('../src/services/text-logs');
const {Runtime}=require('../src/services/runtime');
const {validateSettings}=require('../src/storage');
function fixture(t){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'hexdreams-txt-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));return new TextLogs(directory);}
const profile={id:'network-1',name:'Mi red',host:'localhost'},time='2026-11-07T03:04:05Z';
test('TXT logs separate rooms, private conversations and networks with timestamps and no IRC colors',t=>{
 const logs=fixture(t);logs.append(profile,{target:'#Dreams',nick:'Hannii',text:'\x02\x0313Hola 🦆\x0f',time});logs.append(profile,{target:'Amigo',nick:'Amigo',text:'Privado',time});logs.append({...profile,id:'network-2'},{target:'#Dreams',nick:'Otro',text:'Otra red',time});
 const room=logs.file(profile,'#dreams'),pv=logs.file(profile,'Amigo'),second=logs.file({...profile,id:'network-2'},'#Dreams');assert.notEqual(room,pv);assert.notEqual(room,second);assert.ok(room.includes(path.sep+'salas'+path.sep));assert.ok(pv.includes(path.sep+'privados'+path.sep));
 const text=fs.readFileSync(room,'utf8');assert.ok(text.startsWith('\ufeffHexDreams IRC'));assert.ok(text.includes('<Hannii> Hola 🦆'));assert.ok(!/[\x02\x03\x04\x0f\x1b]/.test(text));assert.ok(!text.includes('Privado'));assert.ok(!text.includes('Otra red'));const stamp=/\[([^\]]+)\]/.exec(text)[1];assert.equal(Date.parse(stamp.replace(' ','T')),Date.parse(time));assert.ok(text.endsWith('\r\n'));
});
test('Echo confirmation does not duplicate a TXT row, but two intentionally repeated sends are retained',t=>{
 const logs=fixture(t),m={target:'Amigo',nick:'Me',text:'Igual',time,clientId:'local-1'};logs.append(profile,m);logs.append(profile,{...m,messageId:'server-1'});logs.append(profile,{...m,clientId:undefined,messageId:'server-1'});logs.append(profile,{...m,clientId:'local-2'});const text=fs.readFileSync(logs.file(profile,'Amigo'),'utf8');assert.equal(text.match(/<Me> Igual/g).length,2);
});
test('TXT names cannot escape the log folder and sanitized names cannot collide',t=>{
 const logs=fixture(t),a=logs.file({id:'../../outside'},'#../../bad?name'),b=logs.file({id:'../../outside'},'#../../bad*name');assert.ok(a.startsWith(logs.directory+path.sep));assert.notEqual(a,b);assert.ok(!a.slice(logs.directory.length).includes('..'+path.sep));assert.equal(logs.file(profile,'*'),null);assert.equal(logs.file(profile,'*consultas*'),null);assert.match(path.basename(logs.file(profile,'CON')),/^_con--/);
});
test('TXT append survives reopening and prefixes every line of multiline messages',t=>{
 const logs=fixture(t),directory=path.dirname(logs.directory);logs.append(profile,{target:'#one',nick:'Me',text:'Primera\nSegunda',time});const reopened=new TextLogs(directory);reopened.append(profile,{target:'#one',event:true,text:'Alice → Alicia cambió de nick',time});const text=fs.readFileSync(logs.file(profile,'#one'),'utf8');assert.equal(text.match(/HexDreams IRC/g).length,1);assert.equal(text.match(/^\[/gm).length,3);assert.ok(text.includes('*** Alice → Alicia'));assert.equal(reopened.append(profile,{target:'#one',historical:true,nick:'Me',text:'Historia antigua',time}),false);
});
test('Runtime writes TXT after credential redaction and respects its separate opt-out',async t=>{
 const logs=fixture(t);let enabled=true;const context={getConfig:()=>({settings:{textLogsEnabled:enabled,historyEnabled:false,ignoredUsers:{}},profiles:[profile]}),textLogs:logs,cryptoAdapters:new Map([[profile.id,{receive:m=>m}]]),scripts:{event:async(_type,data)=>({halted:false,text:data.text})},emit(){},notify(){},writeTextLog:Runtime.prototype.writeTextLog};
 await Runtime.prototype.receive.call(context,profile.id,'message',{target:'NickServ',nick:'Me',own:true,text:'identify secreto',time});let text=fs.readFileSync(logs.file(profile,'NickServ'),'utf8');assert.ok(text.includes('[Credenciales omitidas]'));assert.ok(!text.includes('secreto'));enabled=false;await Runtime.prototype.receive.call(context,profile.id,'message',{target:'NickServ',nick:'Me',own:true,text:'No guardar',time});text=fs.readFileSync(logs.file(profile,'NickServ'),'utf8');assert.ok(!text.includes('No guardar'));assert.equal(validateSettings({}).textLogsEnabled,true);assert.equal(validateSettings({textLogsEnabled:false}).textLogsEnabled,false);
});
test('Network identifiers retain case sensitivity while IRC conversation names are case-insensitive',t=>{
 const logs=fixture(t);assert.notEqual(logs.file({id:'Net'},'Alice'),logs.file({id:'net'},'Alice'));assert.equal(logs.file(profile,'ALICE'),logs.file(profile,'Alice'));assert.equal(logs.file(profile,'*CONSULTAS*'),null);
});
