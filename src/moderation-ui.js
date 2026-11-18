'use strict';
(()=>{
 const call=async(name,data)=>{if(!api.advanced)throw Error('Función no disponible.');const r=await api.advanced(name,data);if(r?.error)throw Error(r.error);return r;};
 const run=fn=>Promise.resolve().then(fn).catch(e=>{status.textContent=e.message;notify(e.message,true);});
 const dialog=el('dialog','feature-dialog');dialog.id='bans-dialog';
 const header=el('div','dialog-header'),title=el('h2','','Bans de sala'),close=el('button','secondary','Cerrar');header.append(title,close);close.onclick=()=>dialog.close();
 const body=el('div','form-content'),toolbar=el('div','bans-toolbar'),net=el('select'),room=el('select'),other=el('input'),kind=el('select'),service=el('input'),refresh=el('button','secondary','Consultar'),status=el('p','muted'),identity=el('p','muted'),filter=el('input'),rows=el('div','bans-rows');
 net.setAttribute('aria-label','Red de bans');room.setAttribute('aria-label','Sala de bans');other.setAttribute('aria-label','Otra sala');other.placeholder='#sala';other.hidden=true;
 kind.setAttribute('aria-label','Tipo de restricción');for(const [value,label]of [['b','Bans (+b)'],['e','Excepciones (+e)'],['I','Invitaciones (+I)'],['q','Silencios (+q)'],['akick','AKICK (servicios)']]){const o=el('option','',label);o.value=value;kind.append(o);}
 service.setAttribute('aria-label','Servicio de canales');service.value='ChanServ';service.hidden=true;service.placeholder='ChanServ';filter.setAttribute('aria-label','Filtrar bans');filter.placeholder='Filtrar máscara, autor o respuesta…';
 toolbar.append(net,room,other,kind,service,refresh);body.append(toolbar,identity,filter,status,rows);dialog.append(header,body);document.body.append(dialog);
 let entries=new Map(),allowed=false,timeout,finished=false;
 const channel=()=>room.value==='other'?other.value.trim():room.value;
 function draw(){rows.replaceChildren();const query=fold(filter.value);for(const item of entries.values()){
  const full=[item.mask,item.setter,item.raw].filter(Boolean).join(' ');if(query&&!fold(full).includes(query))continue;
  const row=el('article','ban-row'),mask=el('code','',item.mask||'Respuesta del servicio'),info=el('span','muted');
  let stamp='Fecha no facilitada';if(Number.isSafeInteger(item.timestamp)&&item.timestamp>0&&item.timestamp*1000<=8640000000000000)stamp=new Date(item.timestamp*1000).toLocaleString();
  info.textContent=item.mode==='akick'?item.raw:(item.setter||'Autor no facilitado')+' · '+stamp;
  row.append(mask,info);
  if(item.mode==='akick'&&item.mask){const raw=el('small','muted',item.raw);row.append(raw);}
  if(item.mask){const remove=el('button','secondary','Quitar');remove.disabled=!allowed;remove.title=allowed?'Solicitar retirada al servidor':'Requiere permisos de moderación en la sala';remove.onclick=()=>run(async()=>{await call('bans.remove',{network:net.value,channel:channel(),mode:kind.value,mask:item.entry||item.mask,service:service.value.trim()});await load();});row.append(remove);}
  rows.append(row);
 } }
 function populateRooms(preferred=''){
   room.replaceChildren();const n=network(net.value),channels=[...n.conversations.values()].filter(c=>c.kind==='channel'&&c.joined).map(c=>c.name).sort();
   for(const c of channels){const o=el('option','',c);o.value=c;room.append(o);}const o=el('option','','Otra…');o.value='other';room.append(o);
   room.value=channels.includes(preferred)?preferred:channels[0]||'other';if(preferred&&!channels.includes(preferred)){room.value='other';other.value=preferred;}other.hidden=room.value!=='other';
 }
 async function load(){
  clearTimeout(timeout);finished=false;entries.clear();allowed=false;draw();const query={network:net.value,channel:channel(),mode:kind.value,service:service.value.trim()};status.textContent='Consultando…';
  const result=await call('bans.list',query);allowed=result.canRemove===true;draw();
  if(!finished)timeout=setTimeout(()=>{status.textContent=kind.value==='akick'?'Respuesta del servicio recibida. Si no hay datos, revisá sus permisos o el nombre del servicio.':'Sin final de lista: el servidor puede no admitir esta lista o requerir permisos.';},15000);
 }
 refresh.onclick=()=>run(load);kind.onchange=()=>{service.hidden=kind.value!=='akick';run(load);};room.onchange=()=>{other.hidden=room.value!=='other';if(!other.hidden)other.focus();else run(load);};other.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();run(load);}};net.onchange=()=>{populateRooms();run(load);};filter.oninput=draw;dialog.addEventListener('close',()=>clearTimeout(timeout));
 window.openDreamsBans=(id=active?.id,selectedRoom='',nick='',details={})=>run(async()=>{
   net.replaceChildren();for(const p of config.profiles){const o=el('option','',p.name);o.value=p.id;net.append(o);}net.value=id||config.profiles[0]?.id;populateRooms(selectedRoom);filter.value='';
   identity.textContent=nick?'Usuario: '+nick+(details.ident&&details.host?'!'+details.ident+'@'+details.host:'')+' · Se muestran todas las máscaras para incluir bans de host.':'';
   if(!dialog.open)dialog.showModal();await load();
 });
 const menu=[...document.querySelectorAll('.menubar nav>.menu')].find(m=>m.querySelector('summary')?.textContent==='Salas');if(menu){const b=el('button','','Ver bans');b.onclick=()=>{menu.open=false;window.openDreamsBans(active?.id,selected()?.kind==='channel'?selected().name:'');};menu.querySelector('.menu-popup').append(b);}
 api.onEvent(event=>{
  if(!dialog.open||event.id!==net.value)return;
  if(event.type==='status'&&event.state==='disconnected'){clearTimeout(timeout);allowed=false;status.textContent='Red desconectada';draw();return;}
  if(event.type==='problem'){status.textContent=event.text||'Error del servidor';return;}
  if(event.type!=='ban-list'||fold(event.channel)!==fold(channel())||event.mode!==kind.value)return;
  allowed=event.canRemove===true;
  if(event.complete){finished=true;clearTimeout(timeout);status.textContent=entries.size?entries.size+' restricciones.':'Sin restricciones en esta lista.';}
  else{entries.set(event.mask||event.raw,event);if(event.mode==='akick')status.textContent='Respuesta de '+(event.service||service.value)+': los permisos y el formato dependen del servicio.';}
  draw();
 });
})();
