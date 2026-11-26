'use strict';
const iconv = require('iconv-lite');
const { TextDecoder } = require('node:util');
const LIMIT = 262144;
function decode(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length > LIMIT) throw Error('El addon supera 256 KB o no es un archivo válido.');
  if (buffer.includes(0)) throw Error('El addon debe ser un archivo de texto.');
  try { return {source: new TextDecoder('utf-8', {fatal:true}).decode(buffer), encoding:'UTF-8'}; }
  catch { return {source:iconv.decode(buffer, 'windows-1252'), encoding:'Windows-1252'}; }
}
// This frontend preserves native bodies. It does not pass them to HexVM or execute LOAD.
function parse(source) {
  if (typeof source !== 'string' || Buffer.byteLength(source) > LIMIT) throw Error('Fuente de addon no válida.');
  const declarations = [], diagnostics = [];
  let current = null, depth = 0, blockComment = false;
  for (const [index, original] of source.replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
    const line = index + 1, text = original.trim();
    if (blockComment) { if (text === '*/') blockComment = false; continue; }
    if (text === '/*') { blockComment = true; continue; }
    if (!text || text.startsWith(';')) continue;
    if (!current) {
      const group = /^#([\w.-]+)\s+(on|off|end)$/i.exec(text);
      if (group) { declarations.push({type:'group',name:group[1],state:group[2].toLowerCase(),line,body:''}); continue; }
      const m = /^(alias(?:\s+-l)?\s+([^\s{]+)|on\s+([^{}]+)|raw\s+([^{}]+)|dialog\s+([^\s{]+)|menu\s+([^{}]+))\s*\{/i.exec(text);
      if (!m) { diagnostics.push({line,message:'Declaración no reconocida o sin bloque explícito.',code:'unsupported-declaration'}); continue; }
      const type = text.split(/\s/)[0].toLowerCase();
      current = {type,name:(m[2]||m[3]||m[4]||m[5]||m[6]).trim(),line,body:''};
    }
    current.body += original + '\n';
    // mSL quotes are literal text, not JS strings. Only standalone braces delimit blocks;
    // braces inside nick masks, text and identifiers must not alter the nesting depth.
    for (const token of text.split(/\s+/)) {
      if (token === '{') depth++;
      else if (token === '}') depth--;
    }
    // Common native spelling: :{ and a final } without leading whitespace.
    if (/[^\s{]\{$/.test(text)) depth++;
    if (depth <= 0) { declarations.push(current); current = null; depth = 0; }
  }
  if (current) diagnostics.push({line:current.line,message:'Bloque sin cerrar.',code:'unclosed-block'});
  if (blockComment) diagnostics.push({line:1,message:'Comentario de bloque sin cerrar.',code:'unclosed-comment'});
  return {declarations,diagnostics};
}
function inspect(buffer, name = 'addon.mrc') {
  const {source,encoding} = decode(buffer), parsed = parse(source);
  const dependencies = new Set();
  for (const line of source.split(/\r?\n/)) {
    if (/^\s*;/.test(line)) continue;
    const m = /^\s*\/*(?:[.]?load|reload)\s+(?:-\S+\s+)?(.+?\.(?:mrc|xcr))\s*$/i.exec(line);
    if (m) dependencies.add(m[1].replace(/^"|"$/g,''));
  }
  let compatibility;
  try{require('./language').compile(source);compatibility={supported:true,message:'Puede importarse como archivo de alias del subconjunto mSL actual.'};}
  catch(e){compatibility={supported:false,message:e.message};}
  return {name,encoding,stage:'inspection',executable:false,compatibility,
    declarations:parsed.declarations.map(({body,...entry})=>entry),
    diagnostics:parsed.diagnostics,dependencies:[...dependencies],
    message:'Análisis sin ejecución. Este addon no se ha instalado ni activado.'};
}
module.exports = {decode,parse,inspect};
