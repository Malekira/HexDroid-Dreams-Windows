'use strict';
const {token,fold}=require('../irc');
const replies={'367':['b',false],'368':['b',true],'348':['e',false],'349':['e',true],'346':['I',false],'347':['I',true],'728':['q',false],'729':['q',true]};
function channel(value){token(value,'Sala');if(!/^[#&+!]/.test(value))throw Error('La sala debe empezar por #, &, + o !.');return value;}
function canModerate(client,room){const me=client?.members.get(fold(room))?.get(fold(client.nick));if(!me)return false;let prefix='';for(const c of me){if(!client.prefixes.includes(c))break;prefix+=c;}return [...prefix].some(p=>'qaoh'.includes(client.prefixModes[client.prefixes.indexOf(p)]));}
function decode(m){const type=replies[m.command];if(!type)return null;const [mode,complete]=type,p=m.params;const offset=mode==='q'&&p[2]==='q'?3:2;return{channel:p[1],mode,complete,...(!complete?{mask:p[offset]||'',setter:p[offset+1]||'',timestamp:/^\d+$/.test(p[offset+2]||'')?Number(p[offset+2]):null}:{}),raw:p.slice(1).join(' ')};}
function request(client,room,mode,service='ChanServ'){
 if(!client?.ready)throw Error('Conecta esta red.');channel(room);
 if(mode==='akick'){token(service,'Servicio');client.moderationService={room,service,until:Date.now()+30000};client.sendRaw('PRIVMSG '+service+' :AKICK '+room+' LIST');}
 else{if(!['b','e','I','q'].includes(mode))throw Error('Lista no válida.');client.sendRaw('MODE '+room+' +'+mode);}
}
function remove(client,{channel:room,mode,mask,service='ChanServ'}){
 if(!client?.ready)throw Error('Conecta esta red.');channel(room);if(typeof mask!=='string'||!mask||mask.length>400||/[\s\0\r\n]/.test(mask))throw Error('Máscara no válida.');
 if(!canModerate(client,room))throw Error('Necesitás ser operador/moderador en esta sala.');
 if(mode==='akick'){token(service,'Servicio');client.sendRaw('PRIVMSG '+service+' :AKICK '+room+' DEL '+mask);}
 else{if(!['b','e','I','q'].includes(mode))throw Error('Lista no válida.');client.sendRaw('MODE '+room+' -'+mode+' '+mask);}
}
function serviceReply(client,m){const pending=client.moderationService;if(!pending||pending.until<Date.now()||!['NOTICE','PRIVMSG'].includes(m.command)||fold(m.nick)!==fold(pending.service))return null;
 const text=require('../formatting').plain(m.params[1]||'');
 // Services have no standard list numeric. Keep their exact text, only recognize an explicit numbered mask.
 const match=/^\s*(\d+)\s+((?:[^\s]+![^\s]+@[^\s]+)|(?:\*?@[^\s]+))(?=\s|$)/.exec(text);
 return{channel:pending.room,mode:'akick',service:pending.service,raw:text,mask:match?.[2]||'',entry:match?.[1]||'',setter:'',timestamp:null};
}
module.exports={channel,canModerate,decode,request,remove,serviceReply};
