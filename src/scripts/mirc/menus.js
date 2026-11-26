'use strict';
function parseMenu(declaration){
 const scopes=declaration.name.toLowerCase().split(',').map(s=>s.trim());
 if(scopes.some(s=>!['menubar','channel','status','query','nicklist'].includes(s)))throw Error('Ubicación de menú mIRC no soportada.');
 const body=declaration.body.slice(declaration.body.indexOf('{')+1,declaration.body.lastIndexOf('}')),items=[],parents=[];
 let block=null,depth=0;
 for(const raw of body.split(/\r?\n/)){
  const text=raw.trim();if(!text||text.startsWith(';'))continue;
  if(block){
   block.code+='\n'+raw;for(const t of text.split(/\s+/)){if(t==='{')depth++;if(t==='}')depth--;}
   if(!depth){block.code=block.code.slice(0,block.code.lastIndexOf('}'));items.push(block);block=null;}continue;
  }
  const level=/^\.+/.exec(text)?.[0].length||0,line=text.slice(level).trim();if(line==='-')continue;
  // A separator colon in a label is only the first colon outside an identifier call.
  let at=-1,n=0;for(let i=0;i<line.length;i++){if(line[i]==='(')n++;if(line[i]===')')n--;if(!n&&line[i]===':'){at=i;break;}}
  const label=(at<0?line:line.slice(0,at)).trim();parents.length=level;
  if(at<0){parents[level]=label;continue;}
  const item={key:String(items.length),scopes,label,path:[...parents.filter(Boolean),label],code:line.slice(at+1).trim()};
  if(item.code==='{'){block={...item,code:''};depth=1;}else items.push(item);
 }
 if(block)throw Error('Acción de menú sin cerrar.');if(items.length>200)throw Error('Demasiadas opciones de menú.');
 return items;
}
module.exports={parseMenu};
