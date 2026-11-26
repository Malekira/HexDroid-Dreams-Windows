'use strict';
const {executeInput}=require('../../commands');
const {token,cleanText}=require('../../irc');
const iconv=require('iconv-lite');
function snapshot(client,fields){
 const known=client?.identityCache?client.identityCache.snapshot():[...(client?.userStates||[])].map(([nick,user])=>({nick,...user}));
 const addresses=known.map(user=>({nick:user.nick,ident:user.ident||'',host:user.host||''}));
 return {...fields,chan:/^[#&+!]/.test(fields.chan||'')?fields.chan:'',networkName:client?.network||client?.profile?.name||fields.network,me:client?.nick||'',prefixes:client?.prefixes||'~&@%+',rooms:[...(client?.members||[])].map(([name,users])=>({name,users:[...users.values()]})),addresses};
}
function prepare(actions,fields,client){
 if(!Array.isArray(actions)||actions.length>40)throw Error('Lote mSL demasiado grande.');
 const out=[];
 const line=value=>{cleanText(value);if(iconv.encode(value,client?.profile?.encoding||'utf8').length>510)throw Error('Una línea mSL supera el límite IRC.');};
 const probe={ready:true,nick:client?.nick||'',sendRaw:line,sendMessage:(target,text)=>{token(target,'Destino');line('PRIVMSG '+target+' :'+text);}};
 for(const action of actions){
  if(typeof action.text!=='string'||/[\r\n\0]/.test(action.text))throw Error('Texto de acción mSL inválido.');
  if(action.type==='echo'){
   let text=action.text,target=fields.buffer||'*';
   if(/^-[as](?:\s|$)/.test(text)){if(text.startsWith('-s'))target='*';text=text.slice(2).trimStart();}
   else if(text.startsWith('-'))throw Error('Opción echo todavía no soportada.');
   out.push({type:'echo',target,text});continue;
  }
  if(!client?.ready)throw Error('Conecta primero esta red.');
  let command,target=fields.buffer||'*';
  if(action.type==='kick'){
   const m=/^([#&+!][^\s,]+)\s+(\S+)(?:\s+([\s\S]*))?$/.exec(action.text);if(!m)throw Error('Uso mSL: kick #sala nick motivo');target=m[1];command='/kick '+m[2]+(m[3]?' '+m[3]:'');
  }else if(['mode','msg','notice'].includes(action.type)){
   command='/'+action.type+' '+action.text;
   if(action.type==='mode'&&!/^[#&+!][^\s,]+(?:\s+[+-][a-zA-Z]+(?:\s+[^\r\n]*)?)?$/.test(action.text))throw Error('Uso mSL: mode #sala [modos argumentos]');
  }else throw Error('Acción mSL no soportada: '+action.type);
  executeInput(probe,target,command);out.push({type:'command',target,command});
 }
 return out;
}
class MircHost {
 constructor({client,emit,delay=ms=>new Promise(resolve=>setTimeout(resolve,ms)),now=()=>Date.now()}){this.client=client;this.emit=emit;this.delay=delay;this.now=now;this.last=new Map();}
 async deliver(actions,fields,valid=()=>true){
  const client=this.client(fields.network),socket=client?.socket,batch=prepare(actions,fields,client);
  const needsConnection=batch.some(a=>a.type==='command');
  const sessionValid=()=>this.client(fields.network)===client&&client?.ready&&client.socket===socket;
  for(const a of batch){
   if(!valid()||(needsConnection&&!sessionValid()))throw Error('Se canceló el addon mSL.');
   if(a.type==='echo'){this.emit(fields.network,'message',{target:a.target,text:a.text,event:true,nick:'script',systemSource:'script'});continue;}
   const remaining=Math.min(350,350-(this.now()-(this.last.get(fields.network)||0)));if(remaining>0)await this.delay(remaining);
   if(!valid()||this.client(fields.network)!==client||!client?.ready||client.socket!==socket)throw Error('Se canceló el addon porque cambió o se desconectó la sesión.');
   executeInput(client,a.target,a.command,(type,data)=>this.emit(fields.network,type,data));this.last.set(fields.network,this.now());
  }
 }
}
module.exports={snapshot,prepare,MircHost};
