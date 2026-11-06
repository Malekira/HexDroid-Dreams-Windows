'use strict';
function avatarUrl(template,nick){
 if(typeof template!=='string'||!template||template.length>2048||!/(?:\{nick\}|\{nickLower\}|%nick%|%s)/i.test(template))throw new Error('La URL de fotos debe incluir {nick} o {nickLower}.');
 if(typeof nick!=='string'||!nick||nick.length>200||/[\s!@\0\r\n]/.test(nick))throw new Error('Nick de foto no válido.');
 const value=template.replace(/\{nickLower\}/gi,encodeURIComponent(nick.toLowerCase())).replace(/\{nick\}|%nick%|%s/gi,encodeURIComponent(nick));const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password)throw new Error('Usa HTTPS sin credenciales para las fotos.');return url.toString();
}
module.exports={avatarUrl};
