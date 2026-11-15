'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {ScriptConversations}=require('../src/services/script-conversations');
const {HexVM}=require('../src/scripts/interpreter');
const fs=require('node:fs'),path=require('node:path');
function fixture(){const events=[],sent=[],clients={a:{ready:true,sendRaw:s=>sent.push(s)},b:{ready:true,sendRaw:s=>sent.push(s)}};const service=new ScriptConversations({emit:(...e)=>events.push(e),client:id=>clients[id],enabled:id=>id==='antipv'});return{events,sent,service};}
test('Retained private message stays invisible until accepted, with script/network isolation',()=>{
 const {events,service}=fixture(),fields={network:'a',script:'antipv'};
 service.hold('antipv','a',{target:'Nora',nick:'Nora',text:'Primero'});service.hold('antipv','a',{target:'Nora',nick:'Nora',text:'Segundo'});assert.equal(events.length,0);
 service.action({type:'conversation.open',args:['Nora']},{...fields,network:'b'});assert.equal(events.filter(e=>e[1]==='message').length,0);
 service.action({type:'conversation.open',args:['Nora']},fields);assert.equal(events.at(-1)[2].text,'Primero');assert.equal(service.pending.size,0);
 assert.throws(()=>service.action({type:'conversation.close',args:['#sala']},fields));assert.throws(()=>service.action({type:'conversation.close',args:['*']},fields));assert.throws(()=>service.action({type:'conversation.open',args:['Nora']},{...fields,network:'other'}));
});
test('Direct IRC replies create no local conversation, close discards retained data, tree cleanup is scoped',()=>{
 const {events,sent,service}=fixture(),fields={network:'a',script:'antipv'};
 service.action({type:'send.direct',args:['Nora','Espera por favor']},fields);assert.deepEqual(sent,['PRIVMSG Nora :Espera por favor']);assert.equal(events.length,0);
 service.hold('antipv','a',{target:'Nora',text:'Hola'});service.action({type:'conversation.close',args:['Nora']},fields);assert.equal(service.pending.size,0);
 service.action({type:'tree.add',args:['pv','pv','2','Anti-PV']},fields);service.action({type:'tree.add',args:['pv','pv','1','Anti-PV']},fields);assert.equal(service.entries.size,1);assert.equal([...service.entries.values()][0].count,1);
 service.action({type:'tree.add',args:['pv','pv','0','Anti-PV']},{...fields,network:'b'});assert.equal(service.entries.size,2);service.enabled=()=>false;service.clean();assert.equal(service.entries.size,0);
});
test('Optional Anti-PV intercepts, accepts, rejects, ignores and respects its manual mode',()=>{
 const vm=new HexVM();vm.install([{id:'antipv',enabled:true,permissions:['read','intercept','ui','send','persist'],source:fs.readFileSync(path.join(__dirname,'../extras/AntiPV_HexDreams_0.29.hex'),'utf8')}]);vm.dispatch('LOAD');
 const fields={network:'a',buffer:'Nora',private:true,own:false,nick:'Nora',text:'Hola'};
 const r=vm.dispatch('TEXT',fields);assert.equal(r.halted,true);assert.equal(r.haltedBy,'antipv');assert.ok(r.actions.some(a=>a.type==='send.direct'));assert.ok(!r.actions.some(a=>a.type==='view'));
 const accepted=vm.alias('apv_accept',fields,['Nora']);assert.ok(accepted.actions.some(a=>a.type==='conversation.open'));assert.equal(vm.dispatch('TEXT',fields).halted,false);
 vm.dispatch('TEXT',{...fields,nick:'Sol',buffer:'Sol'});assert.ok(vm.alias('apv_reject',fields,['Sol']).actions.some(a=>a.type==='conversation.close'));assert.equal(vm.dispatch('TEXT',{...fields,nick:'Sol',buffer:'Sol'}).halted,true);
 vm.dispatch('TEXT',{...fields,nick:'Luna',buffer:'Luna'});vm.alias('apv_ignore',fields,['Luna']);const again=vm.dispatch('TEXT',{...fields,nick:'Luna',buffer:'Luna'});assert.ok(again.actions.some(a=>a.type==='send.direct'));
 assert.equal(vm.dispatch('TEXT',{...fields,network:'b'}).halted,true);
 assert.equal(vm.dispatch('ACTION',{...fields,nick:'Accion',buffer:'Accion'}).halted,true);
});
test('Notify sharing preserves individual preferences and remains network-scoped',()=>{
 const {names}=require('../src/services/notify-policy'),a={notifyNicks:['A']},b={notifyNicks:['B']},cfg={settings:{sharedNotify:true,sharedNotifyNicks:['C']}};
 assert.deepEqual(names(cfg,a),['C']);assert.deepEqual(names(cfg,b),['C']);cfg.settings.sharedNotify=false;assert.deepEqual(names(cfg,a),['A']);assert.deepEqual(names(cfg,b),['B']);
});
