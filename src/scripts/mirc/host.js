'use strict';
const {executeInput}=require('../../commands');
const {token,cleanText}=require('../../irc');
const iconv=require('iconv-lite');
const {take}=require('./state');
function snapshot(client,fields){
 const known=client?.identityCache?client.identityCache.snapshot():[...(client?.userStates||[])].map(([nick,user])=>({nick,...user}));
 const addresses=known.map(user=>({nick:user.nick,ident:user.ident||'',host:user.host||''}));
 return {...fields,server:client?.profile?.host||'',notify:client?.presence?.names||[],channel:/^[#&+!]/.test(fields.chan||''),chan:/^[#&+!]/.test(fields.chan||'')?fields.chan:'',networkName:client?.network||client?.profile?.name||fields.network,me:client?.nick||'',prefixes:client?.prefixes||'~&@%+',rooms:[...(client?.members||[])].map(([name,users])=>({name,users:[...users.values()]})),addresses};
}
function prepare(actions,fields,client){
 if(!Array.isArray(actions)||actions.length>200)throw Error('Lote mSL demasiado grande.');
 const out=[];
 const line=value=>{cleanText(value);if(iconv.encode(value,client?.profile?.encoding||'utf8').length>510)throw Error('Una línea mSL supera el límite IRC.');};
 const probe={ready:true,nick:client?.nick||'',sendRaw:line,sendMessage:(target,text)=>{token(target,'Destino');line('PRIVMSG '+target+' :'+text);}};
 for(const action of actions){
  if(typeof action.text!=='string'||/[\r\n\0]/.test(action.text))throw Error('Texto de acción mSL inválido.');
  if(action.type==='echo'){
   let text=action.text,color=null,target=fields.buffer||'*';
   const peek=()=>take(text,1).values[0],pop=()=>{const v=take(text,1);text=v.rest;return v.values[0];};
   if(/^\d{1,2}$/.test(peek()||''))color=pop();
   if(peek()==='-s'){target='*';pop();}else if(peek()==='-a')pop();
   else if(peek()?.startsWith('-'))throw Error('Opción echo todavía no soportada.');
   else if(/^[#&+!@]/.test(peek()||'')||(fields.queries||[]).some(q=>q.toLowerCase()===String(peek()).toLowerCase()))target=pop();
   out.push({type:'echo',target,text:(color!==null?'\x03'+color.padStart(2,'0'):'')+text});continue;
  }
  if(['custom-window','text-file','fullname','flood','ignore'].includes(action.type)){out.push({...action});continue;}
  if(['query','close'].includes(action.type)){token(action.text,'Nick');out.push({type:action.type,target:action.text});if(action.type==='query')(fields.queries||=[]).push(action.text);continue;}
  if(action.type==='tip'){out.push({type:'tip',text:action.text,title:String(action.title||'Addon')});continue;}
  if(!client?.ready)throw Error('Conecta primero esta red.');
  let command,target=fields.buffer||'*';
  if(action.type==='kick'){
   const m=/^([#&+!][^\s,]+)\s+(\S+)(?:\s+([\s\S]*))?$/.exec(action.text);if(!m)throw Error('Uso mSL: kick #sala nick motivo');target=m[1];command='/kick '+m[2]+(m[3]?' '+m[3]:'');
  }else if(['who','whois','join','part','nick','me','say','ban','unban','op','deop','voice','devoice'].includes(action.type)){
   if(action.type==='say')command='/msg '+target+' '+action.text;
   else if(['ban','unban','op','deop','voice','devoice'].includes(action.type)){
    const parts=take(action.text,1),room=/^[#&+!]/.test(parts.values[0])?parts.values[0]:target,args=room===parts.values[0]?parts.rest:action.text;
    target=room;command='/'+action.type+' '+args;
    if(action.type==='ban'&&/\s+[025]$/.test(args)){const [nick,type]=args.split(/\s+/),u=(fields.addresses||[]).find(u=>u.nick.toLowerCase()===nick.toLowerCase());if(!u?.host)throw Error('Consultá WHOIS para obtener el host del ban.');command='/ban '+(type==='2'?'*!*@'+u.host:type==='0'?'*!'+u.ident+'@'+u.host:nick+'!'+u.ident+'@'+u.host);}
   }else if(action.type==='part'){const p=take(action.text,1);if(/^[#&+!]/.test(p.values[0]||'')){target=p.values[0];command='/part '+p.rest;}else command='/part '+action.text;}else command='/'+action.type+' '+action.text;
  }else if(['mode','msg','notice'].includes(action.type)){
   command='/'+action.type+' '+action.text;
   if(action.type==='mode'&&!/^[#&+!][^\s,]+(?:\s+[+-][a-zA-Z]+(?:\s+[^\r\n]*)?)?$/.test(action.text))throw Error('Uso mSL: mode #sala [modos argumentos]');
  }else throw Error('Acción mSL no soportada: '+action.type);
  executeInput(probe,target,command);const msg=action.type==='msg'?/^(\S+)\s+([\s\S]+)$/.exec(action.text):null;out.push({type:'command',target,command,...(msg?{to:msg[1],body:msg[2],noEcho:!(/^[#&+!]/.test(msg[1])||(fields.queries||[]).some(q=>q.toLowerCase()===msg[1].toLowerCase()))}: {})});
 }
 return out;
}
class MircHost {
 constructor({client,emit,local=()=>{},delay=ms=>new Promise(resolve=>setTimeout(resolve,ms)),now=()=>Date.now()}){this.client=client;this.emit=emit;this.local=local;this.delay=delay;this.now=now;this.last=new Map();}
 async deliver(actions,fields,valid=()=>true){
  if(!Array.isArray(actions)||actions.length>200||actions.filter(a=>['mode','kick','msg','notice','who','whois','join','part','nick','me','say','ban','unban','op','deop','voice','devoice'].includes(a.type)).length>40)throw Error('Lote mSL demasiado grande.');
  const snapshots=new Map(),queries=new Map();
  const batch=actions.map(action=>{
   const network=action.network||fields.network,client=this.client(network);
   if(!snapshots.has(network))snapshots.set(network,{client,socket:client?.socket});
   if(!queries.has(network))queries.set(network,[...(fields.queries||[])]);
   const a=prepare([action],{...fields,buffer:action.buffer||fields.buffer,addresses:snapshots.get(network).client?snapshot(snapshots.get(network).client,fields).addresses:[],queries:queries.get(network)},client)[0];return {...a,network};
  });
  const sessionValid=network=>{const saved=snapshots.get(network);return this.client(network)===saved.client&&saved.client?.ready&&saved.client.socket===saved.socket;};
  for(const a of batch){
   if(!valid())throw Error('Se canceló el addon mSL.');
   const client=snapshots.get(a.network).client;
   if(a.type==='echo'){if(a.target.startsWith('@')){this.emit(a.network,'mirc-window',{name:a.target,operation:'open'});a.target='*addon-'+a.target.slice(1)+'*';}this.emit(a.network,'message',{target:a.target,text:a.text,event:true,scriptOutput:true,nick:'script',systemSource:'script'});continue;}
   if(['fullname','flood','ignore','text-file'].includes(a.type)){await this.local(a,fields);continue;}
   if(a.type==='custom-window'){this.emit(a.network,'mirc-window',{name:a.text,operation:a.operation});continue;}
   if(a.type==='tip'){this.emit(a.network,'mirc-tip',{title:a.title,text:a.text});continue;}
   if(['query','close'].includes(a.type)){this.emit(a.network,'script-conversation',{target:a.target,operation:a.type==='query'?'open':'close',user:true});continue;}
   const remaining=Math.min(350,350-(this.now()-(this.last.get(a.network)||0)));if(remaining>0)await this.delay(remaining);
   if(!valid()||!sessionValid(a.network))throw Error('Se canceló el addon porque cambió o se desconectó la sesión.');
   if(a.noEcho)client.sendMessage(a.to,a.body,false,{noEcho:true});else executeInput(client,a.target,a.command,(type,data)=>this.emit(a.network,type,data));this.last.set(a.network,this.now());
  }

 }
}
module.exports={snapshot,prepare,MircHost};
