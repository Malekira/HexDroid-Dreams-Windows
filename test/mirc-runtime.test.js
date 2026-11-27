'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {MslVM,compile}=require('../src/scripts/mirc/language');
const {MircManager}=require('../src/scripts/mirc/manager');
const {MircHost,snapshot,prepare}=require('../src/scripts/mirc/host');
const context={me:'Me',chan:'#room',network:'net',buffer:'#room',rooms:[{name:'#room',users:['@Me','Alice','+Bob']}],addresses:[{nick:'alice',ident:'guest',host:'example.test'}]};
test('native moderation aliases enumerate users and preserve prefixes and argument context',()=>{
 const vm=new MslVM(`alias voces {
 var %i = 1
 while ($nick($chan,%i)) {
  var %n = $nick($chan,%i)
  if ($nick($chan,%n).pnick == %n) { mode $chan +v %n }
  inc %i
 }
 echo -s $0 argumentos: $1- / $2-3
}`);
 const r=vm.invoke('voces',context,['uno','dos','tres','cuatro']);
 assert.deepEqual(r.actions.map(a=>[a.type,a.text]),[['mode','#room +v Alice'],['echo','-s 4 argumentos: uno dos tres cuatro / dos tres']]);
});
test('ident helpers, local aliases, comparisons, elseif, math and literal caller text',()=>{
 const vm=new MslVM(`alias -l ident { return $gettok($gettok($address($1,5),2,33),1,64) }
alias revisar {
 var %x = 2 * (3 + 1)
 if (($ident($1) == guest) && (%x >= 8)) { echo -s $upper($1) $+ : $v1 }
 elseif ($1 == Nobody) { echo -s nadie }
 else { echo -s otro }
 echo -s $2
}`);
 const r=vm.invoke('revisar',context,['Alice','keep $+ process.exit()']);
 assert.equal(r.actions[0].text,'-s ALICE: 8');assert.equal(r.actions[1].text,'-s keep $+ process.exit()');
 assert.equal(vm.invoke('ident',context,['Alice']).handled,false);
 assert.equal(vm.invoke('revisar',context,['Nobody']).actions[0].text,'-s nadie');
});
test('variable scope, returns and halt stop the full invocation',()=>{
 const vm=new MslVM(`alias -l detener { halt }
alias contar { inc %total | var %local = 3 | echo -s %total | detener | echo -s imposible }
alias leer { echo -s %total / %local }`);
 assert.equal(vm.invoke('contar').actions.length,1);assert.equal(vm.invoke('contar').actions[0].text,'-s 2');
 assert.equal(vm.invoke('leer').actions[0].text,'-s 2 / ');
});
test('unsupported modules reject entirely, failed invocations roll back globals and no actions escape',()=>{
 for(const source of ['alias a { run test.exe }','alias a { dll forbidden.dll entry }','alias a { sockopen x host 80 }','dialog d {\n title x\n}'])assert.throws(()=>compile(source));
 const vm=new MslVM('alias boom { inc %n | echo -s partial | while ($true) { inc %n } }\nalias n { echo -s %n }');
 assert.throws(()=>vm.invoke('boom'),/presupuesto/);assert.equal(vm.invoke('n').actions[0].text,'-s ');
 assert.throws(()=>new MslVM('alias a { a }').invoke('a'),/anidadas/);
});
test('action preflight rejects injection, oversized notices and invalid later actions before any send',()=>{
 const c={ready:true,nick:'Me'};
 assert.throws(()=>prepare([{type:'mode',text:'#room +v Alice'},{type:'notice',text:'Alice '+('x'.repeat(510))}],context,c),/límite/);
 assert.throws(()=>prepare([{type:'msg',text:'Alice hi\r\nQUIT'}],context,c),/inválido/);
 assert.throws(()=>prepare([{type:'run',text:'bad.exe'}],context,c),/no soportada/);
 assert.throws(()=>prepare([{type:'mode',text:'#room +b bad'}],context,{ready:false}),/Conecta/);
});
test('host uses normal IRC actions, spaces sends and cancels when the socket changes',async()=>{
 let clock=1000;const sent=[],c={ready:true,nick:'Me',socket:{},sendRaw:s=>sent.push(s)},events=[];
 const host=new MircHost({client:()=>c,emit:(...a)=>events.push(a),now:()=>clock,delay:async ms=>{clock+=ms;}});
 await host.deliver([{type:'mode',text:'#room +v Alice'},{type:'kick',text:'#room Bob motivo'},{type:'echo',text:'-s listo'}],context);
 assert.deepEqual(sent,['MODE #room +v Alice','KICK #room Bob :motivo']);assert.equal(clock,1350);assert.equal(events[0][2].target,'*');
 host.delay=async()=>{c.socket={};};await assert.rejects(host.deliver([{type:'mode',text:'#room +b *!*@bad'}],context),/canceló/);assert.equal(sent.length,2);
});
test('worker import, normal execution, persistence, private aliases, disable and remove',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'mirc-runtime-'));let batches=[];
 const m=new MircManager(directory,{snapshot:()=>context,host:async actions=>batches.push(actions)});
 t.after(()=>{m.close();fs.rmSync(directory,{recursive:true,force:true});});
 const installed=await m.install('sample.mrc',Buffer.from('alias -l helper { return $upper($1) }\nalias saludo { msg $chan $helper($1) }'));
 assert.deepEqual(m.completions().map(a=>a.name),['saludo']);assert.equal(m.list()[0].enabled,true);
 await m.alias('saludo',context,['Alice']);assert.equal(batches[0][0].text,'#room ALICE');
 assert.equal((await m.alias('helper',context)).handled,false);
 await assert.rejects(m.install('bad.mrc',Buffer.from('alias bad { run bad.exe }')),/no soportado/);assert.equal(m.list().length,1);
 await assert.rejects(m.install('duplicate.mrc',Buffer.from('alias saludo { echo hi }')),/ya instalado/);
 const reopened=new MircManager(directory);assert.equal(reopened.list()[0].enabled,true);reopened.close();
 await m.configure(installed.id,false);assert.equal((await m.alias('saludo',context,['Alice'])).handled,false);
 await m.remove(installed.id);assert.deepEqual(m.list(),[]);
});
test('worker budgets reject without host actions and leave ordinary commands available',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'mirc-bounds-'));let delivered=0;
 const m=new MircManager(directory,{host:async()=>delivered++});t.after(()=>{m.close();fs.rmSync(directory,{recursive:true,force:true});});
 await m.install('loop.mrc',Buffer.from('alias loop { while ($true) { inc %n } }'));
 await assert.rejects(m.alias('loop',{}),/presupuesto/);assert.equal(delivered,0);
 assert.equal((await m.alias('join',{})).handled,false);
});
test('a corrupt addon registry is preserved and cannot disable core IRC commands',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'mirc-corrupt-'));fs.writeFileSync(path.join(directory,'mirc-addons.json'),'broken');
 const m=new MircManager(directory);t.after(()=>{m.close();fs.rmSync(directory,{recursive:true,force:true});});
 assert.match(m.loadError,/registro/);assert.equal((await m.alias('login',{})).handled,false);
 await assert.rejects(m.install('sample.mrc',Buffer.from('alias sample { echo hi }')),/registro/);
 assert.equal(fs.readFileSync(path.join(directory,'mirc-addons.json'),'utf8'),'broken');
});
test('snapshots include cached addresses and users without asking the IRC server',()=>{
 const state=snapshot({nick:'Me',profile:{name:'Red'},members:new Map([['#room',new Map([['alice','@Alice']])]]),userStates:new Map([['alice',{ident:'a',host:'h',secret:'not-exposed'}]])},context);
 assert.deepEqual(state.rooms,[{name:'#room',users:['@Alice']}]);assert.deepEqual(state.addresses,[{nick:'alice',ident:'a',host:'h'}]);
});
test('Runtime.send routes native aliases through the worker, preserves hex precedence and standard commands',async t=>{
 const {Runtime}=require('../src/services/runtime'),directory=fs.mkdtempSync(path.join(os.tmpdir(),'mirc-routing-'));
 const sent=[],client={ready:true,nick:'Me',socket:{},members:new Map(),sendRaw:s=>sent.push(s),join:s=>sent.push('JOIN '+s)};
 const host=new MircHost({client:()=>client,emit:()=>{}});
 const mirc=new MircManager(directory,{snapshot:fields=>snapshot(client,fields),host:(a,f,v)=>host.deliver(a,f,v)});
 t.after(()=>{mirc.close();fs.rmSync(directory,{recursive:true,force:true});});
 await mirc.install('moderacion.mrc',Buffer.from('alias moderar { mode $chan +v $1 }'));
 const runtime={scripts:{event:async(name,fields)=>({...fields}),alias:async()=>({handled:false})},mirc,sessions:{get:()=>client},emit:()=>{}};
 assert.deepEqual(await Runtime.prototype.send.call(runtime,{id:'net',target:'#room',text:'/moderar Alice'}),{ok:true});
 assert.deepEqual(sent,['MODE #room +v Alice']);
 await Runtime.prototype.send.call(runtime,{id:'net',target:'*',text:'/join #other'});assert.equal(sent[1],'JOIN #other');
 runtime.scripts.alias=async()=>({handled:true});await Runtime.prototype.send.call(runtime,{id:'net',target:'#room',text:'/moderar Bob'});assert.equal(sent.length,2);
});
test('disabling an addon cancels a batch already waiting to send',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'mirc-cancel-'));let ready,release;const waiting=new Promise(r=>ready=r),block=new Promise(r=>release=r);let sent=0;
 const m=new MircManager(directory,{host:async(actions,fields,valid)=>{ready();await block;if(!valid())throw Error('cancelado');sent+=actions.length;}});
 t.after(()=>{m.close();fs.rmSync(directory,{recursive:true,force:true});});
 const {id}=await m.install('pending.mrc',Buffer.from('alias pending { mode #room +v Alice }'));
 const command=m.alias('pending',{});await waiting;const disabled=m.configure(id,false);release();await assert.rejects(command,/cancelado/);await disabled;assert.equal(sent,0);
});
test('the shipped native example runs cached ident lookup and produces one moderation request',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../docs/examples/moderacion-basica.mrc'),'utf8');
 const vm=new MslVM(source);
 assert.equal(vm.invoke('hdident',context,['Alice']).actions[0].text,'-s Ident de Alice: guest');
 assert.equal(vm.invoke('hdident',context,['Unknown']).actions[0].text,'-s No hay ident/host recibido para Unknown');
 assert.deepEqual(vm.invoke('hdvoz',context,['Alice']).actions.map(a=>[a.type,a.text]),[['mode','#room +v Alice']]);
});
test('address snapshots prefer the live identity cache over stale WHOIS data',()=>{
 const client={userStates:new Map([['alice',{ident:'old',host:'old.host'}]]),identityCache:{snapshot:()=>[{nick:'Alice',ident:'new',host:'new.host'}]}};
 const fields=snapshot(client,context),vm=new MslVM('alias host { echo -s $address($1,5) }');
 assert.equal(vm.invoke('host',fields,['Alice']).actions[0].text,'-s Alice!new@new.host');
 client.identityCache.snapshot=()=>[];
 assert.equal(vm.invoke('host',snapshot(client,context),['Alice']).actions[0].text,'-s ');
});
test('the original kaos_ident addon runs its alias and JOIN ident checks without source rewriting',()=>{
 const source=fs.readFileSync(path.join(__dirname,'fixtures/mirc/kaos_ident.mrc'),'utf8'),vm=new MslVM(source);
 assert.deepEqual(vm.invoke('tp-ident',context,['Alice','motivo de prueba']).actions.map(a=>a.text),['#room Alice motivo de prueba']);
 assert.deepEqual(vm.dispatch('JOIN',{...context,nick:'Other',addresses:[{nick:'Other',ident:'guest',host:'different.host'}]}).actions.map(a=>a.text),['#room Other 2 motivo de prueba']);
 assert.deepEqual(vm.dispatch('JOIN',{...context,nick:'Other',addresses:[{nick:'Other',ident:'different',host:'example.test'}]}).actions,[]);
 vm.invoke('tp-ident',context,['off']);assert.deepEqual(vm.dispatch('JOIN',{...context,nick:'Other',addresses:[{nick:'Other',ident:'guest',host:'example.test'}]}).actions,[]);
});
test('JOIN handlers keep channel scope, alias arguments and worker activation separate',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'mirc-join-')),batches=[];
 const m=new MircManager(directory,{snapshot:f=>({...context,...f}),host:async actions=>batches.push(actions)});
 t.after(()=>{m.close();fs.rmSync(directory,{recursive:true,force:true});});
 const {id}=await m.install('join.mrc',Buffer.from('on *:JOIN:#chosen:{\n echo -s $nick $chan $1\n}'));
 assert.deepEqual(m.list()[0].events,['JOIN']);assert.deepEqual(m.completions(),[]);
 await m.event('JOIN',{chan:'#other',nick:'Alice'},['#other']);assert.equal(batches.length,0);
 await m.event('JOIN',{chan:'#chosen',nick:'Alice'},['#chosen']);assert.equal(batches[0][0].text,'-s Alice #chosen #chosen');
 await m.configure(id,false);assert.equal((await m.event('JOIN',{chan:'#chosen',nick:'Bob'})).handled,false);assert.equal(batches.length,1);
});
test('events queued before a new connection cannot moderate the new session',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'mirc-generation-'));let connection={},delivered=0,release,entered;
 const enteredPromise=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
 const m=new MircManager(directory,{session:()=>connection,host:async(actions,fields,valid)=>{if(actions[0]?.type==='echo'){entered();await gate;}if(valid())delivered+=actions.filter(a=>a.type==='mode').length;}});
 t.after(()=>{m.close();fs.rmSync(directory,{recursive:true,force:true});});
 await m.install('queue.mrc',Buffer.from('alias pause { echo -s wait }\non *:JOIN:#:{\n mode #room +v $nick\n}'));
 const running=m.alias('pause',{});await enteredPromise;const queued=m.event('JOIN',{chan:'#room',nick:'Alice'});connection={};release();await running;assert.equal((await queued).handled,false);assert.equal(delivered,0);
});
test('automatic JOIN addons do not run ahead of the connection startup commands',async()=>{
 const {Runtime}=require('../src/services/runtime');let calls=0;const client={startupPending:true};
 const r={sessions:{get:()=>client},mirc:{event:async()=>{calls++;}},scripts:{event:async()=>({})},getConfig:()=>({settings:{historyEnabled:false}}),writeTextLog:()=>{},emit:()=>{}};
 await Runtime.prototype.receive.call(r,'net','channel',{action:'join',target:'#room',nick:'Alice'});assert.equal(calls,0);
 client.startupPending=false;await Runtime.prototype.receive.call(r,'net','channel',{action:'join',target:'#room',nick:'Alice'});assert.equal(calls,1);
});
test('editing a compatible addon preserves ID, activation and INI, refreshes worker and detects stale source',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'mirc-edit-')),batches=[];const m=new MircManager(directory,{snapshot:()=>context,host:async actions=>batches.push(actions)});t.after(()=>{m.close();fs.rmSync(directory,{recursive:true,force:true});});
 const {id}=await m.install('sample.mrc',Buffer.from('alias sample { echo -s viejo }'));
 await m.alias('sample',context);const original=m.read(id),data=m.dataFile(id);fs.mkdirSync(path.dirname(data),{recursive:true});fs.writeFileSync(data,JSON.stringify({prefs:{mode:'ask'}}));
 await assert.rejects(m.update(id,{...original,source:'alias bad { run bad.exe }'}),/soportado/);assert.equal(m.read(id).revision,original.revision);
 const updated=await m.update(id,{...original,source:'alias sample { echo -s nuevo }'});assert.equal(updated.id,id);assert.deepEqual(m.readIni(id),{prefs:{mode:'ask'}});assert.equal(m.list()[0].enabled,true);await m.alias('sample',context);assert.equal(batches.at(-1)[0].text,'-s nuevo');await assert.rejects(m.update(id,{...original,source:'alias sample { echo stale }'}),/cambió/);
 assert.equal(m.help(id).commands[0].usage,'/sample');await m.configure(id,false);await m.update(id,{...m.read(id),name:'renamed.xcr'});assert.equal(m.list()[0].enabled,false);
});
