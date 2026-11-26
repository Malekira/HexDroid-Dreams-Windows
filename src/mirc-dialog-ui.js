'use strict';
(()=>{
 const windows=new Map();
 const call=async data=>{const r=await api.advanced('script.mirc.dialog',data);if(r?.error)throw Error(r.error);};
 function remove(key){const item=windows.get(key);if(!item)return;item.remote=true;item.root.close();item.root.remove();windows.delete(key);}
 function show(script,definition){
  const key=script+'\0'+definition.name;let item=windows.get(key);
  if(!item){
   const root=el('dialog','script-view mirc-dialog'),header=el('header','dialog-header'),title=el('h2'),close=el('button','secondary','Cerrar'),content=el('div','mirc-controls');
   header.append(title,close);root.append(header,content);document.body.append(root);
   item={root,title,content,controls:new Map(),script,definition};windows.set(key,item);
   close.onclick=()=>root.close();
   root.addEventListener('close',()=>{if(!item.remote)call({script,name:item.definition.name,network:item.definition.network,interaction:'close',control:'0',values:{}}).catch(e=>notify(e.message,true));windows.delete(key);root.remove();});
  }
  item.definition=definition;item.title.textContent=definition.title;
  item.root.style.width=Math.min(innerWidth-24,definition.width+32)+'px';item.root.style.height=Math.min(innerHeight-24,definition.height+110)+'px';
  item.content.style.width=definition.width+'px';item.content.style.height=definition.height+'px';
  const old=new Map(item.controls);item.controls.clear();
  for(const c of definition.controls){
   let node=old.get(c.id);old.delete(c.id);
   if(!node){
    if(c.type==='list')node=el('select');
    else if(c.type==='edit')node=el('input');
    else if(c.type==='button')node=el('button','secondary');
    else if(['radio','check'].includes(c.type)){node=el('label','mirc-choice');const input=el('input');input.type=c.type==='radio'?'radio':'checkbox';input.name=key+'-radios';node.append(input,el('span','',c.text));}
    else node=el(c.type==='box'?'fieldset':'span');
    node.dataset.mircId=c.id;item.content.append(node);
    if(c.type==='button')node.onclick=()=>send(item,'sclick',c.id);
    if(c.type==='list'){node.size=8;node.ondblclick=()=>send(item,'dclick',c.id);node.onchange=()=>send(item,'edit',c.id);}
   }
   item.controls.set(c.id,node);
   Object.assign(node.style,{left:c.x+'px',top:c.y+'px',width:c.width+'px',height:c.height+'px'});
   const input=node.querySelector('input')||node;input.disabled=c.disabled;
   if(['radio','check'].includes(c.type))input.checked=c.checked;
   else if(c.type==='list'){
    const selected=node.value;node.replaceChildren();for(const [i,label]of c.items.entries()){const o=el('option','',label);o.value=String(i+1);node.append(o);}node.value=c.selected?String(c.selected):selected;
   }else if(c.type==='edit'){if(document.activeElement!==node||node.dataset.dirty!=='true')node.value=c.text;node.oninput=()=>{node.dataset.dirty='true';};}
   else node.textContent=c.text;
   input.setAttribute('aria-label',c.label||c.text||'Control '+c.id);
  }
  for(const node of old.values())node.remove();
  if(!item.root.open)item.root.show();if(definition.focus)item.root.focus();
 }
 async function send(item,interaction,control){

  const values={};for(const c of item.definition.controls){const node=item.controls.get(c.id),input=node.querySelector('input')||node;
   if(c.type==='edit')values[c.id]=input.value;
   if(['radio','check'].includes(c.type))values[c.id]=input.checked;
   if(c.type==='list')values[c.id]=Number(input.value)||0;
  }
  for(const node of item.controls.values())node.dataset.dirty='false';
  const request={script:item.script,name:item.definition.name,network:item.definition.network,interaction,control,values};
  item.queue=(item.queue||Promise.resolve()).then(()=>call(request)).catch(e=>notify(e.message,true));
  await item.queue;
 }
 api.onEvent(e=>{
  if(e.type==='mirc-dialogs'){
   if(e.removeScript){for(const key of [...windows.keys()])if(key.startsWith(e.removeScript+'\0'))remove(key);return;}
   if(e.reset){for(const key of [...windows.keys()])remove(key);return;}
   for(const name of e.closed||[])remove(e.script+'\0'+name);
   for(const d of e.dialogs||[])show(e.script,d);
  }
  if(e.type==='mirc-tip')notify(e.title+': '+e.text);
 });
})();
