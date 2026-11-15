'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {IrcClient}=require('../src/irc'),{Runtime}=require('../src/services/runtime'),{HexVM}=require('../src/scripts/interpreter');
const source=fs.readFileSync(path.join(__dirname,'../addons/Seguidor-de-Nicks.hex'),'utf8');
function tracker(state={}){const vm=new HexVM();vm.install([{id:'sn',enabled:true,permissions:['read','ui','persist'],source,state}]);assert.equal(vm.dispatch('LOAD').actions.length,0);return vm;}
test('NICK preserves host, ident, old/new nicks and affected rooms from the IRC prefix',()=>{
 const c=new IrcClient({host:'localhost',nick:'Me',port:6667,channels:[]}),events=[];c.ready=true;c.sendRaw=()=>{};c.on('nick',e=>events.push(e));c.receive(Buffer.from(':Old!ident@cloak.example JOIN :#room\r\n:Old!ident@cloak.example NICK :New\r\n'));assert.deepEqual(events[0],{old:'Old',nick:'New',own:false,targets:['#room'],ident:'ident',host:'cloak.example'});c.presence.stop();c.clones.stop();
});
test('Runtime exposes one JOIN and NICK with network, room, host and ident to .hex',async()=>{
 const events=[],context={getConfig:()=>({settings:{},profiles:[]}),scripts:{event:async(name,fields)=>{events.push({name,fields});return{};}},emit:()=>{},writeTextLog:()=>{}};
 await Runtime.prototype.receive.call(context,'a','channel',{action:'join',target:'#room',nick:'Old',host:'cloak.example',ident:'ident',own:false});
 await Runtime.prototype.receive.call(context,'a','nick',{old:'Old',nick:'New',targets:['#room','#second'],host:'cloak.example',ident:'ident',own:false});
 assert.deepEqual(events,[{name:'JOIN',fields:{network:'a',buffer:'#room',chan:'#room',nick:'Old',host:'cloak.example',ident:'ident',own:false}},{name:'NICK',fields:{network:'a',buffer:'#room',chan:'#room',nick:'Old',newnick:'New',host:'cloak.example',ident:'ident',own:false}}]);
});
test('Seguidor alerts only on previous nicks for the same host and network and survives restoring state',()=>{
 const vm=tracker(),fields={network:'a',host:'cloak.example',nick:'Old',chan:'#room',own:false};
 const first=vm.dispatch('JOIN',fields);assert.ok(first.actions.some(a=>a.type==='state.set'));assert.ok(!first.actions.some(a=>a.type==='echo'));
 assert.ok(!vm.dispatch('JOIN',fields).actions.some(a=>a.type==='echo'));
 const changed=vm.dispatch('NICK',{...fields,newnick:'New'});assert.ok(!changed.actions.some(a=>a.type==='echo'));const saved=changed.actions.findLast(a=>a.type==='state.set').args.slice(1).join(' ');
 const restored=tracker({sn_db:saved}),joined=restored.dispatch('JOIN',{...fields,nick:'New'}),echo=joined.actions.filter(a=>a.type==='echo');assert.equal(echo.length,1);assert.ok(echo[0].text.includes('New comparte host con estos nicks anteriores: Old.'));assert.ok(!echo[0].text.includes('→ ,'));assert.ok(!joined.actions.some(a=>['msg','raw','send.direct'].includes(a.type)));
 assert.ok(!restored.dispatch('JOIN',{...fields,nick:'Other',network:'b'}).actions.some(a=>a.type==='echo'));assert.ok(!restored.dispatch('JOIN',{...fields,nick:'Other',host:'different.example'}).actions.some(a=>a.type==='echo'));assert.equal(restored.dispatch('JOIN',{...fields,host:''}).actions.length,0);assert.equal(restored.dispatch('JOIN',{...fields,own:true}).actions.length,0);
});
test('Seguidor suppresses empty legacy lists and shows only distinct named predecessors',()=>{
 const fields={network:'a',host:'cloak.example',nick:'SOMMERS',chan:'#room',own:false};
 for(const nicks of [['','','SOMMERS'],[' ', ',', ', ', 'sommers'],['\x0304','\x0f','SOMMERS']]){
  const vm=tracker({sn_db:JSON.stringify({'a|cloak.example':nicks})});const result=vm.dispatch('JOIN',fields);assert.ok(!result.actions.some(a=>a.type==='echo'));assert.ok(!result.actions.some(a=>a.type==='error'));
 }
 const vm=tracker({sn_db:JSON.stringify({'a|cloak.example':['',' ','Nick1','nick1',' Nick2 ', ',', 'SOMMERS']})});const r=vm.dispatch('JOIN',fields),echo=r.actions.filter(a=>a.type==='echo');assert.equal(echo.length,1);assert.ok(echo[0].text.includes('SOMMERS comparte host con estos nicks anteriores: nick1, Nick2.'));const saved=r.actions.find(a=>a.type==='state.set');assert.deepEqual(JSON.parse(saved.args[1])['a|cloak.example'],['nick1','Nick2','SOMMERS']);assert.ok(!r.actions.some(a=>['msg','raw','send.direct'].includes(a.type)));
});
