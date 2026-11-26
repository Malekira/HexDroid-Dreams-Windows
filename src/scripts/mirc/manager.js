'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {Worker}=require('node:worker_threads');
const {compile}=require('./language');
const {decode}=require('./importer');
class MircManager {
 constructor(directory,{host=async()=>{},snapshot=()=>({}),session=()=>null,changed=()=>{}}={}){
  this.file=path.join(directory,'mirc-addons.json');this.host=host;this.snapshot=snapshot;this.session=session;this.changed=changed;
  this.catalog=new Map();this.loadError=null;this.scripts=[];this.pending=new Map();this.count=0;this.serial=Promise.resolve();this.closed=false;this.epoch=0;this.activeCalls=0;this.worker=null;
  try{if(fs.existsSync(this.file)){
   const data=JSON.parse(fs.readFileSync(this.file,'utf8'));if(!Array.isArray(data)||data.length>50)throw Error('Registro de addons mIRC no válido.');
   for(const s of data){if(typeof s.id!=='string'||typeof s.name!=='string'||typeof s.source!=='string'||typeof s.enabled!=='boolean')throw Error('Addon guardado no válido.');compile(s.source);this.scripts.push(s);}
  }}catch(e){this.scripts=[];this.loadError='No se pudo cargar el registro mIRC: '+e.message;}
 }
 aliases(source){if(!this.catalog.has(source))this.catalog.set(source,compile(source));return [...this.catalog.get(source).values()].filter(a=>!a.local).map(a=>a.name);}
 list(){return this.scripts.map(s=>({id:s.id,name:s.name,enabled:s.enabled,aliases:this.aliases(s.source),events:this.catalog.get(s.source).handlers.map(h=>h.event)}));}
 completions(){return this.list().filter(s=>s.enabled).flatMap(s=>s.aliases.map(name=>({name,usage:'/'+name,description:'Alias mIRC · '+s.name,script:s.name,owner:s.id,scriptName:s.name})));}
 save(){if(this.loadError)throw Error(this.loadError);fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file+'.tmp',JSON.stringify(this.scripts,null,2),{mode:0o600});fs.renameSync(this.file+'.tmp',this.file);this.catalog.clear();this.changed();}
 transaction(fn){const task=this.serial.then(()=>{if(this.closed)throw Error('Motor mSL cerrado.');if(this.loadError)throw Error(this.loadError);return fn();});this.serial=task.catch(()=>{});return task;}
 install(name,buffer){return this.transaction(async()=>{
  if(typeof name!=='string'||!name||name.length>100||this.scripts.length>=50)throw Error('Nombre o límite de addons no válido.');
  const {source}=decode(buffer),aliases=[...compile(source).values()].filter(a=>!a.local).map(a=>a.name);
  const existing=new Set(this.list().flatMap(s=>s.aliases));for(const a of aliases)if(existing.has(a))throw Error('Alias mIRC ya instalado: '+a);
  const script={id:crypto.randomUUID(),name,source,enabled:true};this.scripts.push(script);
  try{this.save();}catch(e){this.scripts.pop();throw e;}this.stop();return {id:script.id,aliases};
 });}
 configure(id,enabled){this.epoch++;return this.transaction(()=>{const s=this.scripts.find(s=>s.id===id);if(!s)throw Error('Addon no encontrado.');const old=s.enabled;s.enabled=enabled===true;try{this.save();}catch(e){s.enabled=old;throw e;}this.stop();return {ok:true};});}
 remove(id){this.epoch++;return this.transaction(()=>{const old=this.scripts;this.scripts=this.scripts.filter(s=>s.id!==id);try{this.save();}catch(e){this.scripts=old;throw e;}this.stop();return {ok:true};});}
 stop(){const worker=this.worker;this.worker=null;if(worker)worker.terminate();for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('El motor mSL se detuvo.'));}this.pending.clear();}
 request(message){return new Promise((resolve,reject)=>{
  const id=++this.count,timer=setTimeout(()=>{this.pending.delete(id);reject(Error('Se detuvo el addon por exceder el tiempo mSL.'));this.stop();},1000);
  this.pending.set(id,{resolve,reject,timer});this.worker.postMessage({...message,id});
 });}
 async start(){
  if(this.worker)return;
  const worker=this.worker=new Worker(path.join(__dirname,'worker.js'),{resourceLimits:{maxOldGenerationSizeMb:32,stackSizeMb:2}});
  worker.on('message',message=>{if(this.worker!==worker)return;const p=this.pending.get(message.id);if(!p)return;this.pending.delete(message.id);clearTimeout(p.timer);message.error?p.reject(Error(message.error)):p.resolve(message.result);});
  worker.on('error',()=>{if(this.worker===worker)this.stop();});
  worker.on('exit',()=>{if(this.worker===worker)this.stop();});
  await this.request({type:'install',scripts:this.scripts.filter(s=>s.enabled)});
 }
 alias(name,fields,args=[]){
  if(this.loadError||!this.completions().some(a=>a.name.toLowerCase()===name.toLowerCase()))return Promise.resolve({handled:false});
  if(this.activeCalls>=8)return Promise.reject(Error('Hay demasiados comandos mSL pendientes.'));
  this.activeCalls++;const session=this.session(fields);
  return this.transaction(async()=>{const epoch=this.epoch;if(this.session(fields)!==session)throw Error('Se canceló el comando mSL porque cambió la sesión.');
  const command=this.completions().find(a=>a.name.toLowerCase()===name.toLowerCase());if(!command)return {handled:false};
  if(!Array.isArray(args)||args.length>1000||args.some(a=>typeof a!=='string')||JSON.stringify(args).length>16384)throw Error('Argumentos mSL demasiado grandes.');
  const snapshot=this.snapshot(fields);if(JSON.stringify(snapshot).length>2*1024*1024)throw Error('Estado IRC demasiado grande para el addon.');
  await this.start();const result=await this.request({type:'alias',script:command.owner,name,fields:snapshot,args});
  // The host validates the entire action batch before delivering anything.
  if(result.handled)await this.host(result.actions,fields,()=>!this.closed&&this.epoch===epoch&&this.session(fields)===session);return result;
 }).finally(()=>{this.activeCalls--;});}
 event(name,fields,args=[]){
  const owners=this.list().filter(s=>s.enabled&&s.events.includes(name));
  if(!owners.length||this.loadError||this.closed)return Promise.resolve({handled:false});
  if(this.activeCalls>=8)return Promise.reject(Error('Se omitió un evento mSL por exceso de trabajo pendiente.'));
  this.activeCalls++;const session=this.session(fields);
  return this.transaction(async()=>{
   if(this.session(fields)!==session)return {handled:false};
   const epoch=this.epoch,snapshot=this.snapshot(fields);
   if(JSON.stringify(snapshot).length>2*1024*1024)throw Error('Estado IRC demasiado grande para el addon.');
   await this.start();let handled=false;
   for(const owner of owners){
    if(!this.scripts.some(s=>s.id===owner.id&&s.enabled)||epoch!==this.epoch)break;
    const result=await this.request({type:'event',script:owner.id,name,fields:snapshot,args});
    if(result.handled){handled=true;await this.host(result.actions,fields,()=>!this.closed&&epoch===this.epoch&&this.session(fields)===session);}
   }
   return {handled};
  }).finally(()=>{this.activeCalls--;});
 }
 close(){this.closed=true;this.epoch++;this.stop();}
}
module.exports={MircManager};
