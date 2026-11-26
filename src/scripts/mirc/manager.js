'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {Worker}=require('node:worker_threads');
const {compile}=require('./language');
const {decode}=require('./importer');
class MircManager {
 constructor(directory,{host=async()=>{},snapshot=()=>({}),session=()=>null,connections=()=>[],ui=()=>{},changed=()=>{}}={}){
  this.file=path.join(directory,'mirc-addons.json');this.host=host;this.snapshot=snapshot;this.session=session;this.changed=changed;this.connections=connections;this.ui=ui;this.queries=new Map();this.cids=new Map();this.nextCid=0;
  this.catalog=new Map();this.loadError=null;this.scripts=[];this.pending=new Map();this.count=0;this.serial=Promise.resolve();this.closed=false;this.epoch=0;this.activeCalls=0;this.worker=null;
  try{if(fs.existsSync(this.file)){
   const data=JSON.parse(fs.readFileSync(this.file,'utf8'));if(!Array.isArray(data)||data.length>50)throw Error('Registro de addons mIRC no válido.');
   for(const s of data){if(typeof s.id!=='string'||typeof s.name!=='string'||typeof s.source!=='string'||typeof s.enabled!=='boolean')throw Error('Addon guardado no válido.');compile(s.source);this.scripts.push(s);}
  }}catch(e){this.scripts=[];this.loadError='No se pudo cargar el registro mIRC: '+e.message;}
 }
 aliases(source){if(!this.catalog.has(source))this.catalog.set(source,compile(source));return [...this.catalog.get(source).values()].filter(a=>!a.local&&!a.name.includes('.')).map(a=>a.name);}
 list(){return this.scripts.map(s=>({id:s.id,name:s.name,enabled:s.enabled,aliases:this.aliases(s.source),events:this.catalog.get(s.source).handlers.map(h=>h.event)}));}
 completions(){return this.list().filter(s=>s.enabled).flatMap(s=>s.aliases.filter(name=>!name.includes('.')).map(name=>({name,usage:'/'+name,description:'Alias mIRC · '+s.name,script:s.name,owner:s.id,scriptName:s.name})));}
 save(){if(this.loadError)throw Error(this.loadError);fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file+'.tmp',JSON.stringify(this.scripts,null,2),{mode:0o600});fs.renameSync(this.file+'.tmp',this.file);this.catalog.clear();this.changed();}
 transaction(fn){const task=this.serial.then(()=>{if(this.closed)throw Error('Motor mSL cerrado.');if(this.loadError)throw Error(this.loadError);return fn();});this.serial=task.catch(()=>{});return task;}
 install(name,buffer,fields={}){return this.transaction(async()=>{
  if(typeof name!=='string'||!name||name.length>100||this.scripts.length>=50)throw Error('Nombre o límite de addons no válido.');
  const {source}=decode(buffer),aliases=[...compile(source).values()].filter(a=>!a.local).map(a=>a.name);
  const existing=new Set(this.list().flatMap(s=>s.aliases));for(const a of aliases)if(existing.has(a))throw Error('Alias mIRC ya instalado: '+a);
  const script={id:crypto.randomUUID(),name,source,enabled:true};this.scripts.push(script);
  try{this.save();}catch(e){this.scripts.pop();throw e;}await this.sync();if(compile(source).handlers.some(h=>h.event==='LOAD')){await this.start();const result=await this.request({type:'event',script:script.id,name:'LOAD',fields:this.context({...fields,buffer:'*'}),args:[]});await this.deliver(script.id,result,{...fields,buffer:'*'},()=>!this.closed);}return {id:script.id,aliases};
 });}
 configure(id,enabled){this.epoch++;return this.transaction(async()=>{const s=this.scripts.find(s=>s.id===id);if(!s)throw Error('Addon no encontrado.');const old=s.enabled;s.enabled=enabled===true;try{this.save();}catch(e){s.enabled=old;throw e;}await this.sync();if(!s.enabled)this.ui({removeScript:id});return {ok:true};});}
 remove(id){this.epoch++;return this.transaction(async()=>{const old=this.scripts;this.scripts=this.scripts.filter(s=>s.id!==id);try{this.save();}catch(e){this.scripts=old;throw e;}await this.sync();this.ui({removeScript:id});return {ok:true};});}
 stop(){this.ui({reset:true});const worker=this.worker;this.worker=null;if(worker)worker.terminate();for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('El motor mSL se detuvo.'));}this.pending.clear();}
 request(message){return new Promise((resolve,reject)=>{
  const id=++this.count,timer=setTimeout(()=>{this.pending.delete(id);reject(Error('Se detuvo el addon por exceder el tiempo mSL.'));this.stop();},1000);
  this.pending.set(id,{resolve,reject,timer});this.worker.postMessage({...message,id});
 });}
 async sync(){if(this.worker)await this.request({type:'update',scripts:this.scripts.filter(s=>s.enabled).map(s=>({...s,ini:this.readIni(s.id)}))});}
 async start(){
  if(this.worker)return;
  const worker=this.worker=new Worker(path.join(__dirname,'worker.js'),{resourceLimits:{maxOldGenerationSizeMb:64,stackSizeMb:2}});
  worker.on('message',message=>{if(this.worker!==worker)return;const p=this.pending.get(message.id);if(!p)return;this.pending.delete(message.id);clearTimeout(p.timer);message.error?p.reject(Error(message.error)):p.resolve(message.result);});
  worker.on('error',()=>{if(this.worker===worker)this.stop();});
  worker.on('exit',()=>{if(this.worker===worker)this.stop();});
  await this.request({type:'install',scripts:this.scripts.filter(s=>s.enabled).map(s=>({...s,ini:this.readIni(s.id)}))});
 }
 alias(name,fields,args=[]){
  if(this.loadError||!this.completions().some(a=>a.name.toLowerCase()===name.toLowerCase()))return Promise.resolve({handled:false});
  if(this.activeCalls>=8)return Promise.reject(Error('Hay demasiados comandos mSL pendientes.'));
  this.activeCalls++;const session=this.session(fields);
  return this.transaction(async()=>{const epoch=this.epoch;if(this.session(fields)!==session)throw Error('Se canceló el comando mSL porque cambió la sesión.');
  const command=this.completions().find(a=>a.name.toLowerCase()===name.toLowerCase());if(!command)return {handled:false};
  if(!Array.isArray(args)||args.length>1000||args.some(a=>typeof a!=='string')||JSON.stringify(args).length>16384)throw Error('Argumentos mSL demasiado grandes.');
  const snapshot=this.context(fields);if(JSON.stringify(snapshot).length>2*1024*1024)throw Error('Estado IRC demasiado grande para el addon.');
  await this.start();const result=await this.request({type:'alias',script:command.owner,name,fields:snapshot,args});
  // The host validates the entire action batch before delivering anything.
  if(result.handled)await this.deliver(command.owner,result,fields,()=>!this.closed&&this.epoch===epoch&&this.session(fields)===session);return result;
 }).finally(()=>{this.activeCalls--;});}
 event(name,fields,args=[]){
  const owners=this.list().filter(s=>s.enabled&&s.events.includes(name));
  if(!owners.length||this.loadError||this.closed)return Promise.resolve({handled:false});
  if(this.activeCalls>=8)return Promise.reject(Error('Se omitió un evento mSL por exceso de trabajo pendiente.'));
  this.activeCalls++;const session=this.session(fields);
  return this.transaction(async()=>{
   if(this.session(fields)!==session)return {handled:false};
   const epoch=this.epoch,snapshot=this.context(fields);
   if(JSON.stringify(snapshot).length>2*1024*1024)throw Error('Estado IRC demasiado grande para el addon.');
   await this.start();let handled=false;
   for(const owner of owners){
    if(!this.scripts.some(s=>s.id===owner.id&&s.enabled)||epoch!==this.epoch)break;
    const result=await this.request({type:'event',script:owner.id,name,fields:snapshot,args});
    if(result.handled){handled=true;await this.deliver(owner.id,result,fields,()=>!this.closed&&epoch===this.epoch&&this.session(fields)===session);}
   }
   return {handled};
  }).finally(()=>{this.activeCalls--;});
 }
 cid(network){if(!this.cids.has(network))this.cids.set(network,++this.nextCid);return this.cids.get(network);}
 context(fields){
  const all=this.connections().map(c=>this.oneContext(c));
  const current=this.oneContext(fields);if(!all.some(c=>c.network===current.network))all.push(current);
  return {...current,connections:all};
 }
 oneContext(fields){return {...this.snapshot(fields),cid:this.cid(fields.network),queries:[...(this.queries.get(fields.network)||[])],now:Date.now()};}
 query(network,nick,open=true){if(!this.queries.has(network))this.queries.set(network,new Set());const names=this.queries.get(network),key=String(nick).toLowerCase();if(open)names.add(key);else names.delete(key);}
 dataFile(id){if(!/^[a-z\d-]{1,80}$/i.test(id))throw Error('Identificador de addon no válido.');return path.join(path.dirname(this.file),'mirc-data',id,'ini.json');}
 readIni(id){const file=this.dataFile(id);if(!fs.existsSync(file))return {};if(fs.statSync(file).size>1048576)throw Error('INI del addon demasiado grande.');return JSON.parse(fs.readFileSync(file,'utf8'));}
 async deliver(id,result,fields,valid){
  if(!valid())throw Error('Se canceló el addon mSL.');
  if(result.ini){const file=this.dataFile(id);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(result.ini),{mode:0o600});fs.renameSync(file+'.tmp',file);}
  try{await this.host(result.actions,fields,valid);}finally{if(valid()&&((result.dialogs||[]).length||(result.closed||[]).length))this.ui({script:id,network:fields.network,dialogs:result.dialogs||[],closed:result.closed||[]});}
 }
 dialog(id,name,interaction,control,values,fields){return this.transaction(async()=>{
  if(!this.scripts.some(s=>s.id===id&&s.enabled))throw Error('Addon desactivado.');
  if(JSON.stringify(values||{}).length>65536)throw Error('Formulario demasiado grande.');
  const session=this.session(fields),epoch=this.epoch;await this.start();
  const result=await this.request({type:'dialog',script:id,name,interaction,control,values,fields:this.context(fields)});
  await this.deliver(id,result,fields,()=>!this.closed&&epoch===this.epoch&&this.session(fields)===session);return {ok:true};
 });}
 privateMessage(fields){
  const owners=this.list().filter(s=>s.enabled&&s.events.some(e=>['OPEN','TEXT','ACTION'].includes(e)));
  if(!owners.length)return Promise.resolve({halted:false});
  const session=this.session(fields),epoch=this.epoch;
  return this.transaction(async()=>{
   if(this.session(fields)!==session)return {halted:true};
   await this.start();const snapshot=this.context(fields),args=String(fields.text||'').split(/\s+/),open=(this.queries.get(fields.network)||new Set()).has(String(fields.nick).toLowerCase());
   for(const owner of owners){
    for(const name of open?[fields.action?'ACTION':'TEXT']:['OPEN',fields.action?'ACTION':'TEXT']){
     const result=await this.request({type:'event',script:owner.id,name,fields:snapshot,args});
     if(result.handled)await this.deliver(owner.id,result,fields,()=>!this.closed&&epoch===this.epoch&&this.session(fields)===session);
     if(result.halted)return {halted:true};
    }
   }
   this.query(fields.network,fields.nick);return {halted:false};
  });
 }
 close(){this.closed=true;this.epoch++;this.stop();}
}
module.exports={MircManager};
