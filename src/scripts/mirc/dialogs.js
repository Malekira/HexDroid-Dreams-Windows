'use strict';
const key=x=>String(x||'').toLowerCase();
const list=c=>['list','combo'].includes(c.type);
const options=c=>c.options.split(/[\s,]+/).filter(Boolean);
const matches=(pattern,id)=>String(pattern).split(',').some(p=>{if(p==='*')return true;const m=/^(\d+)-(\d+)$/.exec(p);return m?Number(id)>=Number(m[1])&&Number(id)<=Number(m[2]):p===String(id);});
function parseDialog(d){
 const result={name:d.name.toLowerCase(),title:d.name,width:600,height:420,controls:[]};
 for(const line of d.body.slice(d.body.indexOf('{')+1,d.body.lastIndexOf('}')).split(/\r?\n/).map(s=>s.trim()).filter(s=>s&&!s.startsWith(';'))){
  let m;if((m=/^title\s+(.+)$/.exec(line))){result.title=m[1].replace(/^"|"$/g,'');result.titleExpression=!m[1].startsWith('"');}
  else if((m=/^size\s+-?\d+\s+-?\d+\s+(\d+)\s+(\d+)$/.exec(line))){result.width=Number(m[1]);result.height=Number(m[2]);}
  else if(/^option (pixels|dbu)$/i.test(line))result.dbu=/dbu$/i.test(line);
  else if((m=/^(text|edit|button|radio|check|box|list|combo|tab|link)\s+(?:("[^"]*"|[^,]+),\s*)?(\d+),\s*(-?\d+)\s+(-?\d+)\s+(\d+)\s+(\d+)(?:,\s*(.*))?$/.exec(line))){
   if(result.controls.some(c=>c.id===m[3]))throw Error('ID de diálogo duplicado.');
   const raw=m[2]||'',c={type:m[1],text:raw.replace(/^"|"$/g,''),id:m[3],x:Number(m[4]),y:Number(m[5]),width:Number(m[6]),height:Number(m[7]),options:m[8]||'',items:[],selected:0,checked:false,disabled:false,hidden:false};
   if(raw&&!raw.startsWith('"'))c.textExpression=c.text;
   const flags=options(c);c.disabled=flags.includes('disable');c.hidden=flags.includes('hide');c.readOnly=flags.includes('read');c.tab=/\btab\s+(\d+)/.exec(c.options)?.[1]||'';result.controls.push(c);
  }else throw Error('Elemento de diálogo no soportado: '+line);
 }
 if(result.dbu){result.width*=2;result.height*=2;for(const c of result.controls)for(const p of ['x','y','width','height'])c[p]*=2;}
 if(result.controls.length>100||result.width>3200||result.height>2400||result.width<1||result.height<1)throw Error('Diálogo demasiado grande o tamaño inválido.');
 result.activeTab=result.controls.find(c=>c.type==='tab')?.id||'';
 for(const c of result.controls){
  if(!Number.isInteger(Number(c.id))||Number(c.id)<1||Number(c.id)>65535||c.width>6400||c.height>4800||Math.abs(c.x)>6400||Math.abs(c.y)>4800)throw Error('Geometría o ID de control inválido.');
  if(c.tab&&!result.controls.some(t=>t.type==='tab'&&t.id===c.tab))throw Error('Pestaña de diálogo inexistente.');
  c.label=c.text||result.controls.filter(l=>l.type==='text'&&Math.abs(l.x-c.x)<40&&l.y+l.height<=c.y).sort((a,b)=>b.y-a.y)[0]?.text||('Control '+c.id);
 }
 return result;
}
function visible(d,c){return !c.hidden&&(!c.tab||c.tab===d.activeTab);}
function identifier(state,a,p,f){
 if(!a)return String(f.control||'');if(a.length===1)a=[f.dname,a[0]];
 const c=state.control(a[0],a[1]);if(!c)return '';
 const row=a[2]===undefined?c.selected||1:Number(a[2]);
 if(p==='lines')return String(list(c)?c.items.length:c.text.split('\n').length);
 if(p==='sel')return String(c.selected||0);if(p==='seltext')return c.items[c.selected-1]||'';
 if(p==='state')return c.checked?'1':'0';if(p==='enabled')return c.disabled?'false':'true';if(p==='visible')return visible(state.dialogs.get(key(a[0])),c)?'true':'false';
 if(p&&!['text','checked'].includes(p))throw Error('Propiedad did no soportada: '+p);
 if(p==='checked')return c.checked?'true':'false';
 return c.type==='combo'&&a[2]===undefined?c.text:list(c)?c.items[row-1]||'':a[2]===undefined?c.text:c.text.split('\n')[row-1]||'';
}
function close(state,id,ctx,notify=true){
 const d=state.dialogs.get(id);if(!d||d.closing)return;d.closing=true;
 if(notify)state.runDialog(id,'close','0',ctx);state.dialogs.delete(id);if(!state.closed.includes(id))state.closed.push(id);
}
function dialogCommand(state,a,ctx){
 const vm=state.vm,flags=a.shift(),id=key(a.shift());
 if(flags==='-x'){close(state,id,ctx,false);return;}
 if(flags==='-v'){const d=state.dialogs.get(id);if(d){state.ui.add(id);d.focus=true;}return;}
 if(!['-m','-md'].includes(flags)||!vm.aliases.dialogs.has(key(a[0])))throw Error('Apertura de diálogo no soportada.');
 if(state.dialogs.has(id)){state.dialogs.get(id).focus=true;state.ui.add(id);return;}
 if(state.dialogs.size>=10)throw Error('Demasiados diálogos.');
 const d=structuredClone(vm.aliases.dialogs.get(key(a[0])));d.name=id;d.network=vm.fields.network;
 if(d.titleExpression)d.title=vm.value(d.title,ctx);
 for(const c of d.controls){if(c.textExpression)c.text=vm.value(c.textExpression,ctx);c.label=c.text||c.label;}
 state.dialogs.set(id,d);state.ui.add(id);state.runDialog(id,'init','0',ctx);
}
function didCommand(state,text){
 const header=require('./state').take(text,3),[flags,name,ids]=header.values,id=key(name),d=state.dialogs.get(id);
 if(!d||!/^-[racebfuvhido]+$/.test(flags||''))throw Error('Opción did o diálogo no soportado.');
 const selected=d.controls.filter(c=>matches(ids,c.id));if(!selected.length||ids.split(',').some(p=>p!=='*'&&!/^\d+(?:-\d+)?$/.test(p)))throw Error('Control did no disponible.');
 for(const c of selected){
  let value=header.rest;
  if(flags.includes('r')){c.text='';c.items=[];c.selected=0;}
  if(flags.includes('d')||flags.includes('i')||flags.includes('o')){
   if(!list(c))throw Error('La edición de líneas did requiere lista o combo.');
   const part=require('./state').take(value,1),n=Number(part.values[0]);if(!Number.isInteger(n)||n<1||n>c.items.length+(flags.includes('i')?1:0))throw Error('Línea did inválida.');
   if(flags.includes('d'))c.items.splice(n-1,1);else if(flags.includes('i'))c.items.splice(n-1,0,state.vm.bounded(part.rest));else c.items[n-1]=state.vm.bounded(part.rest);
   c.selected=Math.min(c.selected,c.items.length);c.text=c.items[c.selected-1]||'';
  }
  if(flags.includes('a')){if(list(c)){if(c.items.length>=1000)throw Error('Lista de diálogo demasiado grande.');c.items.push(state.vm.bounded(value));if(options(c).includes('sort'))c.items.sort((a,b)=>a.localeCompare(b));}else c.text=state.vm.bounded(c.text+value);}
  if(flags.includes('c')){
   if(list(c)){const n=Number(value)||0;if(n<0||!Number.isInteger(n)||n>c.items.length)throw Error('Selección did inválida.');c.selected=n;c.text=c.items[n-1]||'';}
   else if(c.type==='tab')d.activeTab=c.id;
   else{if(c.type==='radio')for(const r of d.controls)if(r.type==='radio'&&radioGroup(d,r)===radioGroup(d,c))r.checked=false;c.checked=true;}
  }
  if(flags.includes('u')){c.checked=false;c.selected=0;if(list(c))c.text='';}
  if(flags.includes('b'))c.disabled=true;if(flags.includes('e'))c.disabled=false;
  if(flags.includes('h'))c.hidden=true;if(flags.includes('v'))c.hidden=false;
  if(flags.includes('f'))d.focus=c.id;
 }state.ui.add(id);
}
function radioGroup(d,c){let group='';for(const r of d.controls){if(r.type==='radio'&&options(r).includes('group'))group=r.id;if(r.id===c.id)return group;}return group;}
function interact(state,name,interaction,control,values){
 name=key(name);const d=state.dialogs.get(name);if(!d)throw Error('La ventana del addon ya no está abierta.');
 if(interaction==='close'){close(state,name);return;}
 const active=state.control(name,control);
 if(!active||active.disabled||!visible(d,active)||!['sclick','dclick','edit'].includes(interaction))throw Error('Interacción de diálogo no válida.');
 if(interaction==='edit'&&!['edit','combo'].includes(active.type)||interaction==='dclick'&&!list(active)||interaction==='sclick'&&!['button','radio','check','list','combo','tab','link'].includes(active.type))throw Error('Interacción de control no válida.');
 for(const [id,value]of Object.entries(values||{})){
  const c=state.control(name,id);if(!c)throw Error('Control de formulario desconocido.');if(c.disabled||c.readOnly||!visible(d,c))continue;
  if(c.type==='edit'){if(typeof value!=='string'||/[\0\r]/.test(value)||value.includes('\n')&&!options(c).includes('multi'))throw Error('Texto de diálogo no válido.');c.text=state.vm.bounded(value);}
  else if(c.type==='combo'&&typeof value==='object'&&value){if(typeof value.text!=='string'||/[\0\r\n]/.test(value.text))throw Error('Texto de combo no válido.');const n=value.selected;if(!Number.isInteger(n)||n<0||n>c.items.length)throw Error('Selección de combo inválida.');c.selected=n;c.text=state.vm.bounded(value.text);}
  else if(c.type==='list'||c.type==='combo'){const n=Number(value);if(!Number.isInteger(n)||n<0||n>c.items.length)throw Error('Selección de lista inválida.');c.selected=n;c.text=c.items[n-1]||'';}
  else if(['radio','check'].includes(c.type)){if(typeof value!=='boolean')throw Error('Estado de control inválido.');c.checked=value;}
 }
 if(active.type==='tab'){d.activeTab=active.id;state.ui.add(name);}
 if(active.type==='radio')for(const c of d.controls)if(c.type==='radio'&&c.id!==active.id&&radioGroup(d,c)===radioGroup(d,active))c.checked=false;
 state.runDialog(name,interaction,control);
 if(options(active).some(o=>['cancel','ok'].includes(o)))close(state,name);
}
module.exports={parseDialog,identifier,dialogCommand,didCommand,interact,matches};
