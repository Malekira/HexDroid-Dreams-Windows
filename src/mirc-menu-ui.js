'use strict';
(()=>{
 const call=async(name,data)=>{const r=await api.advanced(name,data);if(r?.error)throw Error(r.error);return r;};
 const fields=(id=active?.id||selectedNetworkId,target=selected()?.name||'*',nick='')=>({network:id,target,nick});
 const run=(item,f)=>call('script.mirc.menu',{...f,script:item.script,key:item.key});
 const catalog=async f=>{const r=await call('script.mirc.menus',f);return Array.isArray(r)?r:[];};
 const scriptsMenu=()=>[...document.querySelectorAll('.menubar nav>.menu')].find(m=>m.querySelector(':scope>summary')?.textContent.trim()==='Scripts');
 document.addEventListener('click',async e=>{
  const menu=scriptsMenu();if(!menu||e.target!==menu.querySelector(':scope>summary'))return;
  try{const f=fields(),rows=await catalog(f);menu.querySelectorAll('.mirc-menu-item').forEach(n=>n.remove());
   for(const item of rows.filter(r=>r.scopes.includes('menubar'))){const b=el('button','mirc-menu-item',item.label);b.title=item.scriptName;b.onclick=()=>{menu.open=false;run(item,f).catch(e=>notify(e.message,true));};menu.querySelector(':scope>.menu-popup')?.append(b);}
  }catch(e){notify(e.message,true);}
 });
 function wrap(name,scope){const original=window[name];if(typeof original!=='function')return;
  window[name]=async function(event,id,c,nick){event.preventDefault();event.stopPropagation();try{
   const f=fields(id,c.name,nick||''),rows=await catalog(f),show=contextMenu.show;
   contextMenu.show=function(ev,title,items){return show.call(this,ev,title,[...items,...rows.filter(r=>r.scopes.includes(scope|| (c.kind==='channel'?'channel':c.kind==='server'?'status':'query'))).map(r=>({label:r.label,action:()=>run(r,f)}))]);};
   try{return original(event,id,c,nick);}finally{contextMenu.show=show;}
  }catch(e){notify(e.message,true);original(event,id,c,nick);}};
 }
 wrap('conversationMenu');wrap('userMenu','nicklist');
})();
