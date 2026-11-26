'use strict';
const {parentPort}=require('node:worker_threads');
const {MslVM}=require('./language');
const scripts=new Map();
parentPort.on('message',message=>{
 try{
  let result;
  if(message.type==='install'){
   scripts.clear();for(const s of message.scripts)scripts.set(s.id,new MslVM(s.source));result={ok:true};
  }else if(message.type==='alias'||message.type==='event'){
   const vm=scripts.get(message.script);if(!vm)throw Error('Addon no disponible.');
   result=message.type==='event'?vm.dispatch(message.name,message.fields,message.args):vm.invoke(message.name,message.fields,message.args);
  }else throw Error('Solicitud mSL no válida.');
  parentPort.postMessage({id:message.id,result});
 }catch(e){parentPort.postMessage({id:message.id,error:e.message});}
});
