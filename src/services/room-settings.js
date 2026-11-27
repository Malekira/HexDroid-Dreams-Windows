'use strict';
const {fold,token,cleanText}=require('../irc'),iconv=require('iconv-lite'),moderation=require('./moderation');
function channel(room){token(room,'Sala');if(!/^[#&+!][^\s,:\0\r\n]+$/.test(room))throw Error('Sala no válida.');return room;}
function ownModes(client,room){const nick=client?.members?.get(fold(room))?.get(fold(client.nick))||'';let modes='';for(const c of nick){const at=client.prefixes.indexOf(c);if(at<0)break;modes+=client.prefixModes[at];}return modes;}
class RoomSettings{
 constructor({client,settings,save,emit=()=>{},delay=350}){Object.assign(this,{client,settings,save,emit,delay});this.states=new Map();this.joins=new Map();this.timers=new Set();}
 key(id,room){return id+'\0'+fold(channel(room));}
 preference(id,room){const p=this.settings().roomModeration?.[id]?.[fold(room)]||{};return {autoOp:p.autoOp===true,autoVoice:p.autoVoice===true,service:p.service||(/chatzona\.org$/i.test(this.client(id)?.profile.host||'')?'Chan':'ChanServ')};}
 connected(id,room,edit=false){channel(room);const c=this.client(id);if(!c?.ready||!c.members?.has(fold(room)))throw Error('Conectate y entrá en esta sala.');if(edit&&!moderation.canModerate(c,room))throw Error('Necesitás permisos de moderación en esta sala.');return c;}
 frame(client,line){cleanText(line);if(iconv.encode(line,client.profile.encoding||'utf8').length>510)throw Error('El comando supera el límite IRC de esta red.');client.sendRaw(line);}
 get(id,room){const c=this.connected(id,room),state=this.states.get(this.key(id,room))||{};return {room,topic:state.topic??'',modes:state.modes??'',topicKnown:Object.hasOwn(state,'topic'),modesKnown:Object.hasOwn(state,'modes'),canEdit:moderation.canModerate(c,room),ownModes:ownModes(c,room),topicLimit:c.topicLength||null,encoding:c.profile.encoding||'utf8',preferences:this.preference(id,room)};}
 query(id,room){const c=this.connected(id,room);this.frame(c,'TOPIC '+room);this.frame(c,'MODE '+room);return this.get(id,room);}
 topic(id,room,text){const c=this.connected(id,room,true);if(typeof text!=='string'||/[\r\n\0]/.test(text))throw Error('El topic debe tener una sola línea.');const encoding=c.profile.encoding||'utf8',bytes=iconv.encode(text,encoding);if(iconv.decode(bytes,encoding)!==text)throw Error('La codificación de esta red no admite algunos caracteres del topic.');if(c.topicLength&&bytes.length>c.topicLength)throw Error('El topic supera los '+c.topicLength+' bytes admitidos por el servidor.');this.frame(c,'TOPIC '+room+' :'+text);return {pending:true};}
 modes(id,room,text){const c=this.connected(id,room,true);if(typeof text!=='string'||! /^[+-][a-zA-Z]+(?: [^\r\n\0]+)?$/.test(text))throw Error('Usá modos IRC, por ejemplo +nt o -m.');this.frame(c,'MODE '+room+' '+text);return {pending:true};}
 preferences(id,room,value){this.connected(id,room,true);if(typeof value?.autoOp!=='boolean'||typeof value?.autoVoice!=='boolean'||typeof value.service!=='string'||! /^[a-zA-Z][a-zA-Z0-9_.-]{0,31}(?:@[a-zA-Z0-9.-]+)?$/.test(value.service))throw Error('Configuración de servicio no válida.');const settings=structuredClone(this.settings());settings.roomModeration||={};settings.roomModeration[id]||={};settings.roomModeration[id][fold(channel(room))]={autoOp:value.autoOp,autoVoice:value.autoVoice,service:value.service};this.save(settings);return {preferences:this.preference(id,room)};}
 observe(id,type,data){
  if(type==='status'&&data.state==='disconnected'){for(const [key,g]of this.joins)if(g.id===id)this.joins.delete(key);for(const key of this.states.keys())if(key.startsWith(id+'\0'))this.states.delete(key);return;}
  if((type==='topic'||type==='modes')&&typeof data.target==='string'&&/^[#&+!][^\s,:\0\r\n]+$/.test(data.target)){const key=this.key(id,data.target),state=this.states.get(key)||{};state[type==='topic'?'topic':'modes']=data.text;this.states.set(key,state);if(this.states.size>500)this.states.delete(this.states.keys().next().value);return;}
  if(type==='channel'&&data.own){const key=this.key(id,data.target);if(data.action==='join')this.joins.set(key,{id,room:data.target,client:this.client(id),names:false,sent:new Set()});else{this.joins.delete(key);this.states.delete(key);}}
  if(type==='script-raw'&&data.command==='366'&&data.params?.[1]){const g=this.joins.get(this.key(id,data.params[1]));if(g){g.names=true;this.schedule(g);}}
  if(type==='startup-ready')for(const g of this.joins.values())if(g.id===id)this.schedule(g);
 }
 schedule(g){const c=this.client(g.id);if(!g.names||c!==g.client||!c?.ready||c.startupPending)return;
  for(const [key,mode,command]of [['autoOp','o','OP'],['autoVoice','v','VOICE']]){
   const prefs=this.preference(g.id,g.room),modes=ownModes(c,g.room);if(!prefs[key]||g.sent.has(mode)|| (mode==='o'?/[qao]/.test(modes):modes.includes('v')))continue;
   g.sent.add(mode);const timer=setTimeout(()=>{this.timers.delete(timer);if(this.joins.get(this.key(g.id,g.room))!==g||this.client(g.id)!==g.client||!c.ready||c.startupPending)return;
    const p=this.preference(g.id,g.room),now=ownModes(c,g.room);if(!p[key]||(mode==='o'?/[qao]/.test(now):now.includes('v')))return;
    try{this.frame(c,'PRIVMSG '+p.service+' :'+command+' '+g.room+' '+c.nick);this.emit(g.id,'server',{text:'Solicitado +'+mode+' a '+p.service+' para '+g.room+'. Esperando respuesta del servidor.'});}catch(e){this.emit(g.id,'problem',{text:e.message});}
   },this.delay*(this.timers.size+1));timer.unref?.();this.timers.add(timer);
  }
 }
 close(){for(const timer of this.timers)clearTimeout(timer);this.timers.clear();this.joins.clear();this.states.clear();}
}
module.exports={RoomSettings,ownModes,channel};
