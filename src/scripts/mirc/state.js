'use strict';
const clone=value=>structuredClone(value);
const key=value=>String(value||'').toLowerCase();
const words=text=>{const out=[];text.replace(/"([^"]*)"|(\S+)/g,(_,quoted,word)=>{out.push(quoted===undefined?word:quoted);return '';});return out;};
function take(text,count){
 const values=[];let rest=text;
 for(let i=0;i<count;i++){const m=/^\s*(?:"([^"]*)"|(\S+))(?:\s+|$)/.exec(rest);if(!m){values.push('');continue;}values.push(m[1]===undefined?m[2]:m[1]);rest=rest.slice(m[0].length);}
 return {values,rest};
}
function parseDialog(d){
 const lines=d.body.slice(d.body.indexOf('{')+1,d.body.lastIndexOf('}')).split(/\r?\n/),result={name:d.name.toLowerCase(),title:d.name,width:600,height:420,controls:[]};
 for(const line of lines.map(s=>s.trim()).filter(Boolean)){
  let m;if((m=/^title\s+"(.*)"$/.exec(line)))result.title=m[1];
  else if((m=/^size\s+-?\d+\s+-?\d+\s+(\d+)\s+(\d+)$/.exec(line))){result.width=Number(m[1]);result.height=Number(m[2]);}
  else if(/^option (pixels|dbu)$/i.test(line)){if(/dbu$/i.test(line))result.dbu=true;}
  else if((m=/^(text|edit|button|radio|check|box|list)\s+(?:"([^"]*)",\s*)?(\d+),\s*(-?\d+)\s+(-?\d+)\s+(\d+)\s+(\d+)(?:,\s*(.*))?$/.exec(line))){
   if(result.controls.some(c=>c.id===m[3]))throw Error('ID de diálogo duplicado.');
   result.controls.push({type:m[1],text:m[2]||'',id:m[3],x:Number(m[4]),y:Number(m[5]),width:Number(m[6]),height:Number(m[7]),options:m[8]||'',items:[],selected:0,checked:false,disabled:false});
  }else throw Error('Elemento de diálogo no soportado: '+line);
 }
 if(result.controls.length>100||result.width>1600||result.height>1200)throw Error('Diálogo demasiado grande.');
 if(result.dbu){result.width*=2;result.height*=2;for(const c of result.controls)for(const p of ['x','y','width','height'])c[p]*=2;}
 for(const c of result.controls){
  const labels=result.controls.filter(l=>l.type==='text'&&Math.abs(l.x-c.x)<40&&l.y+l.height<=c.y).sort((a,b)=>(c.y-a.y-a.height)-(c.y-b.y-b.height));
  c.label=c.text||labels[0]?.text||('Control '+c.id);
 }
 return result;
}
class CompatState{
 constructor(vm,ini={},files={}){this.vm=vm;this.files=new Map(Object.entries(files));this.ini=clone(ini);this.hash=new Map();this.dialogs=new Map();}
 begin(){this.old=clone({ini:this.ini,hash:this.hash,dialogs:this.dialogs,files:this.files});this.dirty=false;this.filesDirty=false;this.ui=new Set();this.closed=[];}
 rollback(){Object.assign(this,this.old);}
 finish(){const dialogs=[...this.ui].filter(n=>this.dialogs.has(n)).map(n=>{const d=clone(this.dialogs.get(n));delete this.dialogs.get(n).focus;return d;});return {dialogs,closed:this.closed,...(this.filesDirty?{files:Object.fromEntries(this.files)}:{}),...(this.dirty?{ini:clone(this.ini)}:{})};}
 filePath(value){
  value=String(value||'').replace(/^"|"$/g,'').replace(/\\/g,'/').replace(/^addon:\//i,'');
  if(!value||value.startsWith('/')||value.split('/').some(p=>!p||p==='.'||p==='..')||/[:\0\r\n]/.test(value)||value.length>240)throw Error('Ruta fuera del espacio privado del addon.');return value.toLowerCase();
 }
 path(value){value=String(value).replace(/^"|"$/g,'');if(!/^addon:\/[a-z\d_.-]+\.ini$/i.test(value))throw Error('El addon solo puede usar archivos INI dentro de su espacio privado.');return key(value);}
 file(value,create=false){const name=this.path(value);if(!this.ini[name]&&create)this.ini[name]={};return this.ini[name]||{};}
 table(name,create=false){name=key(name);if(!this.hash.has(name)&&create){if(this.hash.size>=50)throw Error('Demasiadas tablas hash.');this.hash.set(name,new Map());}return this.hash.get(name);}
 control(name,id){return this.dialogs.get(key(name))?.controls.find(c=>c.id===String(id));}
 identifier(name,a,p,ctx){
  const vm=this.vm,f=vm.fields;
  if(name==='+')return (a||[]).join('');
  if(name==='scriptdir')return 'addon:/';
  if(name==='cid')return String(f.cid||1);
  if(name==='dname')return f.dname||'';
  if(name==='chr'){const n=Number(a?.[0]);if(!Number.isInteger(n)||n<1||n>65535)throw Error('$chr fuera de rango.');return String.fromCharCode(n);}
  if(name==='qt')return '"'+String(a?.[0]||'').replace(/"/g,'')+'"';
  if(name==='time'){const date=new Date(f.now||Date.now()),pad=n=>String(n).padStart(2,'0');return (a?.[0]||'HH:nn:ss').replace(/HH|nn|ss/g,s=>({HH:pad(date.getHours()),nn:pad(date.getMinutes()),ss:pad(date.getSeconds())})[s]);}
  if(name==='regex'){
   if(!a||a.length!==2)throw Error('$regex requiere texto y patrón.');const m=/^\/([\s\S]*)\/([ig]*)$/.exec(a[1]);if(!m||a[1].length>512)throw Error('Patrón regex no soportado.');return new RegExp(m[1],m[2]).test(a[0])?'1':'0';
  }
  if(name==='readini'){if(!a||![3,4].includes(a.length))throw Error('$readini no válido.');const offset=a.length===4?1:0;const file=this.file(a[0]),section=key(a[1+offset]),item=key(a[2+offset]);return Object.hasOwn(file,section)&&Object.hasOwn(file[section],item)?String(file[section][item]):'';}
  if(name==='ini'){if(!a||a.length!==3)throw Error('$ini no válido.');const file=this.file(a[0]),section=Object.hasOwn(file,key(a[1]))?file[key(a[1])]:{},keys=Object.keys(section),n=Number(a[2]);return n===0?String(keys.length):keys[n-1]||'';}
  if(name==='hget'){
   if(a?.length===1)return this.table(a[0])?a[0]:'';
   const t=this.table(a?.[0]);if(!t)return '';if(p==='item')return a[1]==='0'?String(t.size):[...t.keys()][Number(a[1])-1]||'';return t.get(key(a?.[1]))||'';
  }
  if(name==='hfind'){
   if(!a||a[3]!=='w'||a.length!==4)throw Error('$hfind solo admite coincidencia w.');const t=this.table(a[0]);if(!t)return '';
   const pattern=key(a[1]).replace(/[.+^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'.*').replace(/\?/g,'.');const re=new RegExp('^'+pattern+'$');return [...t.keys()].filter(k=>{vm.step();return re.test(k);})[Number(a[2])-1]||'';
  }
  if(name==='dialog')return this.dialogs.has(key(a?.[0]))?a[0]:'';
  if(name==='did'){
   if(!a)return String(f.control||'');if(a.length===1)a=[f.dname,a[0]];
   const c=this.control(a?.[0],a?.[1]);if(!c)return '';
   if(p==='lines')return String(c.items.length);
   if(p==='seltext')return c.items[c.selected-1]||'';
   if(p==='state')return c.checked?'1':'0';
   return c.type==='list'?c.items[c.selected-1]||'':c.text;
  }
  if(name==='query')return (f.queries||[]).some(q=>key(q)===key(a?.[0]))?a[0]:'';
  if(name==='tip'){
   if(!a||a.length<3)throw Error('$tip no válido.');vm.actions.push({type:'tip',text:a[2],title:a[1],network:f.network,buffer:f.buffer});return '1';
  }
 }
 command(name,source,ctx){
  if(!['hadd','hinc','hdel','writeini','remini','dialog','did','noop','scid','scon','query','close'].includes(name))return false;
  const vm=this.vm,text=vm.value(source,ctx),a=words(text);
  if(name==='noop')return true;
  if(['hadd','hinc','hdel'].includes(name)){
   if(/^-[a-z\d]+$/i.test(a[0]||'')){if(!/^-m\d*$/i.test(a[0]))throw Error('Opción hash no soportada.');a.shift();}const header=take(text,/^-/.test(text)?3:2),table=header.values.at(-2),item=key(header.values.at(-1));if(!table||!item)throw Error('Operación hash incompleta.');const t=this.table(table,name!=='hdel');if(!t)return true;
   if(name==='hdel')t.delete(item);else{if(t.size>=10000&&!t.has(item))throw Error('Tabla hash demasiado grande.');const value=name==='hinc'?String(Number(t.get(item)||0)+Number(header.rest||1)):header.rest;t.set(item,vm.bounded(value));}return true;
  }
  if(['writeini','remini'].includes(name)){
   const header=take(text,3),[file,sectionName,itemName]=header.values,section=key(sectionName),item=key(itemName);if(!section||!item||/[=;\r\n]/.test(section+item))throw Error('Sección o clave INI no válida.');const data=this.file(file,true);
   if(name==='writeini'){if(!Object.hasOwn(data,section))Object.defineProperty(data,section,{value:{},enumerable:true,writable:true,configurable:true});Object.defineProperty(data[section],item,{value:vm.bounded(header.rest),enumerable:true,writable:true,configurable:true});}else if(data[section])delete data[section][item];
   if(Buffer.byteLength(JSON.stringify(this.ini),'utf8')>1048576)throw Error('Los INI del addon superan 1 MB.');this.dirty=true;return true;
  }
  if(name==='dialog'){
   const flags=a.shift(),id=key(a.shift());if(flags==='-x'){this.dialogs.delete(id);this.closed.push(id);return true;}
   if(flags==='-v'){if(this.dialogs.has(id)){this.ui.add(id);this.dialogs.get(id).focus=true;}return true;}
   if(flags!=='-md'||!vm.aliases.dialogs.has(key(a[0])))throw Error('Apertura de diálogo no soportada.');
   if(!this.dialogs.has(id)){if(this.dialogs.size>=10)throw Error('Demasiados diálogos.');const d=clone(vm.aliases.dialogs.get(key(a[0])));d.name=id;d.network=vm.fields.network;this.dialogs.set(id,d);this.ui.add(id);this.runDialog(id,'init','0',ctx);}return true;
  }
  if(name==='did'){
   const header=take(text,3),flags=header.values[0],id=key(header.values[1]),ids=header.values[2].split(','),value=header.rest;if(!/^-[raceb]+$/.test(flags||''))throw Error('Opción did no soportada.');
   for(const cid of ids){const c=this.control(id,cid);if(!c)throw Error('Control did no disponible.');
    if(flags.includes('r')){c.text='';c.items=[];c.selected=0;}
    if(flags.includes('a')){if(c.type==='list'){if(c.items.length>=1000)throw Error('Lista de diálogo demasiado grande.');c.items.push(value);}else c.text=vm.bounded(c.text+value);}
    if(flags.includes('c')){if(c.type==='list')c.selected=Number(value)||0;else{if(c.type==='radio')for(const r of this.dialogs.get(id).controls)if(r.type==='radio')r.checked=false;c.checked=true;}}
    if(flags.includes('b'))c.disabled=true;if(flags.includes('e'))c.disabled=false;
   }this.ui.add(id);return true;
  }
  if(name==='query'||name==='close'){
   const nick=name==='close'&&a[0]==='-m'?a[1]:a[0];vm.actions.push({type:name,text:nick||'',network:vm.fields.network,buffer:vm.fields.buffer});
   vm.fields.queries||=[];if(name==='query'&&!vm.fields.queries.includes(nick))vm.fields.queries.push(nick);if(name==='close')vm.fields.queries=vm.fields.queries.filter(q=>key(q)!==key(nick));return true;
  }
  if(name==='scid'||name==='scon'){
   const target=a.shift(),command=a.shift()?.toLowerCase();if(!vm.aliases.has(command))throw Error('Alias entre conexiones no disponible.');
   const current=vm.fields,connections=current.connections||[],chosen=name==='scon'&&target==='-a'?connections:connections.filter(c=>String(c.cid)===target);
   if(!chosen.length)throw Error('Conexión del addon no disponible.');
   try{for(const f of chosen){vm.step();vm.fields={...f,connections};vm.call(command,a,ctx.depth+1);}}finally{vm.fields=current;}return true;
  }
 }
 runDialog(name,interaction,control,ctx={depth:0}){
  const vm=this.vm,handler=vm.aliases.handlers.find(h=>h.event==='DIALOG'&&key(h.dialog)===key(name)&&h.interaction===interaction&&(h.control==='*'||h.control===String(control)));
  if(!handler)return;const previous=vm.fields;vm.fields={...previous,dname:name,interaction,control:String(control)};
  try{vm.run(handler.body,{locals:new Map(),args:[],depth:ctx.depth+1});}finally{vm.fields=previous;}
 }
 interact(name,interaction,control,values){
  name=key(name);const d=this.dialogs.get(name);if(!d)throw Error('La ventana del addon ya no está abierta.');
  if(interaction==='close'){this.runDialog(name,'close','0');this.dialogs.delete(name);this.closed.push(name);return;}
  const active=this.control(name,control);if(!active||active.disabled||!['sclick','dclick','edit'].includes(interaction))throw Error('Interacción de diálogo no válida.');
  if((interaction==='dclick'&&active.type!=='list')||(interaction==='sclick'&&!['button','radio','check','list'].includes(active.type)))throw Error('Interacción de control no válida.');
  for(const [id,value]of Object.entries(values||{})){
   const c=this.control(name,id);if(!c)throw Error('Control de formulario desconocido.');
   if(c.type==='edit'){if(typeof value!=='string'||/[\r\n\0]/.test(value))throw Error('Texto de diálogo no válido.');c.text=this.vm.bounded(value);}
   else if(c.type==='list'){const n=Number(value);if(!Number.isInteger(n)||n<0||n>c.items.length)throw Error('Selección de lista inválida.');c.selected=n;}
   else if(['radio','check'].includes(c.type)){if(typeof value!=='boolean')throw Error('Estado de control inválido.');c.checked=value;}
  }
  this.runDialog(name,interaction,control);if(active.options.includes('cancel')||active.options.includes('ok')){this.dialogs.delete(name);this.closed.push(name);}
 }
}
module.exports={CompatState,parseDialog,words,take};
