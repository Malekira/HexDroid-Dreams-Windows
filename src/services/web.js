'use strict';
const https=require('node:https'),dns=require('node:dns').promises,net=require('node:net');
function privateAddress(ip){
  if(net.isIP(ip)===4){const [a,b]=ip.split('.').map(Number);return a===0||a===10||a===127||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a>=224||a===100&&b>=64&&b<=127;}
  let v=ip.toLowerCase();try{v=new URL('http://['+v+']/').hostname.slice(1,-1);}catch{}if(v.startsWith('::ffff:')){const tail=v.slice(7);if(tail.includes('.'))return privateAddress(tail);const words=tail.split(':');if(words.length===2){const n=parseInt(words[0],16)*65536+parseInt(words[1],16);return privateAddress([n>>>24,(n>>>16)&255,(n>>>8)&255,n&255].join('.'));}return true;}return v==='::'||v==='::1'||v.startsWith('fc')||v.startsWith('fd')||/^fe[89ab]/.test(v)||v.startsWith('ff');
}
class WebClient {
  constructor({canConnect=()=>true,allowLocal=false,ca}={}){this.canConnect=canConnect;this.allowLocal=allowLocal;this.ca=ca;}
  async request(url,{domains=[],method='GET',headers={},body,maxBytes=1048576,contentLength,signal,redirects=3}={}){
    if(!this.canConnect())throw new Error('El acceso web está desactivado mientras usas proxy para evitar fugas de IP.');
    const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||u.hash)throw new Error('Solo se permiten URL HTTPS sin credenciales ni fragmentos.');
    const host=u.hostname.replace(/^\[|\]$/g,'');if(!domains.some(d=>typeof d==='string'&&d.toLowerCase()===host.toLowerCase()))throw new Error('Este dominio no está autorizado.');
    const records=net.isIP(host)?[{address:host,family:net.isIP(host)}]:await dns.lookup(host,{all:true});
    if(!records.length||!this.allowLocal&&records.some(r=>privateAddress(r.address)))throw new Error('Dirección privada o local bloqueada para solicitudes web.');
    for(const[name,value]of Object.entries(headers))if(!/^[a-z\d-]+$/i.test(name)||/[\0\r\n]/.test(String(value))||/^(?:host|connection|transfer-encoding|content-length|cookie)$/i.test(name))throw new Error('Cabecera HTTP no permitida.');
    const address=records.find(r=>r.family===4)||records[0];
    return new Promise((resolve,reject)=>{
      let settled=false;const fail=e=>{if(!settled){settled=true;reject(e);}};
      const request=https.request(u,{method,headers:{'accept-encoding':'identity',...headers,...(contentLength!==undefined?{'content-length':String(contentLength)}:{})},agent:false,rejectUnauthorized:true,...(this.ca?{ca:this.ca}:{}),lookup:(_host,options,callback)=>{if(options.all)callback(null,[address]);else callback(null,address.address,address.family);},signal},response=>{
        const location=response.headers.location,status=response.statusCode;
        if([301,302,303,307,308].includes(status)&&location&&redirects>0){
          response.resume();const target=new URL(location,u);const nextHeaders={...headers};if(target.origin!==u.origin)for(const key of Object.keys(nextHeaders))if(/^(?:authorization|proxy-authorization)$/i.test(key))delete nextHeaders[key];
          if(body&&typeof body.pipe==='function'){fail(new Error('No se reenvían archivos automáticamente a redirecciones.'));return;}
          this.request(target.toString(),{domains,method:status===303?'GET':method,headers:nextHeaders,body:status===303?undefined:body,maxBytes,contentLength:status===303?undefined:contentLength,signal,redirects:redirects-1}).then(value=>{settled=true;resolve(value);},fail);return;
        }
        const length=Number(response.headers['content-length']);if(length>maxBytes){response.destroy();fail(new Error('La respuesta supera el límite de descarga.'));return;}
        let bytes=0;const chunks=[];response.on('data',chunk=>{bytes+=chunk.length;if(bytes>maxBytes){response.destroy(new Error('Descarga demasiado grande.'));return;}chunks.push(chunk);});response.on('error',fail);response.on('end',()=>{if(settled)return;settled=true;resolve({status,headers:{'content-type':response.headers['content-type']||'',location:location||''},body:Buffer.concat(chunks)});});
      });
      request.setTimeout(15000,()=>request.destroy(new Error('Tiempo de espera HTTP agotado.')));request.on('error',fail);
      if(body&&typeof body.pipe==='function'){body.on('error',e=>request.destroy(e));body.pipe(request);}else request.end(body);
    });
  }
}
function imageMime(bytes){if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return'image/png';if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return'image/jpeg';if(/^GIF8[79]a/.test(bytes.subarray(0,6).toString()))return'image/gif';if(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP')return'image/webp';if(bytes.subarray(0,2).toString()==='BM')return'image/bmp';if(bytes.subarray(4,8).toString()==='ftyp'&&/avif|avis/.test(bytes.subarray(8,32).toString()))return'image/avif';return null;}
function titleOf(html){const match=/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);return match?match[1].replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').slice(0,300):'';}
module.exports={WebClient,privateAddress,imageMime,titleOf};
