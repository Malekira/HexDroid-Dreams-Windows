'use strict';
const {take}=require('./state');
function splitWords(text){const out=[];let depth=0,quoted=false,start=0;for(let i=0;i<=text.length;i++){const c=text[i];if(c==='"')quoted=!quoted;if(!quoted){if(c==='(')depth++;if(c===')')depth--;}if(i===text.length||(!depth&&!quoted&&/\s/.test(c))){if(i>start)out.push(text.slice(start,i));start=i+1;}}return out;}
function glob(pattern,text){let p=0,t=0,star=-1,back=0;pattern=pattern.toLowerCase();text=text.toLowerCase();while(t<text.length){if(pattern[p]==='?'||pattern[p]===text[t]){p++;t++;}else if(pattern[p]==='*'){star=p++;back=t;}else if(star>=0){p=star+1;t=++back;}else return false;}while(pattern[p]==='*')p++;return p===pattern.length;}
const FUNCTIONS=new Set(['newnick','numeric','server','site','active','date','ticks','duration','strip','left','right','mid','trim','rand','iif','istok','addtok','remtok','findtok','reptok','sorttok','remove','count','replacecs','snicks','snick','group','notify','isfile','exists','lines','read','readn','getdir','asctime','ctime']);
const COMMANDS=new Set(['window','who','whois','join','part','nick','me','say','ban','unban','op','deop','voice','devoice','enable','disable','hmake','hfree','hsave','hload','write','load','reload','unload','fullname','ignore','closemsg']);
function identifier(vm,name,a,property,ctx){
 if(!FUNCTIONS.has(name))return undefined;const f=vm.fields,first=a?.[0]||'';
 switch(name){
 case 'newnick':return f.newnick||'';case 'numeric':return f.code||'';case 'server':return f.server||'';case 'site':return f.host||((f.addresses||[]).find(r=>r.nick.toLowerCase()===String(f.nick).toLowerCase())?.host)||'';case 'active':return f.buffer||'*';
 case 'ticks':return String(f.now||Date.now());case 'date':return new Date(f.now||Date.now()).toLocaleDateString();
 case 'duration':{let s=Math.max(0,Math.floor(Number(first)||0));return [[86400,'day'],[3600,'hr'],[60,'min'],[1,'sec']].flatMap(([n,label])=>{const v=Math.floor(s/n);s%=n;return v?[v+label+(v===1?'':'s')]:[];}).join(' ')||'0secs';}
 case 'strip':return require('../../formatting').plain(first);case 'trim':return first.trim();
 case 'left':return first.slice(0,Math.max(0,Number(a[1])));case 'right':return first.slice(-Math.max(0,Number(a[1])));case 'mid':return first.slice(Math.max(0,Number(a[1])-1),a[2]?Math.max(0,Number(a[1])-1)+Number(a[2]):undefined);
 case 'rand':{const lo=Math.ceil(Number(first)),hi=Math.floor(Number(a[1]));if(!Number.isFinite(lo)||!Number.isFinite(hi)||hi<lo||hi-lo>1e9)throw Error('Rango rand no válido.');return String(lo+Math.floor(Math.random()*(hi-lo+1)));}
 case 'iif':return vm.condition(first,ctx)?a[1]||'':a[2]||'';
 case 'remove':{let s=first;for(const item of a.slice(1))if(item)s=s.split(item).join('');return s;}
 case 'count':{if(!a[1])return '0';return String(first.split(a[1]).length-1);}
 case 'replacecs':{let s=first;for(let i=1;i<a.length;i+=2){if(!a[i])throw Error('Búsqueda vacía.');s=vm.bounded(s.split(a[i]).join(a[i+1]||''));}return s;}
 case 'snicks':return (f.selectedNicks||[f.nick].filter(Boolean)).join(',');case 'snick':return (f.selectedNicks||[f.nick].filter(Boolean))[Number(a?.[1]||1)-1]||'';
 case 'group':return vm.groups.get(first.toLowerCase())?'on':'off';
 case 'notify':{const names=f.notify||[];return /^\d+$/.test(first)?first==='0'?String(names.length):names[Number(first)-1]||'':names.some(n=>n.toLowerCase()===first.toLowerCase())?first:'';}
 case 'isfile':case 'exists':return vm.compat.files.has(vm.compat.filePath(first))?'$true'.slice(1):'false';
 case 'lines':return String((vm.compat.files.get(vm.compat.filePath(first))||[]).length);
 case 'read':{
  const path=vm.compat.filePath(first),rows=vm.compat.files.get(path)||[];let option=a[1]||'',index=a[2]||option;
  if(!rows.length)return '';if(/^n$/.test(option))index=a[2];if(index&&!/^\d+$/.test(index))throw Error('Variante read todavía no soportada.');
  vm.compat.readn=Number(index)||1;return rows[vm.compat.readn-1]||'';
 }
 case 'readn':return String(vm.compat.readn||0);
 case 'getdir':return 'addon:/';
 case 'asctime':{const d=new Date(Number(first)*1000);if(Number.isNaN(d.valueOf()))return '';return d.toLocaleString();}
 case 'ctime':return String(Math.floor((f.now||Date.now())/1000));
 default:{
  if(!['istok','addtok','remtok','findtok','reptok','sorttok'].includes(name))throw Error('Identificador no soportado: '+name);
  const code=Number(a[name==='sorttok'?1:name==='remtok'?3:name==='reptok'?3:name==='findtok'?3:2]),sep=String.fromCharCode(code);if(!Number.isInteger(code)||code<1||code>255)throw Error('Separador no válido.');
  let list=first.split(sep).filter(Boolean);const target=a[1]||'',match=x=>x.toLowerCase()===target.toLowerCase(),index=list.findIndex(match);
  if(name==='istok')return index>=0?'true':'false';if(name==='findtok')return index<0?'0':String(index+1);
  if(name==='addtok'&&!list.some(match))list.push(target);
  if(name==='remtok')list=list.filter((x,i)=>!match(x)||Number(a[2])>0&&i!==index);
  if(name==='reptok'){if(index>=0)list[index]=a[2];}if(name==='sorttok')list.sort((x,y)=>x.localeCompare(y));return list.join(sep);
 }
 }
}
function command(vm,name,source,ctx){
 if(/^timer/i.test(name)){
  const parts=splitWords(vm.value(source,ctx));let timerName=name.slice(5),milliseconds=false;
  if(parts[0]==='-m'){milliseconds=true;parts.shift();}
  if(parts[0]==='off'){vm.timers.push({name:timerName,off:true});return true;}
  const repeats=Number(parts.shift()),delay=Number(parts.shift())*(milliseconds?1:1000),code=parts.join(' ');
  if(!Number.isInteger(repeats)||repeats<0||repeats>10000||!Number.isFinite(delay)||delay<0||delay>86400000||!code)throw Error('Temporizador mIRC no válido.');
  if(vm.timers.length>=100)throw Error('Demasiados temporizadores.');
  vm.timers.push({name:timerName,repeats,delay:Math.max(25,delay),code,fields:{network:vm.fields.network,buffer:vm.fields.buffer,chan:vm.fields.chan,nick:vm.fields.nick}});return true;
 }
 if(!COMMANDS.has(name))return false;
 const text=vm.value(source,ctx),parts=splitWords(text),f=vm.fields;
 if(name==='enable'||name==='disable'){for(const g of parts){if(!vm.groups.has(g.toLowerCase()))throw Error('Grupo desconocido: '+g);vm.groups.set(g.toLowerCase(),name==='enable');}return true;}
 if(['hmake','hfree'].includes(name)){if(name==='hmake')vm.compat.table(parts[0],true);else vm.compat.hash.delete(parts[0].toLowerCase());return true;}
 if(name==='write'){
  let flags='';if(parts[0]?.startsWith('-'))flags=parts.shift();const path=vm.compat.filePath(parts.shift()),data=parts.join(' '),lines=vm.compat.files.get(path)||[];
  if(flags==='-c')vm.compat.files.set(path,data?[data]:[]);else if(!flags){if(lines.length>=10000)throw Error('Archivo del addon demasiado grande.');lines.push(data);vm.compat.files.set(path,lines);}else throw Error('Opción write no soportada.');vm.compat.filesDirty=true;return true;
 }
 if(name==='hsave'||name==='hload'){
  if(parts[0]==='-o')parts.shift();const table=parts.shift(),path=vm.compat.filePath(parts.shift());
  if(name==='hsave'){const rows=[...(vm.compat.table(table)||[])].flatMap(([k,v])=>[k,v]);vm.compat.files.set(path,rows);vm.compat.filesDirty=true;}
  else{const t=vm.compat.table(table,true),rows=vm.compat.files.get(path)||[];for(let i=0;i+1<rows.length;i+=2){vm.step();t.set(rows[i],rows[i+1]);}}return true;
 }
 if(name==='window'){
  const target=parts.find(p=>p.startsWith('@'));if(!target)throw Error('Esta variante window requiere una ventana @.');
  vm.actions.push({type:'custom-window',text:target,operation:parts[0]==='-c'?'close':'open',network:f.network,buffer:f.buffer});return true;
 }
 if(name==='load'||name==='reload'||name==='unload'){
  if(parts[0]?.startsWith('-'))parts.shift();vm.modules.push({verb:name,path:parts.join(' ').replace(/^"|"$/g,'')});return true;
 }
 if(name==='ignore'){
  let flags=parts[0]?.startsWith('-')?parts.shift().slice(1):'',seconds=0;
  const timed=/u(\d*)/.exec(flags);if(timed){seconds=timed[1]?Number(timed[1]):Number(parts.shift());flags=flags.replace(/u\d*/,'');}
  if(/[^prnac]/.test(flags)||!Number.isFinite(seconds)||seconds<0||seconds>86400)throw Error('Opción ignore no soportada.');
  let mask=parts.shift();const type=parts.shift();if(!mask||parts.length||type&&!['0','2','5'].includes(type))throw Error('Uso ignore no soportado.');
  if(type){const u=(f.addresses||[]).find(u=>u.nick.toLowerCase()===mask.toLowerCase());if(!u?.host)throw Error('El host para ignore no está disponible.');mask=type==='2'?'*!*@'+u.host:type==='0'?'*!'+u.ident+'@'+u.host:mask+'!'+u.ident+'@'+u.host;}
  vm.ignores.push({mask,remove:flags.includes('r'),scopes:[...flags].filter(c=>'pnac'.includes(c)).join('')||'pnac',seconds,network:f.network});return true;
 }
 if(name==='fullname'){vm.actions.push({type:'fullname',text,network:f.network});return true;}
 if(name==='closemsg'){vm.actions.push({type:'close',text,network:f.network});return true;}
 vm.actions.push({type:name,text,network:f.network,buffer:f.buffer});return true;
}
module.exports={FUNCTIONS,COMMANDS,identifier,command,splitWords,glob};
