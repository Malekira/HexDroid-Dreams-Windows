"use strict";
const {fold}=require('../irc');
class ScriptConversations {
  constructor({emit,client,enabled,replay}) {this.emit=emit;this.replay=replay||((id,data)=>emit(id,'message',data));this.client=client;this.enabled=enabled;this.pending=new Map();this.entries=new Map();}
  key(script,network,nick){return JSON.stringify([script,network,fold(nick)]);}
  hold(script,network,data){if(!script)return;const key=this.key(script,network,data.target);if(!this.pending.has(key)){if(this.pending.size>=1000)throw Error('Demasiadas solicitudes pendientes.');this.pending.set(key,{...data});}}
  validate(fields,nick){if(!fields.network||!this.client(fields.network))throw Error('Red no válida.');if(typeof nick!=='string'||!nick||nick==='*'||/^[#&+!]/.test(nick)||/[\s,:\x00-\x1f]/.test(nick)||nick.length>200)throw Error('El destino debe ser un nick privado.');}
  action(action,fields){
    const [nick,...rest]=action.args||[];const {script,network}=fields;
    if(action.type.startsWith('tree.')){
      if(!network||!this.client(network))throw Error('Red no válida.');
      const [key,command,count,...label]=action.args||[];
      if(!/^[a-zA-Z0-9_.-]{1,80}$/.test(key||''))throw Error('Entrada lateral inválida.');
      const id=JSON.stringify([script,network,key]);
      if(action.type==='tree.remove')this.entries.delete(id);
      else {if(!/^[a-zA-Z][\w.-]{0,79}$/.test(command||'')||!Number.isInteger(Number(count))||Number(count)<0||Number(count)>100000)throw Error('Acción o contador inválidos.');if(this.entries.size>=200&&!this.entries.has(id))throw Error('Demasiadas entradas laterales.');this.entries.set(id,{id,script,network,key,command,count:Number(count),label:label.join(' ')||key});}
      this.publish();return;
    }
    this.validate(fields,nick);const key=this.key(script,network,nick);
    if(action.type==='send.direct'){
      const client=this.client(network);if(!client.ready)throw Error('Red desconectada.');const text=rest.join(' ');if(!text||/[\r\n\x00\x01]/.test(text))throw Error('Mensaje directo inválido.');client.sendRaw(`PRIVMSG ${nick} :${text}`);return;
    }
    if(action.type==='conversation.open'){
      this.emit(network,'script-conversation',{target:nick,operation:'open'});
      const message=this.pending.get(key);this.pending.delete(key);
      if(message)this.replay(network,{...message,retained:true});
    }else if(action.type==='conversation.close'){
      this.pending.delete(key);this.emit(network,'script-conversation',{target:nick,operation:'close'});
    }else throw Error('Acción privada desconocida.');
  }
  clean(){for(const [key,value]of this.entries)if(!this.enabled(value.script))this.entries.delete(key);for(const key of this.pending.keys())if(!this.enabled(JSON.parse(key)[0]))this.pending.delete(key);this.publish();}
  publish(){this.emit(null,'script-tree',{entries:[...this.entries.values()]});}
}
module.exports={ScriptConversations};
