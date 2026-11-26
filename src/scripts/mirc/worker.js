'use strict';
const {parentPort}=require('node:worker_threads');
const {MslVM}=require('./language');
const scripts=new Map();
parentPort.on('message',message=>{
 try{
  let result;
  if(message.type==='install'||message.type==='update'){
   if(message.type==='install')scripts.clear();const enabled=new Set(message.scripts.map(s=>s.id));for(const id of scripts.keys())if(!enabled.has(id))scripts.delete(id);
   for(const s of message.scripts)if(!scripts.has(s.id))scripts.set(s.id,new MslVM(s.source,s.ini||{}));result={ok:true};
  }else if(message.type==='dialog'){
   const vm=scripts.get(message.script);if(!vm)throw Error('Addon no disponible.');
   result=vm.dialogEvent(message.fields,message.name,message.interaction,message.control,message.values);
  }else if(message.type==='alias'||message.type==='event'){
   const vm=scripts.get(message.script);if(!vm)throw Error('Addon no disponible.');
   result=message.type==='event'?vm.dispatch(message.name,message.fields,message.args):vm.invoke(message.name,message.fields,message.args);
  }else throw Error('Solicitud mSL no válida.');
  parentPort.postMessage({id:message.id,result});
 }catch(e){parentPort.postMessage({id:message.id,error:e.message});}
});
