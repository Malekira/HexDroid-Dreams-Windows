'use strict';
function entry(config,id,type,data){
 if(config.settings.notifyPrivateLog!==true||data.privateOnly||data.initial||data.duplicate)return null;
 const profile=config.profiles?.find(p=>p.id===id);if(!profile)return null;
 let text;
 if(type==='presence'&&!data.renamed&&typeof data.online==='boolean')text=(data.currentNick||data.nick)+(data.online?' se conectó':' se desconectó');
 else if(type==='presence-nick'&&data.old&&data.newNick&&data.old!==data.newNick)text=data.old+' → '+data.newNick+' cambió de nick';
 if(!text)return null;
 return{target:'*notify*',nick:'Notify',event:true,eventType:'notify',activity:true,text:'['+profile.name+' · '+profile.host+'] '+text,time:data.time||new Date().toISOString()};
}
module.exports={entry};
