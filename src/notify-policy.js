'use strict';
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.NotifyPolicy=factory();
})(typeof globalThis==='object'?globalThis:this,()=>{
  const fold=s=>String(s).toLowerCase().replace(/[\[\]\\^]/g,c=>({'[':'{',']':'}','\\':'|','^':'~'})[c]);
  const unique=values=>[...new Map(values.map(n=>[fold(n),n])).values()];
  const host=p=>String(p?.host||'').toLowerCase().replace(/\.$/,'');
  function sanitize(rows){
    if(!Array.isArray(rows))return null;
    const seen=new Set(),encoder=new TextEncoder();
    return rows.slice(0,2000)
      .filter(r=>r&&typeof r.nick==='string'&&r.nick.length>0&&r.nick.length<=40&&encoder.encode(r.nick).length<=80
        &&!/^[#&+!~@%]|[\s,:\x00-\x1f]/.test(r.nick)&&typeof r.list==='string'&&r.list.length>0&&r.list.length<=100
        &&['connection','server','all'].includes(r.scope))
      .map(r=>({nick:r.nick,list:r.list,scope:r.list==='all'?'all':r.scope}))
      .filter(r=>{const key=r.list+':'+fold(r.nick);if(seen.has(key))return false;seen.add(key);return true;});
  }
  function entries(config){
    const s=config.settings||{};
    if(Array.isArray(s.notifyEntries))return sanitize(s.notifyEntries);
    const local=(config.profiles||[]).flatMap(p=>(p.notifyNicks||[]).map(nick=>({nick,list:p.id,scope:'connection'})));
    return s.sharedNotify?[...local,...(s.sharedNotifyNicks||[]).map(nick=>({nick,list:'all',scope:'all'}))]:local;
  }
  function applies(config,row,profile){
    if(row.list==='all'||row.scope==='all'||row.list===profile.id)return true;
    const owner=(config.profiles||[]).find(p=>p.id===row.list);
    return row.scope==='server'&&!!host(owner)&&host(owner)===host(profile);
  }
  function names(config,profile){
    if(!Array.isArray(config.settings?.notifyEntries))
      return config.settings?.sharedNotify?config.settings.sharedNotifyNicks||[]:profile.notifyNicks||[];
    return unique(entries(config).filter(r=>applies(config,r,profile)).map(r=>r.nick));
  }
  return{entries,applies,names,unique,sanitize};
});
