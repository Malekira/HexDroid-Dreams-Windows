'use strict';
const {parse}=require('./interpreter');
const locations=['Archivo','Ver','Comandos','Salas','Scripts','Ayuda','Apariencia','Ventanas'];
function menuCatalog(source){
 const aliases=new Set(parse(source).map(n=>/^alias\s+(?:-l\s+)?([a-z][a-z0-9_.-]*)$/i.exec(n.header)?.[1].toLowerCase()).filter(Boolean));
 const out=[];
 for(const line of source.split(/\r?\n/)){
  const m=/^\s*;\s*@menu\s+([^|]+)\|([^|]+)\|\s*\/?([a-z][a-z0-9_.-]*)(?:\s+(.*?))?\s*$/i.exec(line);
  if(!m){if(/^\s*;\s*@menu\b/i.test(line))throw Error('Formato @menu no válido: Menú | Etiqueta | alias argumentos');continue;}
  const location=locations.find(l=>l.toLowerCase()===m[1].trim().toLowerCase()),label=m[2].trim(),alias=m[3].toLowerCase();
  if(!location||!label||label.length>80||!aliases.has(alias)||out.length>=50)throw Error('Opción @menu no válida: usá un menú existente, una etiqueta corta y un alias del mismo script.');
  out.push({key:String(out.length),location,label,alias,args:(m[4]||'').split(/\s+/).filter(Boolean)});
 }
 return out;
}
module.exports={menuCatalog};
