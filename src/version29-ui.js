"use strict";
(() => {
  const nav=document.querySelector('.menubar nav'),menu=el('details','menu appearance-menu'),summary=el('summary','','Apariencia'),popup=el('div','menu-popup');
  menu.append(summary,popup);nav.querySelector('.menu:last-child').before(menu);
  function action(host,label,fn){const b=el('button','',label);b.type='button';b.onclick=()=>Promise.resolve(fn()).catch(e=>notify(e.message,true));host.append(b);return b;}
  action(popup,'Temas y colores',()=>openSettings('appearance'));
  action(popup,'Fuentes y presentación',()=>openSettings('chat'));
  action(popup,'Apariencia de sala',()=>$('room-appearance-button')?.click());
  const appearanceGroup=[...document.querySelectorAll('.settings-group')].find(g=>g.querySelector('summary')?.textContent==='Apariencia')?.querySelector('.settings-children');
  if(appearanceGroup)for(const key of ['writing','nickCompletion']){const b=document.querySelector(`[data-section="${key}"]`);if(b)appearanceGroup.append(b);}
  document.addEventListener('click',e=>{const m=e.target.closest('.menubar .menu>summary')?.parentElement;if(m)for(const other of document.querySelectorAll('.menubar .menu'))if(other!==m)other.open=false;});
  const toggles=[];
  for(const [label,key,section]of [['Diccionario','dictionaryEnabled','writing'],['Nick Completion','nickCompletion','nickCompletion']]){
    const branch=el('details','appearance-branch menu-submenu'),head=el('summary','',label),body=el('div','menu-flyout');body.setAttribute('popover','manual');branch.append(head,body);popup.append(branch);
    branch.addEventListener('toggle',()=>{head.setAttribute('aria-expanded',String(branch.open));if(!branch.open){if(body.matches(':popover-open'))body.hidePopover();return;}for(const other of popup.querySelectorAll('.appearance-branch'))if(other!==branch)other.open=false;body.showPopover();const r=head.getBoundingClientRect();body.style.left=Math.max(4,Math.min(innerWidth-body.offsetWidth-4,r.right))+'px';body.style.top=Math.min(innerHeight-body.offsetHeight-4,r.top)+'px';});
    head.setAttribute('aria-haspopup','menu');head.addEventListener('keydown',e=>{if(e.key==='ArrowRight'){e.preventDefault();branch.open=true;requestAnimationFrame(()=>body.querySelector('button')?.focus());}});body.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='Escape'){e.preventDefault();branch.open=false;head.focus();}});
    const toggle=action(body,'',async()=>{if(key==='nickCompletion')config.settings.nickCompletion={...config.settings.nickCompletion,enabled:!config.settings.nickCompletion?.enabled};else config.settings.dictionaryEnabled=config.settings.dictionaryEnabled===false;await persist();applySettings();update();});
    toggle.setAttribute('role','menuitemcheckbox');
    action(body,'Configurar…',()=>{openSettings(section);document.querySelector(`[data-section="${section}"]`)?.click();menu.open=false;});
    toggles.push(()=>{const enabled=key==='nickCompletion'?config.settings.nickCompletion?.enabled===true:config.settings.dictionaryEnabled!==false;toggle.textContent=(enabled?'✓ Desactivar':'Activar');toggle.setAttribute('aria-checked',String(enabled));});
  }
  menu.addEventListener('toggle',()=>{if(menu.open){for(const m of document.querySelectorAll('.menubar .menu'))if(m!==menu)m.open=false;update();}else for(const b of popup.querySelectorAll('.appearance-branch'))b.open=false;});
  const sharedRow=el('label','setting-row','Compartir Notify entre todas las redes'),shared=el('input');shared.type='checkbox';shared.id='shared-notify';sharedRow.append(shared);document.querySelector('[data-panel=layout]').append(sharedRow);
  shared.onchange=async()=>{if(shared.checked&&!config.settings.sharedNotifyNicks?.length)config.settings.sharedNotifyNicks=[...new Map(config.profiles.flatMap(p=>p.notifyNicks||[]).map(n=>[fold(n),n])).values()];config.settings.sharedNotify=shared.checked;await persist();if(config.profiles[0]&&api.advanced)await api.advanced('presence.sync',{network:config.profiles[0].id});renderSidebar();};
  const filter=el('select');filter.id='notify-network-filter';filter.setAttribute('aria-label','Red de Notify');document.querySelector('.notify-sidebar-title').insertBefore(filter,$('notify-add-user'));
  filter.onchange=()=>{config.settings.notifyFilter=filter.value;persist().catch(e=>notify(e.message,true));window.renderDreamsNotify?.();};
  const sidebar=$('private-panel'),connections=$('sidebar-connections'),connectionTitle=document.querySelector('.connections-sidebar-title'),notifyTitle=$('notify-add-user').parentElement;
  const double=()=>el('hr','sidebar-double-divider');
  sidebar.querySelector('.sidebar-section-divider')?.remove();sidebar.prepend(connectionTitle,connections,double(),notifyTitle,$('sidebar-notify-list'),double());
  const scriptTree=el('div','script-tree');scriptTree.setAttribute('aria-label','Entradas de scripts');connections.after(scriptTree);
  let entries=[],entrySignature="";
  function drawEntries(){const signature=JSON.stringify(entries.map(e=>[e,profile(e.network)?.name]));if(signature===entrySignature)return;entrySignature=signature;scriptTree.replaceChildren();for(const entry of entries){const b=action(scriptTree,entry.label+' ('+entry.count+')',()=>api.advanced('script.tree.open',{id:entry.id}));b.dataset.network=entry.network;b.title=(profile(entry.network)?.name||entry.network)+' · '+entry.label;}}
  api.onEvent(event=>{
    if(event.type==='script-tree'){entries=event.entries||[];drawEntries();}
    if(event.type==='script-conversation'&&profile(event.id)){
      const c=network(event.id).conversations.get(fold(event.target));
      if(event.operation==='open')choose(event.id,event.target);
      else if(c?.kind==='private')closeConversation(event.id,event.target);
    }
  });
  api.advanced?.('script.tree.list').then(rows=>{if(Array.isArray(rows)){entries=rows;drawEntries();}}).catch(()=>{});
  function strip(){const bar=document.querySelector('.network-strip');if(!bar)return;const notifyButton=$('notify-button');if(notifyButton?.closest('.network-strip')){notifyTitle.querySelector('strong')?.replaceWith(notifyButton);}bar.querySelector('.theme-picker')?.remove();
    const nodes=[document.querySelector('.network-picker'),$('connection-button'),$('topic-toggle'),$('join-button'),$('server-button'),document.querySelector('.settings-top'),$('notification-bell')].filter(Boolean);nodes.forEach((node,index)=>{if(bar.children[index]!==node)bar.insertBefore(node,bar.children[index]||null);});
    const connection=$('connection-button');if(connection){connection.textContent='⏻';connection.title=(active&&network(active.id).state)==='connected'?'Desconectar':'Conectar';connection.setAttribute('aria-label',connection.title);}
    if($('server-button')){$('server-button').textContent='▣';$('server-button').setAttribute('aria-label','Status');$('server-button').title='Status';}
  }
  function update(){for(const fn of toggles)fn();shared.checked=config.settings.sharedNotify===true;const options=[['active','Red activa'],...config.profiles.map(p=>[p.id,p.name]),['all','Todas']];const signature=JSON.stringify(options);if(filter.dataset.signature!==signature){filter.replaceChildren(...options.map(([value,label])=>{const o=el('option','',label);o.value=value;return o;}));filter.dataset.signature=signature;}filter.value=config.settings.notifyFilter||'active';strip();}
  const apply=applySettings;applySettings=function(...args){const r=apply(...args);update();return r;};
  const header=renderHeader;renderHeader=function(...args){const r=header(...args);strip();return r;};
  const side=renderSidebar;renderSidebar=function(...args){const r=side(...args);update();drawEntries();return r;};
  document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.ctrlKey&&!e.shiftKey&&e.target.matches('.mdi-composer textarea')){e.preventDefault();e.stopImmediatePropagation();e.target.closest('.mdi-window').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));const input=$('message-input');input.value=e.target.value;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',ctrlKey:true,bubbles:true}));}},true);
  update();
})();
