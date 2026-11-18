'use strict';
(()=>{
 const checked=new WeakSet();
 window.recoverDreamsStatus=async(id,c)=>{
  if(checked.has(c)||!api.advanced)return;checked.add(c);
  try{
   const r=await api.advanced('status.activity',{network:id});
   if(r?.error||!Array.isArray(r?.messages)||network(id).conversations.get(fold('*'))!==c)return;
   const present=new Set(c.messages.map(m=>m.statusEventId).filter(Boolean));
   for(const message of r.messages){if(!present.has(message.statusEventId)){
     // Do not duplicate messages that arrived while the snapshot was being requested.
     if(!c.messages.some(m=>m.time===message.time&&m.text===message.text))workspace.addMessage(id,'*',{...message,historical:true});
     present.add(message.statusEventId);
   }}
   c.messages.sort((a,b)=>new Date(a.time)-new Date(b.time));c.revision=(c.revision||0)+1;render(true);
  }catch{checked.delete(c);}
 };
})();
