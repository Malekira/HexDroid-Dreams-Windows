'use strict';
const{EventEmitter}=require('node:events');const fs=require('node:fs'),path=require('node:path'),net=require('node:net'),tls=require('node:tls'),crypto=require('node:crypto');const{Transform}=require('node:stream');const{pipeline}=require('node:stream/promises');
function address(value){if(/^\d+$/.test(value)){const n=Number(value);if(!Number.isSafeInteger(n)||n<1||n>0xffffffff)throw new Error('Dirección DCC no válida.');return[n>>>24,(n>>>16)&255,(n>>>8)&255,n&255].join('.');}if(!net.isIP(value))throw new Error('DCC requiere una dirección IP explícita.');return value;}
function safeName(name){const value=path.win32.basename(path.posix.basename(String(name))).replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[ .]+$/,'').slice(0,180);if(!value||/^(?:con|prn|aux|nul|com\d|lpt\d)(?:\.|$)/i.test(value))throw new Error('Nombre de archivo DCC no válido.');return value;}
function words(text){const result=[];let at=0;while(at<text.length){while(text[at]===' ')at++;if(at>=text.length)break;if(text[at]==='"'){const end=text.indexOf('"',++at);if(end<0)throw new Error('Nombre DCC sin cerrar.');result.push(text.slice(at,end));at=end+1;if(text[at]&&text[at]!==' ')throw new Error('Separador DCC no válido.');}else{let end=text.indexOf(' ',at);if(end<0)end=text.length;result.push(text.slice(at,end));at=end;}}return result;}
function parseOffer(text){
  const w=words(text),kind=w[0];if(!['SEND','SSEND','CHAT','SCHAT','RESUME','ACCEPT'].includes(kind))throw new Error('Tipo DCC no soportado.');
  if(kind==='RESUME'||kind==='ACCEPT'){if(w.length<4||w.length>5)throw new Error('Reanudación DCC no válida.');const port=Number(w[2]),offset=Number(w[3]);if(!Number.isInteger(port)||port<0||port>65535||!Number.isSafeInteger(offset)||offset<0)throw new Error('Reanudación DCC fuera de rango.');return{kind,name:safeName(w[1]),port,offset,token:w[4]};}
  const chat=kind==='CHAT'||kind==='SCHAT';if(w.length<(chat?4:5)||w.length>(chat?5:6))throw new Error('Oferta DCC mal formada.');const host=address(w[2]),port=Number(w[3]),size=chat?undefined:Number(w[4]),token=w[chat?4:5];
  if(!Number.isInteger(port)||port<0||port>65535||!chat&&(!Number.isSafeInteger(size)||size<0)||port===0&&!token)throw new Error('Puerto o tamaño DCC no válido.');
  if(net.isIP(host)===4&&(host.startsWith('0.')||Number(host.split('.')[0])>=224)||host==='::')throw new Error('Dirección DCC no enrutable.');
  return{kind,name:chat?'chat':safeName(w[1]),host,port,size,token,chat,tls:kind==='SSEND'||kind==='SCHAT'};
}
class DccManager extends EventEmitter {
  constructor({directory,send,settings=()=>({}),tlsMaterial=async()=>null,trust=()=>null,canConnect=()=>true}){super();this.directory=directory;this.send=send;this.settings=settings;this.tlsMaterial=tlsMaterial;this.trust=trust;this.canConnect=canConnect;this.transfers=new Map();this.journal=path.join(directory,'dcc-state.json');try{const records=JSON.parse(fs.readFileSync(this.journal,'utf8'));if(Array.isArray(records))for(const t of records.slice(0,200))if(t&&typeof t.id==='string'&&typeof t.name==='string'&&typeof t.network==='string')this.transfers.set(t.id,{...t,state:['done','rejected'].includes(t.state)?t.state:'failed',error:t.state==='done'?'':'Interrumpida al cerrar la aplicación.'});}catch{}}
  view(t){return{id:t.id,network:t.network,nick:t.nick,name:t.name,kind:t.kind,direction:t.direction,state:t.state,host:t.host,port:t.port,size:t.size,bytes:t.bytes||0,acknowledged:t.acknowledged||0,speed:t.started?Math.round((t.bytes||0)/Math.max(.1,(Date.now()-t.started)/1000)):0,error:t.error||'',tls:t.tls===true,resumable:!!t.partial&&fs.existsSync(t.partial)};}
  update(t){if(t.savedState!==t.state||Date.now()-(this.lastSaved||0)>1000){this.lastSaved=Date.now();t.savedState=t.state;try{fs.mkdirSync(this.directory,{recursive:true});const records=[...this.transfers.values()].map(t=>({...this.view(t),partial:t.partial,destination:t.destination,file:t.file,offset:t.offset,token:t.token,chat:t.chat,passive:t.passive}));fs.writeFileSync(this.journal+'.tmp',JSON.stringify(records),{mode:0o600});fs.renameSync(this.journal+'.tmp',this.journal);}catch(e){this.emit('problem','No se pudo guardar el estado DCC: '+e.message);}}this.emit('update',this.view(t));}
  list(){return[...this.transfers.values()].map(t=>this.view(t));}
  offer(network,nick,args){
    const o=parseOffer(args);
    if(o.token&&o.port>0&&['SEND','SSEND'].includes(o.kind)){
      const outgoing=[...this.transfers.values()].find(t=>t.direction==='send'&&t.passive&&t.token===o.token&&t.network===network&&t.nick.toLowerCase()===nick.toLowerCase()&&t.name===o.name&&t.size===o.size&&t.kind===o.kind&&t.state==='offered');
      if(outgoing){outgoing.host=o.host;outgoing.port=o.port;clearTimeout(outgoing.timer);outgoing.run=this.connectSocket(outgoing).then(socket=>this.upload(outgoing,socket)).catch(e=>this.fail(outgoing,e));return this.view(outgoing);}
    }
    if(o.kind==='RESUME'){
      const t=[...this.transfers.values()].find(t=>t.network===network&&t.nick.toLowerCase()===nick.toLowerCase()&&t.direction==='send'&&t.name===o.name&&t.port===o.port&&t.state==='offered');
      if(!t||o.offset>t.size)throw new Error('No hay una transferencia compatible para reanudar.');t.offset=o.offset;this.send(network,nick,`DCC ACCEPT "${t.name}" ${t.port} ${o.offset}${o.token?' '+o.token:''}`);return this.view(t);
    }
    if(o.kind==='ACCEPT'){
      const t=[...this.transfers.values()].find(t=>t.network===network&&t.nick.toLowerCase()===nick.toLowerCase()&&t.name===o.name&&t.port===o.port&&t.state==='resume-wait'&&t.offset===o.offset);
      if(!t)throw new Error('Respuesta DCC ACCEPT inesperada.');clearTimeout(t.timer);t.run=this.receive(t).catch(e=>this.fail(t,e));return this.view(t);
    }
    if(this.transfers.size>=200){const done=[...this.transfers.values()].find(t=>['done','rejected','failed','cancelled'].includes(t.state));if(done)this.transfers.delete(done.id);else throw new Error('Límite de transferencias DCC.');}
    const previous=[...this.transfers.values()].find(t=>t.direction==='receive'&&t.network===network&&t.nick.toLowerCase()===nick.toLowerCase()&&t.name===o.name&&t.size===o.size&&t.partial&&fs.existsSync(t.partial));
    const t={...o,id:crypto.randomUUID(),network,nick,direction:'receive',state:'offered',bytes:0,...(previous?{partial:previous.partial,destination:previous.destination,chosenDestination:previous.destination}:{})};this.transfers.set(t.id,t);this.update(t);
    const s=this.settings();if(s.dccAutoAccept===true&&Array.isArray(s.dccAllowlist)&&s.dccAllowlist.some(n=>n.toLowerCase()===nick.toLowerCase())&&!o.chat&&!o.tls&&o.size<=(s.dccMaxBytes||1073741824))this.accept(t.id).catch(e=>this.fail(t,e));return this.view(t);
  }
  fail(t,e){if(['cancelled','rejected'].includes(t.state))return;t.state='failed';t.error=e.message||String(e);t.socket?.destroy();try{t.server?.close();}catch{}clearTimeout(t.timer);this.update(t);}
  cancel(id,reject=false){const t=this.transfers.get(id);if(!t)throw new Error('Transferencia no encontrada.');t.state=reject?'rejected':'cancelled';clearTimeout(t.timer);t.abort?.abort();t.socket?.destroy();try{t.server?.close();}catch{}this.update(t);}
  async listen(t,accept){
    if(!this.canConnect(t.network))throw new Error('DCC es directo y puede revelar tu IP. Está desactivado mientras usas un proxy.');
    const s=this.settings(),host=s.dccBind||'0.0.0.0';if(!net.isIP(host))throw new Error('Dirección de escucha DCC no válida.');
    const material=t.tls?await this.tlsMaterial(s.dccAddress||t.host):null;if(t.tls&&!material)throw new Error('Configura el certificado DCC TLS antes de enviar.');
    const handler=socket=>{if(t.socket){socket.destroy();return;}t.socket=socket;clearTimeout(t.timer);t.server.close();accept(socket).catch(e=>this.fail(t,e));};
    const server=t.tls?tls.createServer({cert:material.cert,key:material.key,minVersion:'TLSv1.2'},handler):net.createServer(handler);t.server=server;
    server.on('tlsClientError',e=>{t.error=e.message;this.update(t);});server.on('error',e=>{if(e.code!=='EADDRINUSE')this.fail(t,e);});
    const start=Number(s.dccPortStart)||0,end=start?Math.max(start,Number(s.dccPortEnd)||start):0;
    let bound=false;for(let port=start;port<=end;port++){try{await new Promise((resolve,reject)=>{const error=e=>{server.removeListener('listening',ready);reject(e);},ready=()=>{server.removeListener('error',error);resolve();};server.once('error',error);server.once('listening',ready);server.listen(port,host);});bound=true;break;}catch(e){if(e.code!=='EADDRINUSE'||port===end)throw e;}}
    if(!bound)throw new Error('No hay un puerto DCC disponible.');t.port=server.address().port;t.timer=setTimeout(()=>this.fail(t,new Error('La oferta DCC caducó.')),120000);t.timer.unref();return t.port;
  }
  wireHost(host){return net.isIP(host)===4?String(host.split('.').reduce((n,v)=>n*256+Number(v),0)):host;}
  async sendFile(network,nick,file,{secure=false,passive=false}={}){
    if(typeof nick!=='string'||/^[#&+!]/.test(nick)||/[\s\0\r\n,:]/.test(nick))throw new Error('Selecciona un usuario privado para DCC.');
    const stat=await fs.promises.stat(file);if(!stat.isFile())throw new Error('Selecciona un archivo regular.');
    const s=this.settings(),host=address(s.dccAddress||'127.0.0.1');
    if(stat.size>(s.dccMaxBytes||1073741824))throw new Error('El archivo supera el límite DCC configurado.');
    const t={id:crypto.randomUUID(),network,nick,name:safeName(path.basename(file)),file,size:stat.size,kind:secure?'SSEND':'SEND',tls:secure,direction:'send',state:'offered',host,bytes:0,offset:0,passive};this.transfers.set(t.id,t);
    if(passive){t.port=0;t.token=String(crypto.randomInt(1,0x7fffffff));t.timer=setTimeout(()=>this.fail(t,new Error('La oferta DCC pasiva caducó.')),120000);t.timer.unref();}
    else await this.listen(t,socket=>this.upload(t,socket));
    this.send(network,nick,`DCC ${t.kind} "${t.name}" ${this.wireHost(host)} ${t.port} ${t.size}${t.token?' '+t.token:''}`);this.update(t);return this.view(t);
  }
  async connectSocket(t){
    if(!this.canConnect(t.network))throw new Error('DCC directo está desactivado mientras usas proxy.');
    const trust=t.tls?this.trust(t.network,t.nick):null;if(t.tls&&!trust)throw new Error('Importa y verifica el certificado del remitente antes de aceptar SSEND/SCHAT.');
    return new Promise((resolve,reject)=>{const ready=()=>{socket.setTimeout(0);resolve(socket);},socket=t.tls?tls.connect({host:t.host,port:t.port,ca:[...tls.rootCertificates,trust],rejectUnauthorized:true,minVersion:'TLSv1.2',servername:net.isIP(t.host)?undefined:t.host},ready):net.createConnection({host:t.host,port:t.port},ready);t.socket=socket;socket.setTimeout(20000);socket.once('timeout',()=>socket.destroy(new Error('Conexión DCC agotada.')));socket.once('error',reject);});
  }
  async accept(id,{resume=false,destination}={}){
    const t=this.transfers.get(id);if(!t||!['offered','failed','cancelled'].includes(t.state))throw new Error('Oferta DCC no disponible.');
    const s=this.settings();if(!t.chat&&t.size>(s.dccMaxBytes||1073741824))throw new Error('La oferta supera el límite de tamaño configurado.');
    if(t.direction==='send')throw new Error('No puedes aceptar tu propia oferta.');
    await t.run;
    if(destination){if(!path.isAbsolute(destination))throw new Error('Destino de descarga no válido.');t.chosenDestination=destination;}
    if(resume&&t.partial&&fs.existsSync(t.partial)){const stat=fs.lstatSync(t.partial);if(!stat.isFile()||stat.isSymbolicLink())throw new Error('El archivo parcial no es un archivo regular.');t.offset=stat.size;if(t.offset>t.size)throw new Error('El archivo parcial supera el tamaño ofrecido.');t.state='resume-wait';this.send(t.network,t.nick,`DCC RESUME "${t.name}" ${t.port} ${t.offset}${t.token?' '+t.token:''}`);t.timer=setTimeout(()=>this.fail(t,new Error('No se confirmó la reanudación DCC.')),30000);t.timer.unref();this.update(t);return this.view(t);}
    t.offset=0;
    if(t.port===0){await this.listen(t,socket=>t.chat?this.chat(t,socket):this.receive(t,socket));this.send(t.network,t.nick,`DCC ${t.kind} "${t.name}" ${this.wireHost(address(s.dccAddress||'127.0.0.1'))} ${t.port}${t.chat?'':' '+t.size} ${t.token}`);t.state='connecting';this.update(t);}
    else t.run=(t.chat?this.connectSocket(t).then(socket=>this.chat(t,socket)):this.receive(t)).catch(e=>this.fail(t,e));return this.view(t);
  }
  progress(t,bytes){t.bytes=bytes;if(!t.lastUpdate||Date.now()-t.lastUpdate>100){t.lastUpdate=Date.now();this.update(t);}}
  async receive(t,socket){
    t.state='connecting';this.update(t);socket||=await this.connectSocket(t);t.started=Date.now();t.state='active';this.update(t);
    const dir=t.chosenDestination?path.dirname(t.chosenDestination):this.settings().downloadsDirectory||this.directory;await fs.promises.mkdir(dir,{recursive:true});
    if(!t.partial||!t.offset){t.partial=path.join(dir,'.'+t.id+'.part');t.destination=t.chosenDestination||path.join(dir,t.name);}
    t.abort=new AbortController();let total=t.offset||0;const expected=t.size;
    const meter=new Transform({transform:(chunk,encoding,done)=>{if(total+chunk.length>expected){done(new Error('El remitente excedió el tamaño ofrecido.'));return;}total+=chunk.length;const ack=Buffer.alloc(4);ack.writeUInt32BE(total>>>0);socket.write(ack);this.progress(t,total);done(null,chunk);}});
    await pipeline(socket,meter,fs.createWriteStream(t.partial,{flags:t.offset?'a':'wx',mode:0o600}),{signal:t.abort.signal});
    if(total!==expected)throw new Error('Transferencia incompleta: puedes solicitar reanudación.');
    await fs.promises.link(t.partial,t.destination);await fs.promises.unlink(t.partial);t.partial=null;t.state='done';t.bytes=total;this.update(t);
  }
  async upload(t,socket){
    t.state='active';t.started=Date.now();t.abort=new AbortController();this.update(t);let ackBuffer=Buffer.alloc(0),last=(t.offset||0)>>>0,wrap=Math.floor((t.offset||0)/0x100000000)*0x100000000;t.acknowledged=t.offset||0;
    let resolveAck,rejectAck;const confirmed=new Promise((resolve,reject)=>{resolveAck=resolve;rejectAck=reject;});confirmed.catch(()=>{});if(t.acknowledged===t.size)resolveAck();const ackTimer=setTimeout(()=>rejectAck(new Error('No se recibió la confirmación final DCC.')),10000);ackTimer.unref();socket.once('close',()=>{if(t.acknowledged!==t.size)rejectAck(new Error('DCC se cerró sin confirmar el archivo.'));});
    socket.on('data',chunk=>{ackBuffer=Buffer.concat([ackBuffer,chunk]);if(ackBuffer.length>65536){socket.destroy(new Error('Respuestas DCC demasiado grandes.'));return;}while(ackBuffer.length>=4){const n=ackBuffer.readUInt32BE();ackBuffer=ackBuffer.subarray(4);if(n<last)wrap+=0x100000000;last=n;if(wrap+n>t.size){socket.destroy(new Error('Confirmación DCC fuera de rango.'));return;}t.acknowledged=wrap+n;if(t.acknowledged===t.size)resolveAck();}});
    let total=t.offset||0;const meter=new Transform({transform:(chunk,encoding,done)=>{total+=chunk.length;this.progress(t,total);done(null,chunk);}});
    try{await pipeline(fs.createReadStream(t.file,{start:t.offset||0}),meter,socket,{signal:t.abort.signal});await confirmed;}finally{clearTimeout(ackTimer);}
    if(total!==t.size)throw new Error('El archivo cambió durante el envío.');if(t.acknowledged!==t.size)throw new Error('No se recibió la confirmación final DCC.');t.bytes=total;t.state='done';this.update(t);
  }
  async startChat(network,nick,{secure=false}={}){if(typeof nick!=='string'||/^[#&+!]/.test(nick)||/[\s\0\r\n,:]/.test(nick))throw new Error('Selecciona un usuario privado para DCC.');const s=this.settings(),t={id:crypto.randomUUID(),network,nick,name:'chat',chat:true,kind:secure?'SCHAT':'CHAT',tls:secure,direction:'send',state:'offered',host:address(s.dccAddress||'127.0.0.1'),bytes:0};this.transfers.set(t.id,t);await this.listen(t,socket=>this.chat(t,socket));this.send(network,nick,`DCC ${t.kind} chat ${this.wireHost(t.host)} ${t.port}`);this.update(t);return this.view(t);}
  async chat(t,socket){t.socket=socket;t.state='active';t.started=Date.now();this.update(t);let text='';socket.setEncoding('utf8');socket.on('data',chunk=>{text+=chunk;if(text.length>65536){socket.destroy(new Error('Línea DCC CHAT demasiado grande.'));return;}let i;while((i=text.indexOf('\n'))>=0){const line=text.slice(0,i).replace(/\r$/,'');text=text.slice(i+1);this.emit('chat',{id:t.id,network:t.network,nick:t.nick,text:line,own:false,time:new Date().toISOString()});}});socket.on('error',e=>this.fail(t,e));socket.on('close',()=>{if(t.state==='active'){t.state='done';this.update(t);}});}
  sendChat(id,text){const t=this.transfers.get(id);if(!t?.chat||t.state!=='active'||typeof text!=='string'||/[\0\r\n]/.test(text)||Buffer.byteLength(text)>8192)throw new Error('DCC CHAT no disponible o mensaje inválido.');t.socket.write(text+'\r\n');this.emit('chat',{id,network:t.network,nick:'Tú',text,own:true,time:new Date().toISOString()});}
  close(){for(const t of this.transfers.values())if(!['done','failed','cancelled','rejected'].includes(t.state))this.cancel(t.id);}
}
module.exports={DccManager,parseOffer,safeName,address};
