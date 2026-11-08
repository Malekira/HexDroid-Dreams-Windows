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
test('Four log categories have independent switches; viewer searches status and WHOIS safely',t=>{
 const logs=fixture(t);logs.configure({textLogRooms:false,textLogPrivates:true,textLogStatus:true,textLogQueries:true});
 assert.equal(logs.append(profile,{target:'#room',nick:'A',text:'hidden'}),false);for(const target of ['Alice','*','*consultas*'])logs.append(profile,{target,nick:'A',text:'Buscar 💋',time});
 assert.equal(logs.files().length,3);assert.equal(logs.search('buscar').length,3);const entry=logs.files()[0];assert.ok(logs.read(entry.id).text.includes('Buscar 💋'));assert.equal(logs.search('💋',entry.id).length,1);assert.throws(()=>logs.read('../settings.json'));assert.throws(()=>logs.read('/etc/passwd'));
 const outside=fs.mkdtempSync(path.join(os.tmpdir(),'outside-'));t.after(()=>fs.rmSync(outside,{recursive:true,force:true}));fs.writeFileSync(path.join(outside,'secret.txt'),'secret');try{fs.symlinkSync(outside,path.join(logs.directory,'external'),'dir');assert.equal(logs.files().length,3);}catch(e){if(!['EPERM','EACCES'].includes(e.code))throw e;}
});
test('TXT retention and file limits retain recent lines and zero leaves history unlimited',t=>{
 const logs=fixture(t);logs.configure({textLogDays:2,textLogMaxMB:1});logs.append(profile,{target:'Old',nick:'Me',text:'old'});const old=logs.file(profile,'Old');const date=new Date(Date.now()-3*86400000);fs.utimesSync(old,date,date);logs.lastPrune=0;logs.prune();assert.equal(fs.existsSync(old),false);
 for(let i=0;i<140;i++)logs.append(profile,{target:'#size',nick:'Me',text:'row '+i+' '+('x'.repeat(10000))});const file=logs.file(profile,'#size');assert.ok(fs.statSync(file).size<=1048576);assert.ok(fs.readFileSync(file,'utf8').includes('row 139'));assert.ok(!fs.readFileSync(file,'utf8').includes('row 0 '));
 logs.configure({textLogDays:0,textLogMaxMB:0});for(let i=0;i<110;i++)logs.append(profile,{target:'#size',nick:'Me',text:'z'.repeat(10000)});assert.ok(fs.statSync(file).size>1048576);
});
test('Retention only touches app-owned log paths and paged reads never split UTF-8 emoji',t=>{
 const logs=fixture(t);logs.configure({textLogDays:1});fs.mkdirSync(logs.directory,{recursive:true});const unrelated=path.join(logs.directory,'notes.txt');fs.writeFileSync(unrelated,'Keep me');const old=new Date(Date.now()-5*86400000);fs.utimesSync(unrelated,old,old);logs.prune();assert.ok(fs.existsSync(unrelated));
 logs.append(profile,{target:'#unicode',nick:'A',text:'small'});const file=logs.file(profile,'#unicode');fs.writeFileSync(file,'x'.repeat(1048575)+'💋🦆');const id=logs.files()[0].id,first=logs.read(id),second=logs.read(id,first.next);assert.ok(!first.text.includes('\ufffd'));assert.equal(second.text,'💋🦆');assert.equal(first.next,1048575);const match=logs.search('💋')[0];assert.ok(match);assert.ok(logs.read(match.id,match.offset).text.includes('💋'));
});
test('History labels use the configured network name and recover old network names from TXT headers',t=>{
 const logs=fixture(t);logs.append(profile,{target:'#Dreams',nick:'A',text:'Hola',time});logs.append({...profile,id:'deleted-id',name:'Red antigua 💜'},{target:'Amigo',nick:'A',text:'Hola',time});const items=logs.describe([{...profile,name:'Red renombrada'}]);assert.equal(items.find(i=>i.id.includes('/salas/')).networkLabel,'Red renombrada');assert.equal(items.find(i=>i.id.includes('/privados/')).networkLabel,'Red antigua 💜');
});
