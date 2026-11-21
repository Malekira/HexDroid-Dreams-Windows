'use strict';
const fold=s=>String(s).toLowerCase().replace(/[\[\]\\^]/g,c=>({'[':'{',']':'}','\\':'|','^':'~'})[c]);
class IdentityCache{
 constructor(){this.rows=new Map();}
 observe(o){
  if(!o?.nick)return;
  const key=fold(o.nick);
  if(o.kind==='quit'||o.kind==='missing'){this.rows.delete(key);return;}
  if(o.kind==='part'){
   if(o.own){for(const [k,r]of this.rows)if(r.channels.delete(o.channel)&&!r.channels.size)this.rows.delete(k);}
   else{const r=this.rows.get(key);if(r){r.channels.delete(o.channel);if(!r.channels.size)this.rows.delete(key);}}
   return;
  }
  if(o.kind==='query-end')return;
  let r=this.rows.get(key)||{nick:o.nick,channels:new Set()};
  if(o.host&&r.host&&o.host!==r.host&&!['host','nick'].includes(o.kind))r={nick:o.nick,channels:new Set(r.channels)};
  if(o.kind==='nick'){this.rows.delete(key);r.nick=o.next;}
  for(const field of ['ident','host','realName','account'])if(o[field]!==undefined)r[field]=o[field];
  if(o.channel&&/^[#&+!]/.test(o.channel))r.channels.add(o.channel);
  r.updated=Date.now();this.rows.set(fold(r.nick),r);
  if(this.rows.size>5000)this.rows.delete(this.rows.keys().next().value);
 }
 snapshot(){const rows=[];for(const r of this.rows.values()){
  if(!r.channels.size&&Date.now()-r.updated>120000)continue;
  rows.push({kind:'seen',source:'Datos ya recibidos',nick:r.nick,ident:r.ident,host:r.host,realName:r.realName,account:r.account,channel:r.channels.values().next().value||'',channels:[...r.channels]});
 }return rows;}
}
module.exports={IdentityCache};
