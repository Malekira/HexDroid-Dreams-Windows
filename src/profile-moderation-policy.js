'use strict';
(function(root){
 const fold=value=>String(value||'').toLowerCase().replace(/[\[\]\\^]/g,c=>({'[':'{',']':'}','\\':'|','^':'~'})[c]);
 function roomFor(network,nick,preferred=''){
  if(network?.state!=='connected')return null;
  const prefixes=network.prefixes||'~&@%+',modes=network.prefixModes||'qaohv';
  const bare=value=>{let i=0;while(prefixes.includes(value[i])&&i<value.length)i++;return value.slice(i).split('!')[0];};
  const rooms=[...(network.conversations?.values()||[])].filter(c=>c.kind==='channel'&&c.joined);
  rooms.sort((a,b)=>Number(fold(b.name)===fold(preferred))-Number(fold(a.name)===fold(preferred)));
  for(const room of rooms){
   const users=room.users||[];
   if(!users.some(u=>fold(bare(u))===fold(nick)))continue;
   const own=users.find(u=>fold(bare(u))===fold(network.nick));
   if(!own)continue;
   let i=0;while(i<own.length&&prefixes.includes(own[i])){if('qaoh'.includes(modes[prefixes.indexOf(own[i])]))return room.name;i++;}
  }
  return null;
 }
 const policy={roomFor};if(typeof module==='object'&&module.exports)module.exports=policy;else root.DreamsProfileModeration=policy;
})(typeof globalThis==='object'?globalThis:this);
