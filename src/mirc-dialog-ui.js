'use strict';
(()=>{
 const windows=new Map();let foreground=2147483100;
 const call=async data=>{const r=await api.advanced('script.mirc.dialog',data);if(r?.error)throw Error(r.error);};
 const opts=c=>c.options.split(/[\s,]+/).filter(Boolean);
 function raise(root){
  if(foreground>=2147483600){foreground=2147483100;for(const item of [...document.querySelectorAll('dialog.mirc-dialog,dialog.tictactoe-dialog')].sort((a,b)=>Number(a.style.zIndex)-Number(b.style.zIndex)))item.style.zIndex=String(++foreground);}
  root.style.zIndex=String(++foreground);
 }
 window.raiseDreamsAddonWindow=raise;
 function remove(key){const item=windows.get(key);if(!item)return;clearTimeout(item.editTimer);item.remote=true;item.root.close();item.root.remove();windows.delete(key);}
 function focus(item,id){const node=item.controls.get(String(id)),input=node?.querySelector('input,select,textarea,button')||node;if(input&&!input.disabled&&!node.hidden)input.focus();}
 function position(item,left,top){
  const rect=item.root.getBoundingClientRect();
  left=Math.max(0,Math.min(left,Math.max(0,innerWidth-rect.width)));top=Math.max(0,Math.min(top,Math.max(0,innerHeight-rect.height)));
  item.position={left,top};Object.assign(item.root.style,{inset:'auto',margin:'0',transform:'none',left:left+'px',top:top+'px'});
 }
 window.addEventListener('resize',()=>{for(const item of windows.values())if(item.position)position(item,item.position.left,item.position.top);});
 function show(script,definition){
  const key=script+'\0'+definition.name;let item=windows.get(key);const opening=!item;
  if(!item){
   const root=el('dialog','script-view mirc-dialog'),header=el('header','dialog-header'),title=el('h2'),close=el('button','secondary','×'),content=el('div','mirc-controls');
   root.tabIndex=-1;close.setAttribute('aria-label','Cerrar ventana');header.append(title,close);root.append(header,content);document.body.append(root);
   item={root,title,content,controls:new Map(),script,definition};windows.set(key,item);
   let drag=null;
   header.style.cursor='move';header.style.touchAction='none';
   header.addEventListener('pointerdown',e=>{
    if(e.button!==0||e.target.closest('button'))return;
    const rect=root.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:rect.left,top:rect.top};header.setPointerCapture(e.pointerId);raise(root);e.preventDefault();
   });
   header.addEventListener('pointermove',e=>{if(drag&&e.pointerId===drag.id)position(item,drag.left+e.clientX-drag.x,drag.top+e.clientY-drag.y);});
   for(const event of ['pointerup','pointercancel','lostpointercapture'])header.addEventListener(event,()=>{drag=null;});
   root.addEventListener('pointerdown',()=>{raise(root);});close.onclick=()=>root.close();
   root.addEventListener('close',()=>{if(!item.remote&&item.editTimer)send(item,'edit',item.lastEditId);clearTimeout(item.editTimer);if(!item.remote)send(item,'close','0').catch(e=>notify(e.message,true));windows.delete(key);root.remove();});
   root.addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();const cancel=item.definition.controls.find(c=>opts(c).includes('cancel')&&!c.disabled&&!c.hidden);if(cancel)send(item,'sclick',cancel.id);else root.close();}
    if(e.key==='Enter'&&!e.isComposing&&e.target.tagName!=='BUTTON'&&e.target.tagName!=='TEXTAREA'){
     const button=item.definition.controls.find(c=>c.type==='button'&&!c.disabled&&!c.hidden&&opts(c).some(o=>['default','ok'].includes(o)));if(button){e.preventDefault();send(item,'sclick',button.id);}
    }
   });
  }
  item.definition=definition;item.title.textContent=definition.title;
  item.root.style.width=Math.min(innerWidth-24,definition.width+32)+'px';item.root.style.height=Math.min(innerHeight-24,definition.height+110)+'px';
  item.content.style.width=definition.width+'px';item.content.style.height=definition.height+'px';
  const old=new Map(item.controls);item.controls.clear();
  for(const c of definition.controls){
   let node=old.get(c.id);old.delete(c.id);const flags=opts(c);
   if(!node){
    if(c.type==='list')node=el('select');
    else if(c.type==='combo'){
     node=el('div','mirc-combo');const input=el('input'),choices=el('select');node.append(input,choices);
     input.oninput=()=>edit(item,node,c.id);choices.onchange=()=>{input.value=choices.selectedOptions[0]?.textContent||'';node.dataset.dirty='true';send(item,'sclick',c.id);};choices.ondblclick=()=>send(item,'dclick',c.id);
     input.onchange=()=>send(item,'edit',c.id);
    }
    else if(c.type==='edit')node=el(flags.includes('multi')?'textarea':'input');
    else if(['button','link','tab'].includes(c.type))node=el('button',c.type==='link'?'mirc-link':'secondary');
    else if(['radio','check'].includes(c.type)){node=el('label','mirc-choice');const input=el('input');input.type=c.type==='radio'?'radio':'checkbox';node.append(input,el('span','',c.text));input.onchange=()=>send(item,'sclick',c.id);}
    else node=el(c.type==='box'?'fieldset':'span');
    node.dataset.mircId=c.id;item.content.append(node);
    if(['button','link','tab'].includes(c.type))node.onclick=()=>send(item,'sclick',c.id);
    if(c.type==='tab')node.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const tabs=item.definition.controls.filter(t=>t.type==='tab'&&!t.hidden&&!t.disabled),at=tabs.findIndex(t=>t.id===c.id),next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(at+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;send(item,'sclick',tabs[next].id).then(()=>focus(item,tabs[next].id));};
    if(c.type==='list'){node.size=8;node.ondblclick=()=>send(item,'dclick',c.id);node.onchange=()=>send(item,'sclick',c.id);}
   }
   item.controls.set(c.id,node);
   Object.assign(node.style,{left:c.x+'px',top:c.y+'px',width:c.width+'px',height:c.height+'px',textAlign:flags.includes('center')?'center':flags.includes('right')?'right':''});
   node.hidden=c.hidden||!!(c.tab&&c.tab!==definition.activeTab);
   const input=node.querySelector('input')||node;input.disabled=c.disabled;
   if(['radio','check'].includes(c.type)){input.checked=c.checked;input.name=key+'-radios-'+radioGroup(definition,c);node.querySelector('span').textContent=c.text.replace(/&/g,'');}
   else if(['list','combo'].includes(c.type)){
    const select=c.type==='combo'?node.querySelector('select'):node,signature=JSON.stringify(c.items);
    select.disabled=c.disabled;if(select.dataset.signature!==signature){select.replaceChildren();for(const [i,label]of c.items.entries()){const o=el('option','',label);o.value=String(i+1);select.append(o);}select.dataset.signature=signature;}
    select.value=c.selected?String(c.selected):'';
    if(c.type==='combo'){if(node.dataset.dirty!=='true')input.value=c.text;input.readOnly=c.readOnly;input.setAttribute('aria-label',c.label.replace(/&/g,''));select.setAttribute('aria-label',c.label+' · opciones');select.size=Math.max(2,Math.floor((c.height-28)/20));}
   }else if(c.type==='edit'){
    if(node.dataset.dirty!=='true')node.value=c.text;node.readOnly=c.readOnly;
    if(node.tagName==='INPUT')node.type=flags.includes('pass')?'password':'text';node.oninput=()=>edit(item,node,c.id);
   }else node.textContent=c.text.replace(/&/g,'');
   if(c.type==='tab'){node.setAttribute('role','tab');node.setAttribute('aria-selected',String(definition.activeTab===c.id));node.tabIndex=definition.activeTab===c.id?0:-1;}
   input.setAttribute('aria-label',(c.label||c.text||'Control '+c.id).replace(/&/g,''));if(flags.includes('notab'))input.tabIndex=-1;
  }
  for(const node of old.values())node.remove();
  if(!item.root.open)item.root.show();if(item.position)position(item,item.position.left,item.position.top);
  if(opening||definition.focus){raise(item.root);if(typeof definition.focus==='string')focus(item,definition.focus);else if(opening){const c=definition.controls.find(c=>['edit','combo','list','button','check'].includes(c.type)&&!c.disabled&&!c.hidden);if(c)focus(item,c.id);else item.root.focus();}}
 }
 function radioGroup(d,c){let group='';for(const r of d.controls){if(r.type==='radio'&&opts(r).includes('group'))group=r.id;if(r.id===c.id)return group;}return group;}
 function edit(item,node,id){node.dataset.dirty='true';item.lastEditId=id;clearTimeout(item.editTimer);item.editTimer=setTimeout(()=>send(item,'edit',id),120);}
 async function send(item,interaction,control){
  if(interaction!=='edit'&&item.editTimer){const editId=item.lastEditId;clearTimeout(item.editTimer);item.editTimer=null;await send(item,'edit',editId);if(item.remote)return;}
  clearTimeout(item.editTimer);item.editTimer=null;
  const values={};for(const c of item.definition.controls){const node=item.controls.get(c.id),input=node.querySelector('input')||node;
   if(c.type==='edit')values[c.id]=input.value;
   if(['radio','check'].includes(c.type))values[c.id]=input.checked;
   if(c.type==='list')values[c.id]=Number(input.value)||0;
   if(c.type==='combo'){const select=node.querySelector('select'),n=Number(select.value)||0;values[c.id]={text:input.value,selected:select.selectedOptions[0]?.textContent===input.value?n:0};}
  }
  for(const node of item.controls.values())node.dataset.dirty='false';
  const request={script:item.script,name:item.definition.name,network:item.definition.network,interaction,control,values};
  item.queue=(item.queue||Promise.resolve()).then(()=>call(request)).catch(e=>notify(e.message,true));await item.queue;
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
