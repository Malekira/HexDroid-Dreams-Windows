'use strict';
(()=>{
 async function refresh(items){
  if(!items&&api.advanced){const r=await api.advanced('script.menus');if(r?.error)throw Error(r.error);items=Array.isArray(r)?r:[];}
  document.querySelectorAll('.script-menu-item').forEach(b=>b.remove());
  for(const item of items||[]){
   const menu=[...document.querySelectorAll('.menubar nav>.menu')].find(m=>m.querySelector(':scope>summary')?.textContent.trim()===item.location);if(!menu)continue;
   const b=el('button','script-menu-item',item.label);b.title='Script: '+item.scriptName;b.dataset.script=item.script;
   b.onclick=async()=>{menu.open=false;try{const r=await api.advanced('script.menu.run',{script:item.script,key:item.key,network:active?.id||selectedNetworkId,target:selected()?.name||'*',nick:window.getDreamsProfileContext?.()?.id===active?.id?window.getDreamsProfileContext().nick:selected()?.kind==='private'?selected().name:''});if(r?.error)throw Error(r.error);}catch(e){notify(e.message,true);}};
   menu.querySelector(':scope>.menu-popup')?.append(b);
  }
 }
 api.onEvent(e=>{if(e.type==='script-commands')refresh(e.menus).catch(err=>notify(err.message,true));});
 refresh().catch(e=>notify(e.message,true));
})();
