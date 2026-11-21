'use strict';
// A bounded session cache, independent of SQLite, used only to restore a lost Status view.
class StatusActivity{
 constructor(){this.rows=new Map();this.sequence=0;}
 record(id,type,data){
  if(!id||!data||typeof data!=='object')return;
  let message;
  if(type==='status')message={event:true,statusCategory:'connection',text:data.text};
  else if(type==='server'&&(!data.target||data.target==='*')&&!data.routinePresence)message={event:true,statusCategory:data.error?'errors':data.whois?'queries':data.code?'commands':'server',code:data.code,text:data.text,error:data.error};
  else if(type==='problem')message={event:true,error:true,critical:data.historyFailure===true,text:data.text};
  else if(type==='connection-error')message={event:true,error:true,critical:true,statusCategory:'errors',code:data.code,text:data.text};
  if(!message)return;
  message.time=data.time||new Date().toISOString();message.statusEventId=String(++this.sequence);
  const rows=this.rows.get(id)||[];rows.push(message);if(rows.length>200)rows.shift();this.rows.set(id,rows);return message;
 }
 snapshot(id){return structuredClone(this.rows.get(id)||[]);}
}
module.exports={StatusActivity};
