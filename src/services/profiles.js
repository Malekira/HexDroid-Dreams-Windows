'use strict';
const net=require('node:net'); const iconv=require('iconv-lite');
const token=(value,name)=>{if(typeof value!=='string'||!value||/[\s\0\r\n:,]/.test(value)||value.length>200)throw new Error(name+' no válido.');return value;};
function validateProfile(p) {
  if(!p||typeof p!=='object')throw new Error('Red no válida.');
  if(typeof p.host!=='string'||p.host.length>253||!net.isIP(p.host)&&!/^[a-z\d](?:[a-z\d._-]*[a-z\d])?$/i.test(p.host))throw new Error('Servidor o dirección IPv6 no válido.');
  token(p.nick,'Apodo'); if(!Number.isInteger(p.port)||p.port<1||p.port>65535)throw new Error('Puerto no válido.');
  if(!Array.isArray(p.channels)||p.channels.length>100)throw new Error('Lista de canales no válida.');
  for(const channel of p.channels){token(channel,'Canal');if(!/^[#&+!]/.test(channel))throw new Error('El canal debe empezar por #, &, + o !.');}
  const encoding=typeof p.encoding==='string'?p.encoding.toLowerCase():'utf8';if(!iconv.encodingExists(encoding))throw new Error('Codificación no soportada.');
  const sasl=['none','PLAIN','SCRAM-SHA-256','EXTERNAL'].includes(p.sasl)?p.sasl:'none';
  const username=typeof p.username==='string'&&p.username?p.username:p.nick; token(username,'Usuario');
  const saslUsername=typeof p.saslUsername==='string'?p.saslUsername.slice(0,200):username;
  const realName=typeof p.realName==='string'?p.realName.slice(0,200):'HexDroid Dreams';if(/[\0\r\n]/.test(realName+saslUsername))throw new Error('Identidad no válida.');
  const commands=Array.isArray(p.commands)?p.commands.filter(x=>typeof x==='string').slice(0,50):[];
  if(commands.some(x=>/[\0\r\n]/.test(x)||Buffer.byteLength(x)>500||/^(?:PASS|AUTHENTICATE|OPER)\b|\b(?:IDENTIFY|LOGIN)\b/i.test(x)))throw new Error('Guarda comandos con credenciales en el almacén seguro, no en el perfil.');
  const result={host:p.host,port:p.port,nick:p.nick,tls:p.tls!==false,channels:[...new Set(p.channels)],username,realName,sasl,saslUsername,encoding,autoConnect:p.autoConnect===true,autoReconnect:p.autoReconnect===true,reconnectDelay:Math.max(1,Math.min(300,Number(p.reconnectDelay)||5)),commandDelay:Math.max(250,Math.min(30000,Number(p.commandDelay)||1000)),commands,alternateNick:typeof p.alternateNick==='string'?p.alternateNick:p.nick.slice(0,24)+'_',recoverNick:p.recoverNick===true,favorite:p.favorite===true,tofu:p.tofu===true};
  token(result.alternateNick,'Apodo alternativo');
  if(p.proxy?.host){
    if(typeof p.proxy.host!=='string'||!net.isIP(p.proxy.host)&&!/^[a-z\d][a-z\d._-]*$/i.test(p.proxy.host)||!Number.isInteger(p.proxy.port)||p.proxy.port<1||p.proxy.port>65535)throw new Error('Proxy no válido.');
    result.proxy={host:p.proxy.host,port:p.proxy.port,type:p.proxy.type===4?4:5};
  }
  if(p.bouncerNetwork){token(p.bouncerNetwork,'Red del bouncer');result.bouncerNetwork=p.bouncerNetwork;}
  return result;
}
module.exports={validateProfile};
