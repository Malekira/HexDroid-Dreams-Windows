'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {MslVM,compile}=require('../src/scripts/mirc/language'),{MircManager}=require('../src/scripts/mirc/manager');
const source=fs.readFileSync(path.join(__dirname,'fixtures/mirc/Control_Privados_mIRC_v87.mrc'),'utf8');
const context={network:'n1',cid:1,buffer:'*',queries:[],now:1700000000000};
const fields=(nick,extra={})=>({...context,nick,buffer:nick,private:true,...extra});
function vm(){return new MslVM(source);}
function run(v,name,args=[],f=context){return v.invoke(name,f,args);}
function incoming(v,nick,text,event='OPEN',f={}){return v.dispatch(event,fields(nick,f),text.split(' '));}
function messages(r){return r.actions.filter(a=>a.type==='msg').map(a=>a.text);}
test('the exact latest uploaded source compiles without translating or changing the addon',()=>{
 assert.equal(crypto.createHash('sha256').update(Buffer.from(source)).digest('hex'),'b96edd2737254ff9f6c81c562db8a3740b9f6ee75843d55b40c668140e968a1c');
 const c=compile(source);assert.equal(c.size,32);assert.equal(c.dialogs.size,2);assert.equal(c.handlers.length,16);
});
test('first private is held once; later messages are buffered, acceptance opens the query and replays them',()=>{
 const v=vm(),first=incoming(v,'Alice','primero "literal"');assert.equal(first.halted,true);assert.equal(messages(first).length,1);assert.match(messages(first)[0],/^Alice Espere/);
 assert.equal(incoming(v,'Alice','segundo').actions.length,0);
 const accepted=run(v,'si',['Alice']);assert.equal(accepted.actions[0].type,'query');assert.ok(accepted.actions.some(a=>a.text.includes('primero "literal"')));assert.ok(accepted.actions.some(a=>a.text.includes('segundo')));assert.match(messages(accepted)[0],/^Alice Hola Alice/);
 const normal=incoming(v,'Alice','tercero','TEXT');assert.equal(normal.halted,false);assert.deepEqual(messages(normal),[]);
});
test('reject responds once and blocks until reset, ignore discards without blocking or responding',()=>{
 const v=vm();incoming(v,'Alice','uno');assert.match(messages(run(v,'no',['Alice']))[0],/^Alice Disculpa Alice/);
 assert.equal(incoming(v,'Alice','dos').halted,true);assert.deepEqual(messages(incoming(v,'Alice','tres')),[]);
 run(v,'pvreset',['Alice']);assert.equal(messages(incoming(v,'Alice','otra')).length,1);
 const ignored=run(v,'pvignorar',['Alice']);assert.deepEqual(messages(ignored),[]);assert.equal(messages(incoming(v,'Alice','nueva')).length,1);
});
test('buffers stop at 25 entries, actions are retained and private histories do not mix networks',()=>{
 const v=vm();for(let i=0;i<30;i++)incoming(v,'Alice','linea'+i);
 const r=run(v,'si',['Alice']);assert.ok(r.actions.some(a=>a.text.includes('linea24')));assert.ok(!r.actions.some(a=>a.text.includes('linea25')));
 incoming(v,'Bob','red uno');incoming(v,'Bob','red dos','OPEN',{network:'n2',cid:2});
 const chosen=run(v,'si',['Bob']);assert.ok(chosen.actions.some(a=>a.text.includes('red uno')));assert.ok(!chosen.actions.some(a=>a.text.includes('red dos')));
 const other=run(v,'si',['Bob'],{...context,network:'n2',cid:2});assert.ok(other.actions.some(a=>a.text.includes('red dos')));
});
test('ACTION on an open pending query is buffered with its action marker',()=>{
 const v=vm();incoming(v,'Alice','hola');incoming(v,'Alice','saluda a todos','ACTION');const result=run(v,'si',['Alice']);assert.ok(result.actions.some(a=>a.text.includes('* saluda a todos')));
});
test('configuration controls update persistent INI, automatic mode and personalised replies',()=>{
 const v=vm();let config=run(v,'pvconfig');assert.equal(config.dialogs[0].name,'pv_config');
 const saved=v.dialogEvent(context,'pv_config','sclick','30',{'11':'Espera {nick}','13':'Bien "{nick}"','15':'No {nick}','20':false,'21':true,'22':false,'23':false});
 assert.deepEqual(saved.closed,['pv_config']);assert.equal(saved.ini['addon:/pv_saludo.ini'].mensajes.aceptacion,'Bien "{nick}"');
 const restarted=new MslVM(source,saved.ini),accepted=incoming(restarted,'Alice','hola');assert.equal(accepted.halted,false);assert.deepEqual(messages(accepted),['Alice Bien "Alice"']);assert.deepEqual(accepted.dialogs,[]);
});
test('dialog selection routes approval to the selected numeric connection and only that connection',()=>{
 const v=vm(),a={...context},b={...context,network:'n2',cid:2};const connections=[a,b];
 incoming(v,'Alice','red uno','OPEN',{connections});incoming(v,'Alice','red dos','OPEN',{network:'n2',cid:2,connections});
 const shown=run(v,'pvpendientes',[],{...a,connections});const entries=shown.dialogs[0].controls.find(c=>c.id==='10').items;assert.equal(entries.length,2);
 const r=v.dialogEvent({...a,connections},'pv_pendientes','sclick','20',{'10':2,'40':0,'41':''});assert.ok(r.actions.filter(a=>a.type==='query').every(a=>a.network==='n2'));assert.ok(r.actions.some(a=>a.text.includes('red dos')));assert.ok(!r.actions.some(a=>a.text.includes('red uno')));
});
test('autoaccepted nicks survive worker reload and removal does not silently revoke an active acceptance',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'pv87-persist-')),network={network:'n1',buffer:'*'},out=[];
 const m=new MircManager(directory,{connections:()=>[network],host:async a=>out.push(...a),snapshot:f=>f});t.after(()=>{m.close();fs.rmSync(directory,{recursive:true,force:true});});
 const {id}=await m.install('Control_Privados_mIRC_v87.mrc',Buffer.from(source),network);
 await m.alias('pvautoagregar',network,['Alice']);await m.configure(id,false);await m.configure(id,true);
 assert.equal((await m.privateMessage(fields('Alice',{text:'hola'}))).halted,false);assert.ok(out.some(a=>a.type==='msg'&&a.text.startsWith('Alice Hola')));
 await m.alias('pvautoquitar',network,['Alice']);assert.equal((await m.privateMessage(fields('Alice',{text:'otra'}))).halted,false);
 await m.alias('pvreset',network,['Alice']);assert.equal((await m.privateMessage(fields('Alice',{text:'pendiente'}))).halted,true);
 assert.ok(!m.completions().some(a=>a.name.startsWith('pv.')));
});
test('sandboxed INI rejects paths outside the addon and unsupported executable commands remain rejected',()=>{
 assert.throws(()=>compile('alias a { run file.exe }'),/no soportado/);
 const bad=new MslVM('alias a { writeini /tmp/shared.ini Section Key value }');assert.throws(()=>bad.invoke('a'),/espacio privado/);
 const proto=new MslVM('alias a { writeini addon:/x.ini Autoaceptados __proto__ 1 | return $readini(addon:/x.ini,n,Autoaceptados,__proto__) }');assert.equal(proto.invoke('a').value,'1');assert.equal({}.polluted,undefined);
});
test('loading a different addon preserves existing pending requests and manual acceptance state',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'pv87-other-')),m=new MircManager(directory,{snapshot:f=>f,host:async()=>{}});t.after(()=>{m.close();fs.rmSync(directory,{recursive:true,force:true});});
 await m.install('pv87.mrc',Buffer.from(source),context);assert.equal((await m.privateMessage(fields('Alice',{text:'pendiente conservado'}))).halted,true);
 const other=await m.install('other.mrc',Buffer.from('alias other { echo -s otro }'));
 const accepted=await m.alias('si',context,['Alice']);assert.ok(accepted.actions.some(a=>a.text.includes('pendiente conservado')));
 await m.configure(other.id,false);assert.equal((await m.privateMessage(fields('Alice',{text:'sigue aceptado'}))).halted,false);
});
test('import rejects an active hex command collision instead of silently running the older private controller',async()=>{
 const {Runtime}=require('../src/services/runtime');let installed=false;
 const context={sessions:{get:()=>null},pick:async()=>path.join(__dirname,'fixtures/mirc/Control_Privados_mIRC_v87.mrc'),scripts:{completions:()=>[{name:'pvconfig',script:'Control-anterior.hex'}]},mirc:{install:async()=>{installed=true;}}};
 await assert.rejects(Runtime.prototype.action.call(context,'script.mirc.import'),/Desactivá primero.*Control-anterior/);assert.equal(installed,false);
});
