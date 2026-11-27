'use strict';
const extended=require('./extended');
const {parse} = require('./importer');
const {arithmetic} = require('../interpreter');
const fold = s => String(s).toLowerCase().replace(/[\[\]\\^]/g,c=>({'[':'{',']':'}','\\':'|','^':'~'})[c]);
class Halt extends Error {}
const COMMANDS = new Set(['var','set','unset','inc','dec','return','halt','echo','msg','notice','mode','kick','haltdef','hadd','hinc','hdel','writeini','remini','dialog','did','noop','query','close','scid','scon','goto']);
const BUILTINS = new Set(['me','chan','nick','network','null','true','false','calc','len','lower','upper','replace','gettok','numtok','address','v1','v2','chr','qt','scriptdir','cid','time','readini','ini','hget','hfind','dialog','did','dname','query','tip','regex']);
function splitTop(text, delimiter) {
 const out=[];let depth=0,start=0;
 for(let i=0;i<text.length;i++){
  if(text[i]==='(')depth++;else if(text[i]===')')depth--;
  if(depth<0)throw Error('Paréntesis no equilibrados.');
  if(!depth&&text.startsWith(delimiter,i)){out.push(text.slice(start,i));start=i+delimiter.length;i+=delimiter.length-1;}
 }
 if(depth)throw Error('Paréntesis no equilibrados.');out.push(text.slice(start));return out;
}
function instructions(source) {
 const tokens=[];let text='',parens=0;
 const flush=()=>{if(text.trim())tokens.push(text.trim());text='';};
 for(let i=0;i<source.length;i++){
  const c=source[i];
  if(c==='(')parens++;else if(c===')')parens=Math.max(0,parens-1);
  if(c==='\n'||c==='|'&&!parens&&(!i||/[\s{}]/.test(source[i-1]))&&(i+1===source.length||/[\s{}]/.test(source[i+1]))){if(c==='|'&&(source[i-1]==='|'||source[i+1]==='|')){text+=c;continue;}flush();continue;}
  if((c==='{'||c==='}')&&(!i||/\s/.test(source[i-1]))&&(i===source.length-1||/\s|[|}]/.test(source[i+1]))){flush();tokens.push(c);}else text+=c;
 }
 flush();let at=0,count=0;
 function block(depth=0){
  if(depth>40)throw Error('Demasiados bloques anidados.');const result=[];
  while(at<tokens.length&&tokens[at]!=='}'){
   if(++count>10000)throw Error('Demasiadas instrucciones.');
   const header=tokens[at++];
   if(header==='{')throw Error('Bloque sin instrucción.');
   if(/^:[a-z\d_.-]+$/i.test(header)){result.push({type:'label',name:header.slice(1).toLowerCase()});continue;}
   const control=/^(if|elseif|while)\s*\(/.exec(header);
   const otherwise=/^else(?:\s|$)/.test(header);
   if(control||otherwise){
    let expression='',rest='';
    if(control){let end=header.indexOf('(')+1,n=1,start=end;
     for(;end<header.length&&n;end++){if(header[end]==='(')n++;else if(header[end]===')')n--;}
     if(n)throw Error('Condición sin cerrar.');expression=header.slice(start,end-1);rest=header.slice(end).trim();
     while(/^(?:&&|\|\|)\s*\(/.test(rest)){const op=/^(&&|\|\|)\s*\(/.exec(rest),begin=op[0].length;let at=begin,level=1;for(;at<rest.length&&level;at++){if(rest[at]==='(')level++;if(rest[at]===')')level--;}if(level)throw Error('Condición sin cerrar.');expression='('+expression+') '+op[1]+' '+rest.slice(begin-1,at);rest=rest.slice(at).trim();}

    }else rest=header.slice(4).trim();
    let body;
    if(rest)body=instructions(rest);
    else {if(tokens[at++]!=='{')throw Error('Control sin instrucción ni bloque.');body=block(depth+1);if(tokens[at++]!=='}')throw Error('Bloque sin cerrar.');}
    const node={type:control?.[1]||'else',expression,body};
    if(['else','elseif'].includes(node.type)&&!['if','elseif'].includes(result.at(-1)?.type))throw Error('else/elseif sin if.');
    result.push(node);
   }else{
    const assignment=/^(%[\w.-]+)\s*=\s*([\s\S]*)$/.exec(header);if(assignment){result.push({type:'command',command:'set',args:assignment[1]+' '+assignment[2]});continue;}
    if(/^(?:%|\$)/.test(header)){result.push({type:'dynamic',source:header});continue;}
    if(tokens[at]==='{')throw Error('Control no soportado: '+header);
    const m=/^\/*([.]*)([a-z][\w.-]*)(?:\s+([\s\S]*))?$/i.exec(header);
    if(!m)throw Error('Instrucción no soportada: '+header);
    result.push({type:'command',command:m[2].toLowerCase(),args:m[3]||'',silent:!!m[1]});
   }
  }return result;
 }
 const result=block();if(at!==tokens.length)throw Error('Llave de cierre inesperada.');return result;
}
function compile(source){
 const parsed=parse(source);if(parsed.diagnostics.length)throw Error(parsed.diagnostics.map(d=>'Línea '+d.line+': '+d.message).join('\n'));
 const aliases=new Map();aliases.handlers=[];aliases.dialogs=new Map();aliases.groups=new Map();aliases.menus=[];aliases.init=[];let group='';
 for(const d of parsed.declarations){
  if(d.type==='label')continue;
  if(d.type==='init'){aliases.init.push(...instructions(d.body));continue;}
  if(d.type==='group'){if(d.state==='end')group='';else{group='#'+d.name.toLowerCase();aliases.groups.set(group,d.state==='on');}continue;}
  if(d.type==='menu'){aliases.menus.push(...require('./menus').parseMenu(d).map((m,i)=>({...m,key:String(aliases.menus.length+i)})));continue;}
  if(d.type==='raw'){
   const raw=/^(\*|\d{3}):([^:]*):?$/.exec(d.name);if(!raw)throw Error('RAW no soportado: '+d.name);
   aliases.handlers.push({event:'RAW',pattern:raw[1],textPattern:raw[2],group,body:instructions(d.body.slice(d.body.indexOf('{')+1,d.body.lastIndexOf('}')))});continue;
  }
  if(d.type==='on'){
   const event=/^(\^?)(?:\*|1):(JOIN|LOAD|START|CONNECT|DISCONNECT|INPUT|NICK|PART|NOTICE|OPEN|TEXT|ACTION|DIALOG):(.*)$/i.exec(d.name);
   if(!event)throw Error('Evento mSL todavía no soportado: '+d.name);
   const type=event[2].toUpperCase(),parts=event[3].split(':');let pattern='',dialog='',interaction='',control='';
   if(['JOIN','PART'].includes(type)){pattern=parts[0];if(!['#','*'].includes(pattern)&&!/^[#&+!][^\s*?:]+$/.test(pattern))throw Error('Sala de evento no soportada.');}
   if(['OPEN','TEXT','ACTION'].includes(type)){
    if(type==='OPEN'){if(parts[0]!=='?'||!['*',''].includes(parts[1]||''))throw Error('OPEN no soportado.');pattern='?';}else{pattern=parts[1];if(!['?','#','*'].includes(pattern))throw Error('Destino de evento no soportado.');}
   }
   if(type==='INPUT'){pattern=parts[0];if(!['*','#','?'].includes(pattern))throw Error('INPUT no soportado.');}
   if(type==='NOTICE'){pattern=parts[1]||'*';}
   if(type==='DIALOG'){[dialog,interaction,control]=parts;if(!['init','sclick','dclick','close','edit'].includes(interaction)||! /^(?:\*|\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*)$/.test(control))throw Error('Evento de diálogo no soportado.');}
   const start=d.body.indexOf('{'),end=d.body.lastIndexOf('}');
   aliases.handlers.push({event:type,pattern,textPattern:['TEXT','ACTION','NOTICE'].includes(type)?parts[0]:'*',group,dialog,interaction,control,pre:!!event[1],body:instructions(d.body.slice(start+1,end))});continue;
  }
  if(d.type==='dialog'){
   aliases.dialogs.set(d.name.toLowerCase(),require('./state').parseDialog(d));continue;
  }
  if(d.type!=='alias')throw Error('Declaración mSL todavía no soportada: '+d.type+' (línea '+d.line+').');
  if(!/^[a-z][\w.-]*$/i.test(d.name))throw Error('Nombre de alias no válido.');
  const name=d.name.toLowerCase();if(aliases.has(name)||COMMANDS.has(name)||BUILTINS.has(name))throw Error('Alias duplicado o reservado: '+name);
  const start=d.body.indexOf('{'),end=d.body.lastIndexOf('}');
  if(start<0||end<=start)throw Error('Alias sin bloque completo.');
  aliases.set(name,{name,local:/^\s*alias\s+-l\s/i.test(d.body),body:instructions(d.body.slice(start+1,end))});
 }
 if(!aliases.size&&!aliases.handlers.length&&!aliases.menus.length)throw Error('El archivo no contiene alias ni eventos ejecutables.');
 function check(nodes){for(const n of nodes){
  if(n.type==='label')continue;if(n.type==='dynamic')continue;
  if(n.type==='command'&&n.command==='run'&&/\.(?:exe|bat|cmd|com|ps1)\b/i.test(n.args))throw Error('Programa externo no soportado: '+n.args);
  if(n.type==='command'&&!COMMANDS.has(n.command)&&!extended.COMMANDS.has(n.command)&&!/^timer/i.test(n.command)&&!aliases.has(n.command))throw Error('Comando mSL todavía no soportado: '+n.command);
  const expr=n.type==='command'?n.args:n.expression||'';
  if(n.type!=='command'){
   const op=/\s(!?is[a-z]+|===|!==|=~)\s/i.exec(expr);
   if(op&&!['isin','!isin','isnum','!isnum','iswm','!iswm','isop','!isop','isvoice','!isvoice','ison','!ison'].includes(op[1].toLowerCase()))throw Error('Comparación todavía no soportada: '+op[1]);
  }
  if(/\x00/.test(expr))throw Error('Evaluación dinámica todavía no soportada.');
  for(const m of expr.matchAll(/\$([a-z][\w.-]*)/gi))if(!BUILTINS.has(m[1].toLowerCase())&&!extended.FUNCTIONS.has(m[1].toLowerCase())&&!aliases.has(m[1].toLowerCase()))throw Error('Identificador mSL todavía no soportado: $'+m[1]);
  if(n.type==='command'&&['var','set','inc','dec','unset'].includes(n.command)){
   if(!/^(?:-[a-z]\d*\s+)?(?:%[\w.-]+|\$\+\([^\n]+\))(?:\s+(?:=\s*)?[\s\S]*)?$/i.test(n.args))throw Error('Asignación todavía no soportada: '+n.args);

  }
  if(n.body)check(n.body);
 }}
 for(const a of [...aliases.values(),...aliases.handlers,{body:aliases.init},...aliases.menus.map(m=>({body:instructions(m.code)}))])check(a.body);
 return aliases;
}
class MslVM {
 constructor(source,ini={},files={}){this.aliases=compile(source);this.globals=new Map();this.groups=new Map(this.aliases.groups);this.compat=new (require('./state').CompatState)(this,ini,files);}
 execute(fields,run){
  this.steps=0;this.actions=[];this.fields=fields;this.halted=false;this.timers=[];this.modules=[];this.ignores=[];this.compat.begin();
  const old=new Map(this.globals),groups=new Map(this.groups);
  try{const value=run();return this.result(value);}
  catch(e){if(e instanceof Halt){this.halted=true;return this.result('');}this.globals=old;this.groups=groups;this.compat.rollback();throw e;}
 }
 result(value=''){return {handled:true,actions:this.actions,value,halted:this.halted,timers:this.timers,ignores:this.ignores,modules:this.modules,...this.compat.finish()};}
 invoke(name,fields={},args=[]){
  name=name.toLowerCase();if(!this.aliases.has(name)||this.aliases.get(name).local)return {handled:false,actions:[]};
  return this.execute(fields,()=>this.call(name,args,0));
 }
 dispatch(name,fields={},args=[]){
  const handlers=this.aliases.handlers.filter(h=>h.event===name&&(!h.group||this.groups.get(h.group))&&
   (name==='RAW'?(h.pattern==='*'||h.pattern===String(fields.code))&&extended.glob(h.textPattern||'*',args.join(' ')):
    ['TEXT','ACTION','NOTICE','INPUT'].includes(name)?(h.pattern==='*'||h.pattern==='?'&&!fields.channel||h.pattern==='#'&&fields.channel)&&extended.glob(h.textPattern||'*',fields.text||args.join(' ')):
    ['JOIN','PART'].includes(name)?(['#','*'].includes(h.pattern)?/^[#&+!]/.test(fields.chan||''):fold(h.pattern)===fold(fields.chan||'')):
    name==='DIALOG'?h.dialog.toLowerCase()===String(fields.dname||'').toLowerCase()&&h.interaction===fields.interaction&&require('./dialogs').matches(h.control,fields.control):true));
  if(!handlers.length)return {handled:false,actions:[]};
  return this.execute(fields,()=>{for(const handler of handlers)this.run(handler.body,{args,locals:new Map(),depth:0});return '';});
 }
 dialogEvent(fields,name,interaction,control,values){
  return this.execute(fields,()=>{this.compat.interact(name,interaction,control,values);return '';});
 }
 line(fields,source){return this.execute(fields,()=>{this.run(instructions(source),{args:[],locals:new Map(),depth:0});return '';});}
 initialize(fields){return this.execute(fields,()=>{this.run(this.aliases.init,{args:[],locals:new Map(),depth:0});return '';});}
 menu(fields,key){const m=this.aliases.menus.find(m=>m.key===String(key));if(!m)throw Error('Opción de menú no disponible.');return this.line(fields,m.code);}
 menuLabels(fields){
  const globals=new Map(this.globals),groups=new Map(this.groups);
  try{let rows;this.execute(fields,()=>{rows=this.aliases.menus.map(m=>({...m,label:m.path.map(p=>this.value(p,{args:[],locals:new Map(),depth:0})).join(' › ').replace(/&/g,'')}));});return rows.map(({code,...m})=>m);}
  finally{this.globals=globals;this.groups=groups;this.compat.rollback();}
 }
 step(){if(++this.steps>10000)throw Error('Se excedió el presupuesto de instrucciones mSL.');}
 bounded(value){value=String(value??'');if(value.length>16384)throw Error('Texto mSL demasiado largo.');return value;}
 value(text,ctx,depth=0){
  this.step();if(depth>40)throw Error('Expansión mSL demasiado profunda.');
  let out='';
  for(let i=0;i<text.length;){
   const rest=text.slice(i);let m;
   if(rest.startsWith('$(')){
    let end=i+2,n=1;for(;end<text.length&&n;end++){if(text[end]==='(')n++;else if(text[end]===')')n--;}if(n)throw Error('Expansión sin cerrar.');
    const parts=splitTop(text.slice(i+2,end-1),','),passes=Number(parts[1]||1);if(![1,2].includes(passes))throw Error('Solo se admiten uno o dos pasos de expansión.');let value=this.value(parts[0],ctx,depth+1);if(passes===2)value=this.value(value,ctx,depth+1);out+=value;i=end;
   }else if(text[i]==='['&&/\s/.test(text[i+1]||'')){const end=text.indexOf(']',i+1);if(end<0)throw Error('Expansión [ ] sin cerrar.');out+=this.value(text.slice(i+1,end).trim(),ctx,depth+1);i=end+1;}
   else if(rest.startsWith('$$')){const required=this.value(rest.slice(1),ctx,depth+1);if(!required)throw new Halt();out+=required;i=text.length;}
   else if(rest.startsWith('$+')&&!rest.startsWith('$+(')){out=out.trimEnd();i+=2;while(/\s/.test(text[i]||'')&&i<text.length)i++;}
   else if((m=/^%[\w.-]+/.exec(rest))){out+=ctx.locals.has(m[0].toLowerCase())?ctx.locals.get(m[0].toLowerCase()):this.globals.get(m[0].toLowerCase())||'';i+=m[0].length;}
   else if((m=/^\$(\d+)(?:-(\d*))?/.exec(rest))){const n=Number(m[1]);out+=n===0?ctx.args.length:m[2]!==undefined?ctx.args.slice(n-1,m[2]?Number(m[2]):undefined).join(' '):ctx.args[n-1]||'';i+=m[0].length;}
   else if((m=/^\$([a-z][\w.-]*|\+(?=\())/i.exec(rest))){
    const key=m[1].toLowerCase();i+=m[0].length;let params=null;
    if(text[i]==='('){let end=i+1,n=1;for(;end<text.length&&n;end++){if(text[end]==='(')n++;else if(text[end]===')')n--;}
     if(n)throw Error('Identificador sin cerrar.');
     params=splitTop(text.slice(i+1,end-1),',').map(p=>this.value(p.trim(),ctx,depth+1));i=end;
    }
    let property='';const prop=/^\.([a-z][\w]*)/i.exec(text.slice(i));if(prop){property=prop[1].toLowerCase();i+=prop[0].length;if(!['pnick','item','text','seltext','lines','state','sel','checked','enabled','visible'].includes(property))throw Error('Propiedad todavía no soportada: '+property);}
    out+=this.identifier(key,params,property,ctx,depth+1);
   }else {out+=text[i++];}
   if(out.length>16384)throw Error('Texto mSL demasiado largo.');
  }
  return this.bounded(out);
 }
 identifier(key,args,property,ctx,depth){
  const f=this.fields;
  if(this.aliases.has(key)){if(property)throw Error('Propiedad de alias no soportada.');return this.call(key,args||[],ctx.depth+1)||'';}
  const added=extended.identifier(this,key,args,property,ctx);if(added!==undefined)return added;
  const extra=this.compat.identifier(key,args,property,ctx);if(extra!==undefined)return extra;
  if(!BUILTINS.has(key))throw Error('Identificador no soportado: $'+key);
  if(key==='chan'&&args){
   if(args.length!==1||!/^\d+$/.test(args[0]))throw Error('$chan admite un índice numérico en esta etapa.');
   return Number(args[0])===0?String((f.rooms||[]).length):(f.rooms||[])[Number(args[0])-1]?.name||'';
  }
  if(key==='nick'&&args){
   if(args.length!==2)throw Error('$nick admite dos argumentos en esta etapa.');
   const room=(f.rooms||[]).find(r=>fold(r.name)===fold(args[0])),users=room?.users||[];
   const prefixes=f.prefixes||'~&@%+';const bare=s=>s.replace(new RegExp('^['+prefixes.replace(/[\\\]\-^]/g,'\\$&')+']+'),'').split('!')[0];
   let user;if(/^\d+$/.test(args[1]||'')){if(args[1]==='0')return String(users.length);user=users[Number(args[1])-1];}else user=users.find(u=>fold(bare(u))===fold(args[1]||''));
   return user?(property==='pnick'?user:bare(user)):'';
  }
  if(property)throw Error('Propiedad no soportada: '+property);
  const arity={calc:1,len:1,lower:1,upper:1,gettok:3,numtok:2};if(args&&arity[key]&&args.length!==arity[key])throw Error('Cantidad de argumentos no soportada para $'+key);
  if(key==='address'){
   if(!args||args.length!==2||!['0','2','5'].includes(args[1]))throw Error('$address admite los tipos 0, 2 y 5 en esta etapa.');
   const u=(f.addresses||[]).find(u=>fold(u.nick)===fold(args[0]));if(!u?.ident||!u?.host)return '';
   return args[1]==='0'?'*!'+u.ident+'@'+u.host:args[1]==='2'?'*!*@'+u.host:args[0]+'!'+u.ident+'@'+u.host;
  }
  if(!args){if(key==='null')return '';if(key==='true'||key==='false')return key;if(key==='v1'||key==='v2')return ctx[key]||'';if(key==='network')return f.networkName||f.network||'';if(['me','chan','nick'].includes(key))return f[key]||'';throw Error('$'+key+' requiere argumentos.');}
  switch(key){
   case 'calc':return String(arithmetic(args.join(',')));
   case 'len':return String((args[0]||'').length);
   case 'lower':return (args[0]||'').toLowerCase();
   case 'upper':return (args[0]||'').toUpperCase();
   case 'replace':{if(args.length<3||args.length%2!==1)throw Error('$replace requiere pares de búsqueda y reemplazo.');let value=args[0];for(let i=1;i<args.length;i+=2){if(!args[i])throw Error('Búsqueda vacía.');const pieces=value.split(args[i]);if(value.length+(pieces.length-1)*(args[i+1].length-args[i].length)>16384)throw Error('Texto mSL demasiado largo.');value=this.bounded(pieces.join(args[i+1]));}return value;}
   case 'gettok':case 'numtok':{const code=Number(args[key==='gettok'?2:1]);if(!Number.isInteger(code)||code<1||code>255)throw Error('Separador de tokens no válido.');const items=(args[0]||'').split(String.fromCharCode(code)).filter(Boolean);if(key==='numtok')return String(items.length);const range=/^(\d+)-(\d*)$/.exec(args[1]);if(range)return items.slice(Number(range[1])-1,range[2]?Number(range[2]):undefined).join(String.fromCharCode(code));if(!/^-?\d+$/.test(args[1]))throw Error('Índice de $gettok no válido.');const n=Number(args[1]);return n===0?String(items.length):items[n<0?items.length+n:n-1]||'';}
   default:throw Error('Forma de identificador no soportada: $'+key);
  }
 }
 condition(expression,ctx){
  this.step();expression=expression.trim();
  if(expression.startsWith('(')&&expression.endsWith(')')){try{splitTop(expression.slice(1,-1),'||');expression=expression.slice(1,-1);}catch{}}
  const or=splitTop(expression,'||');if(or.length>1)return or.some(s=>this.condition(s,ctx));
  const and=splitTop(expression,'&&');if(and.length>1)return and.every(s=>this.condition(s,ctx));
  const m=/^(.+?)\s+(==|!=|>=|<=|>|<|!?isin|!?isnum|!?iswm|!?isop|!?isvoice|!?ison)\s+([\s\S]*)$/.exec(expression);
  if(m){const a=this.value(m[1],ctx),b=this.value(m[3],ctx);ctx.v1=a;ctx.v2=b;
   switch(m[2]){case '==':return a.toLowerCase()===b.toLowerCase();case '!=':return a.toLowerCase()!==b.toLowerCase();case '>':return Number(a)>Number(b);case '<':return Number(a)<Number(b);case '>=':return Number(a)>=Number(b);case '<=':return Number(a)<=Number(b);case 'isin':return b.toLowerCase().includes(a.toLowerCase());case '!isin':return !b.toLowerCase().includes(a.toLowerCase());default:{if(m[2].includes('isnum')){const range=/^(-?\d+)(?:-(-?\d*))?$/.exec(b);const n=Number(a),ok=a!==''&&Number.isFinite(n)&&(!range||(n>=Number(range[1])&&(!range[2]||n<=Number(range[2]))));return m[2].startsWith('!')?!ok:ok;}if(m[2].includes('iswm')){const ok=extended.glob(a,b);return m[2].startsWith('!')?!ok:ok;}if(/!?is(?:op|voice|on)$/.test(m[2])){const p=this.identifier('nick',[b,a],'pnick',ctx,0),ok=m[2].includes('isop')?/^[~&@]/.test(p):m[2].includes('isvoice')?/^[~&@%+]/.test(p):!!p;return m[2].startsWith('!')?!ok:ok;}throw Error('Comparación todavía no soportada: '+m[2]);}}
  }
  if(expression.startsWith('!'))return !this.condition(expression.slice(1),ctx);
  return !['','0','false'].includes(this.value(expression,ctx).toLowerCase());
 }
 call(name,args,depth){
  this.step();if(depth>30)throw Error('Demasiadas llamadas mSL anidadas.');
  const alias=this.aliases.get(name);if(!alias)throw Error('Alias no disponible: '+name);
  const ctx={args:args.map(String),locals:new Map(),depth};
  const result=this.run(alias.body,ctx);if(result?.goto)throw Error('Etiqueta no encontrada: '+result.goto);return result?.value||'';
 }
 run(nodes,ctx){
  let branch=false;
  for(let pc=0;pc<nodes.length;pc++){const n=nodes[pc];this.step();let result;
   if(n.type==='label')continue;
   if(n.type==='dynamic'){this.expansion=(this.expansion||0)+1;if(this.expansion>30)throw Error('Demasiada ejecución indirecta.');try{result=this.run(instructions(this.value(n.source,ctx)),ctx);}finally{this.expansion--;}if(result)return result;continue;}
   if(n.type==='if'||n.type==='elseif'||n.type==='else'){
    if(n.type==='if')branch=false;
    if(!branch&&(n.type==='else'||this.condition(n.expression,ctx))){branch=true;result=this.run(n.body,ctx);}
   }else if(n.type==='while'){while(this.condition(n.expression,ctx)){this.step();result=this.run(n.body,ctx);if(result)break;}}
   else{
    const command=n.command;
    if(command==='goto')result={goto:this.value(n.args,ctx).toLowerCase()};
    else if(['var','set','inc','dec','unset'].includes(command)){
     if(command==='var'&&splitTop(n.args,',').length>1){for(const part of splitTop(n.args,','))this.run([{type:'command',command:'var',args:part.trim()}],ctx);continue;}

     const flags=/^(-[a-z]\d*)\s+/i.exec(n.args),raw=flags?n.args.slice(flags[0].length):n.args;
     const variable=/^(\S+)(?:\s+([\s\S]*))?$/.exec(raw),target=variable?this.value(variable[1],{...ctx,locals:new Map()},0):'';
     const literal=/^%[\w.-]+$/.test(variable?.[1]||'')?variable[1]:target;
     const m=literal&&/^%[\w.!@*{}?\[\]-]+$/.test(literal)?[null,literal,variable?.[2]?.replace(/^=\s*/, '')]:null;if(!m)throw Error('Asignación no soportada: '+n.args);
     const key=m[1].toLowerCase();let store=command==='var'?ctx.locals:flags?.[1]==='-g'?this.globals:ctx.locals.has(key)?ctx.locals:this.globals;
     if(command==='unset'){for(const k of [...store.keys()])if(extended.glob(key,k))store.delete(k);continue;}
     let value=this.value(m[2]||'',ctx);
     if(command==='var'&&/^[\d\s.()+*/%+-]+$/.test(value)&&/[+*/%-]/.test(value))value=String(arithmetic(value));
     if(['inc','dec'].includes(command)){const before=Number(store.get(key)||0),delta=value===''?1:Number(value);value=String(before+(command==='inc'?delta:-delta));if(!Number.isFinite(Number(value)))throw Error('Incremento no numérico.');}
     if(store.size>=1000&&!store.has(key))throw Error('Demasiadas variables mSL.');store.set(key,this.bounded(value));if(flags&&/^-u\d+$/.test(flags[1]))this.timers.push({name:'unset:'+key,repeats:1,delay:Math.max(25,Number(flags[1].slice(2))*1000),code:'unset '+key,fields:{network:this.fields.network,buffer:this.fields.buffer}});
    }else if(command==='return')return {value:this.value(n.args,ctx)};
    else if(command==='halt')throw new Halt();
    else if(command==='haltdef'){this.halted=true;}
    else if(this.aliases.has(command)){this.call(command,this.value(n.args,ctx).split(/\s+/).filter(Boolean),ctx.depth+1);}
    else if(extended.command(this,command,n.args,ctx)){}
    else if(this.compat.command(command,n.args,ctx)){}
    else{
     if(this.actions.length>=200)throw Error('Demasiadas acciones mSL en una invocación.');
     this.actions.push({type:command,text:this.value(n.args,ctx),silent:n.silent,...(this.fields.network?{network:this.fields.network,buffer:this.fields.buffer}:{} )});
    }
   }
   if(result?.goto){const target=nodes.findIndex(n=>n.type==='label'&&n.name===result.goto);if(target<0)return result;pc=target;}else if(result)return result;
  }
 }
}
module.exports={compile,MslVM,instructions};
