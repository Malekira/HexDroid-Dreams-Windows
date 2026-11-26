'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {MslVM,compile}=require('../src/scripts/mirc/language');
const {decode}=require('../src/scripts/mirc/importer');
const {MircManager}=require('../src/scripts/mirc/manager');
const {prepare}=require('../src/scripts/mirc/host');
const fields={network:'n',buffer:'#room',chan:'#room',channel:true,me:'Me',nick:'Alice',host:'same.test',rooms:[{name:'#room',users:['@Me','Alice','+Bob']}],addresses:[{nick:'Me',ident:'me',host:'same.test'},{nick:'Alice',ident:'a',host:'same.test'}]};
const original=name=>new MslVM(decode(fs.readFileSync(path.join(__dirname,'fixtures/mirc',name))).source);
test('original aSolas uses START, INPUT and JOIN without rewriting',()=>{
 const vm=original('aSolas.mrc');vm.dispatch('START',fields);vm.dispatch('INPUT',{...fields,text:'.asolas'},['.asolas']);
 assert.deepEqual(vm.dispatch('JOIN',fields,['#room']).actions.map(a=>[a.type,a.text]),[['kick','#room Alice Necesito estar aSolas, gracias.']]);
 vm.dispatch('INPUT',{...fields,text:'.asolas'},['.asolas']);assert.equal(vm.dispatch('JOIN',fields).actions.length,0);
});
test('original delBans interprets numeric 367/368 in their original positions',()=>{
 const vm=original('delBans.mrc');vm.dispatch('START',fields);assert.equal(vm.invoke('delBans',fields).actions[0].text,'#room -b');
 vm.dispatch('RAW',{...fields,code:'367'},['Me','#room','*!*@bad.test','Oper','123']);
 const result=vm.dispatch('RAW',{...fields,code:'368'},['Me','#room','End of ban list']);
 assert.equal(result.actions[0].type,'mode');assert.match(result.actions[0].text,/#room -bbbbbb \*!\*@bad.test/);
});
test('original voices initializes globals and creates deferred voice commands',()=>{
 const vm=original('voices.mrc');vm.dispatch('START',fields);const r=vm.invoke('voices',fields);
 assert.equal(r.timers.length,1);assert.equal(r.timers[0].code,'mode #room +v Alice');
});
test('original megaWho and clone detector use custom windows and cached hosts',()=>{
 const vm=original('megaWho.mrc'),r=vm.invoke('megaWho',fields);assert.equal(r.actions[0].type,'who');assert.equal(r.timers[0].code,'megaWho2 #room');
 assert.ok(r.actions.some(a=>a.type==='custom-window'&&a.text==='@megaWhoS'));
 const clone=original('myClonDetector.mrc').dispatch('JOIN',fields);assert.ok(clone.actions.some(a=>a.type==='echo'&&a.text.includes('Alice')));
});
test('original spy menu and WHO numeric retain the host and current nickname',()=>{
 const vm=original('spy.mrc');vm.dispatch('START',fields);const r=vm.invoke('spy',fields,['Alice']);assert.equal(r.actions.filter(a=>a.type==='who').length,2);assert.equal(r.timers.length,1);
 const numeric=vm.dispatch('RAW',{...fields,code:'352'},['Me','#room','a','same.test','irc.test','Alice','H','0 Alice']);assert.ok(numeric.actions.some(a=>a.type==='echo'&&a.text.includes('Alice')&&a.text.includes('same.test')));
 assert.equal(vm.menuLabels(fields)[0].label,'spy › Comands');
});
test('events match their text masks and invoke every matching handler',()=>{
 const vm=new MslVM('on *:TEXT:hello*:#:{ echo -s first }\non *:TEXT:*:#:{ echo -s second }');
 assert.equal(vm.dispatch('TEXT',{...fields,text:'other'}).actions.length,1);assert.equal(vm.dispatch('TEXT',{...fields,text:'hello Alice'}).actions.length,2);
});
test('menu labels evaluate aliases without side effects and actions require an explicit click',()=>{
 const vm=new MslVM('alias label { inc %n | return Panel }\nalias count { echo -s %n }\nmenu menubar {\n $label:echo -s clicked\n}');
 assert.equal(vm.menuLabels(fields)[0].label,'Panel');assert.equal(vm.invoke('count',fields).actions[0].text,'-s ');assert.equal(vm.menu(fields,'0').actions[0].text,'-s clicked');
});
test('local files persist only in the addon namespace and reject traversal',()=>{
 const vm=new MslVM('alias save { write data.txt hello | echo -s $read(data.txt,1) }\nalias escape { write ../outside.txt no }');
 assert.deepEqual(vm.invoke('save',fields).files,{'data.txt':['hello']});assert.throws(()=>vm.invoke('escape',fields),/ruta|archivo/i);
});
test('native PART consumes its channel separately from its reason',()=>{
 const lines=[];const actions=prepare([{type:'part',text:'#else Hasta luego'}],fields,{ready:true,profile:{encoding:'utf8'}});assert.equal(actions[0].target,'#else');assert.equal(actions[0].command,'/part Hasta luego');
});
function manager(t,options={}){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mirc-next-')),m=new MircManager(dir,{snapshot:f=>({...fields,...f}),...options});t.after(()=>{m.close();fs.rmSync(dir,{recursive:true,force:true});});return m;}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
test('timers repeat, replace by name, and cancel on disconnect, disable and remove',async t=>{
 let sent=[];const m=manager(t,{host:async a=>sent.push(...a)}),s=await m.install('timer.mrc',Buffer.from('alias begin { timerT -m 2 25 echo -s tick }\nalias stop { timerT off }'));
 await m.alias('begin',fields);await pause(130);assert.equal(sent.length,2);assert.equal(m.timers.size,0);
 sent=[];await m.alias('begin',fields);await m.alias('stop',fields);await pause(70);assert.equal(sent.length,0);
 await m.alias('begin',fields);m.disconnect('n');await pause(70);assert.equal(sent.length,0);
 await m.alias('begin',fields);await m.configure(s.id,false);await pause(70);assert.equal(sent.length,0);
 await m.configure(s.id,true);await m.alias('begin',fields);await m.remove(s.id);await pause(70);assert.equal(sent.length,0);
});
test('startup waits for availability, INPUT halt propagates, and failed START disables the import',async t=>{
 let ready=false,sent=[];const m=manager(t,{available:()=>ready,host:async a=>sent.push(...a)});
 await m.install('start.mrc',Buffer.from('on *:START:{ echo -s started }\non *:INPUT:*:{ halt }'),fields);assert.equal(sent.length,0);
 ready=true;assert.equal((await m.event('INPUT',fields)).halted,true);assert.equal(sent.length,1);
 await assert.rejects(m.install('bad.mrc',Buffer.from('on *:START:{ while ($true) { inc %n } }'),fields),/desactivado/);assert.equal(m.list().find(s=>s.name==='bad.mrc').enabled,false);
});
test('unfinished platform APIs are rejected rather than accepted as successful no-ops',()=>{
 for(const cmd of ['run tool.exe','flood off','dll tool.dll fn'])assert.throws(()=>compile('alias a { '+cmd+' }'),/no soportad/);
});

test('temporary private ignores use cached hosts, expire and disappear on disable',async t=>{
 const m=manager(t),s=await m.install('ignore.mrc',Buffer.from('alias block { ignore -pu300 Alice 2 }'));
 await m.alias('block',fields);assert.equal(m.ignored({...fields,buffer:'Alice',channel:false}),true);assert.equal(m.ignored({...fields,buffer:'#room'}),false);assert.equal(m.ignored({...fields,buffer:'Alice',notice:true}),false);
 for(const row of m.ignores.values())row.until=Date.now()-1;assert.equal(m.ignored({...fields,buffer:'Alice'}),false);
 await m.alias('block',fields);await m.configure(s.id,false);assert.equal(m.ignored({...fields,buffer:'Alice'}),false);
});

test('PART respects channel scope and NICK exposes the old and new nick',()=>{
 const vm=new MslVM('on *:PART:#room:{ echo -s $nick $1- }\non *:NICK:{ echo -s $nick $newnick }');
 assert.equal(vm.dispatch('PART',{...fields,chan:'#other'},['bye']).handled,false);
 assert.equal(vm.dispatch('PART',fields,['bye','all']).actions[0].text,'-s Alice bye all');
 assert.equal(vm.dispatch('NICK',{...fields,newnick:'NewAlice'}).actions[0].text,'-s Alice NewAlice');
});
test('a named timer replaces its earlier scheduled command',async t=>{
 const sent=[],m=manager(t,{host:async a=>sent.push(...a)});
 await m.install('replace.mrc',Buffer.from('alias replaceTimer { timerSame -m 1 25 echo -s $1 }'));
 await m.alias('replaceTimer',fields,['old']);await m.alias('replaceTimer',fields,['new']);await pause(100);
 assert.deepEqual(sent.map(a=>a.text),['-s new']);
});
