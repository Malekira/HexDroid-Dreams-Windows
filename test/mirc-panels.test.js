'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {MslVM,compile}=require('../src/scripts/mirc/language'),{decode}=require('../src/scripts/mirc/importer'),{prepare}=require('../src/scripts/mirc/host');
const f={network:'n',buffer:'Alice',nick:'Alice',me:'Me',addresses:[{nick:'Alice',ident:'a',host:'host.test'}]};
const original=name=>new MslVM(decode(fs.readFileSync(path.join(__dirname,'fixtures/mirc',name))).source);
test('original Ignora Querys panel adds, removes, edits and filters with the combo and checkbox',()=>{
 const vm=original('ignorakuerys.xcr');assert.equal(vm.invoke('ventana.ignoqu',f).dialogs[0].name,'ignoqu');
 let r=vm.dialogEvent(f,'ignoqu','sclick','2',{'1':{text:'Alice',selected:0}});assert.deepEqual(r.dialogs[0].controls.find(c=>c.id==='1').items,['Alice']);
 vm.dialogEvent(f,'ignoqu','edit','6',{'6':'Mensaje elegido'});
 r=vm.dialogEvent(f,'ignoqu','sclick','4',{'4':true});assert.equal(prepare(r.actions,f,{ready:true})[0].target,'*');
 assert.equal(vm.dispatch('OPEN',f,['hello']).halted,false);
 r=vm.dispatch('OPEN',{...f,nick:'Bob'},['hello']);assert.equal(r.halted,true);assert.ok(r.actions.some(a=>a.type==='msg'&&a.text==='Bob Mensaje elegido'));assert.ok(r.files['addons/ignorakuerys.txt']);
 vm.dialogEvent(f,'ignoqu','sclick','3',{'1':{text:'Alice',selected:1}});
 assert.equal(vm.dispatch('OPEN',f,['hello']).halted,true);
 assert.equal(vm.invoke('ventana.ignoqu',f).dialogs[0].focus,'20');
});
test('original PVGuard opens a panel using -m and runs accept/reject before closing',()=>{
 for(const decision of ['3','4']){
  const vm=original('PVGuard.mrc');vm.dispatch('START',f);vm.invoke('pvguard',f,['on']);
  const r=vm.dispatch('OPEN',f,['hello']);assert.equal(r.halted,true);assert.equal(r.dialogs[0].name,'pvguard');
  const click=vm.dialogEvent(f,'pvguard','sclick',decision,{});assert.ok(click.closed.includes('pvguard'));
  assert.ok(click.actions.some(a=>a.type==='msg'&&a.text==='Alice Privado '+(decision==='3'?'aceptado.':'rechazado.')));assert.doesNotThrow(()=>prepare(click.actions,f,{ready:true}));
  if(decision==='4')assert.equal(click.ignores[0].seconds,300);
 }
});
const source=`alias panel { dialog -m test test }
alias states { echo -s $did(test,3).sel $did(test,3).seltext $did(test,8).state }
alias setControls { did -a test 3 Alice | did -a test 3 Bob | did -c test 3 2 | did -i test 3 1 First | did -o test 3 1 Other | did -d test 3 1 | did -f test 3 }
alias hidden { did -h test 8 | did -b test 3 }
dialog test {
 title "Test"
 size -1 -1 500 300
 tab "Uno",1,0 0 120 24
 tab "Dos",2,120 0 120 24
 combo 3,0 30 200 90,tab 1
 edit "Original",4,0 30 200 90,multi read tab 2
 button "Guardar",5,0 200 100 30,default
 button "Salir",6,120 200 100 30,cancel
 link "Acción",7,240 200 100 30
 check "Activar",8,220 30 100 30,tab 1
}
on *:DIALOG:test:sclick:1-8:{ echo -s clicked $did }
on *:DIALOG:test:sclick:5:{ echo -s save }
on *:DIALOG:test:close:*:{ echo -s closed }
`;
test('tabbed panels, list mutations, focus, did properties and wildcard/range events',()=>{
 const vm=new MslVM(source);vm.invoke('panel',f);const r=vm.invoke('setControls',f),c=r.dialogs[0].controls.find(c=>c.id==='3');assert.deepEqual(c.items,['Alice','Bob']);assert.equal(r.dialogs[0].focus,'3');
 assert.equal(vm.invoke('states',f).actions[0].text,'-s 2 Bob 0');
 const selected=vm.dialogEvent(f,'test','sclick','2',{});assert.equal(selected.dialogs[0].activeTab,'2');
 assert.throws(()=>vm.dialogEvent(f,'test','sclick','8',{'8':true}),/no válida/);
 assert.equal(vm.dialogEvent(f,'test','sclick','5',{}).actions.length,2);
 const closed=vm.dialogEvent(f,'test','sclick','6',{});assert.deepEqual(closed.actions.map(a=>a.text),['-s clicked 6','-s closed']);assert.deepEqual(closed.closed,['test']);
});
test('disabled and hidden controls reject interaction and readonly edits cannot be forged',()=>{
 const vm=new MslVM(source);vm.invoke('panel',f);vm.invoke('setControls',f);vm.invoke('hidden',f);
 assert.throws(()=>vm.dialogEvent(f,'test','sclick','3',{}),/no válida/);assert.throws(()=>vm.dialogEvent(f,'test','sclick','8',{}),/no válida/);
 vm.dialogEvent(f,'test','sclick','2',{});vm.dialogEvent(f,'test','edit','4',{'4':'Forged'});assert.equal(vm.compat.control('test','4').text,'Original');
 assert.throws(()=>vm.dialogEvent(f,'test','sclick','5',{'999':'forged'}),/desconocido/);
});
test('dialog expansion, checkbox callbacks and separate radio groups',()=>{
 const vm=new MslVM(`alias open { set %caption Dynamic | dialog -md d d }
dialog d {
 title Test
 size -1 -1 400 200
 edit %caption,1,0 0 100 25
 radio "A",2,0 30 100 20,group
 radio "B",3,0 60 100 20
 radio "C",4,120 30 100 20,group
 radio "D",5,120 60 100 20
}
alias select { did -c d 2 | did -c d 4 }
`);vm.invoke('open',f);assert.equal(vm.compat.control('d','1').text,'Dynamic');vm.invoke('select',f);
 vm.dialogEvent(f,'d','sclick','3',{'3':true});assert.equal(vm.compat.control('d','2').checked,false);assert.equal(vm.compat.control('d','4').checked,true);
});

test('a new private sender supplies the real cached address without WHOIS or tracker output',()=>{
 const {IrcClient}=require('../src/irc'),{snapshot}=require('../src/scripts/mirc/host');
 const c=new IrcClient({host:'localhost',port:6667,tls:false,nick:'Me',channels:[]}),wire=[],observations=[];c.sendRaw=line=>wire.push(line);c.on('identity-observation',e=>observations.push(e));
 c.receive(Buffer.from(':NewNick!ident@virtual.host PRIVMSG Me :hello\r\n'));
 assert.ok(snapshot(c,f).addresses.some(a=>a.nick==='NewNick'&&a.ident==='ident'&&a.host==='virtual.host'));assert.deepEqual(wire,[]);assert.deepEqual(observations,[]);
});

test('panel geometry, embedded NUL and malformed combo selections are rejected',()=>{
 assert.throws(()=>compile('alias a { dialog -m d d }\ndialog d {\n size -1 -1 100 100\n edit "",1,0 0 99999 20\n}'),/Geometría/);
 const vm=new MslVM('alias a { dialog -m d d }\ndialog d {\n size -1 -1 200 200\n edit "",1,0 0 180 100,multi\n combo 2,0 110 180 80\n}');vm.invoke('a',f);
 assert.throws(()=>vm.dialogEvent(f,'d','edit','1',{'1':'bad\0text'}),/Texto/);vm.dialogEvent(f,'d','edit','1',{'1':'line1\nline2'});assert.equal(vm.compat.control('d','1').text,'line1\nline2');
 assert.throws(()=>vm.dialogEvent(f,'d','edit','2',{'2':{text:'x',selected:999}}),/inválida/);
});
