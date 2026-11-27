'use strict';
// Real Electron IPC, mSL worker and a local IRC socket; no public IRC network.
const {_electron:electron,expect}=require('@playwright/test');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
const {once}=require('node:events');
async function run(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'dreams-mirc-desktop-')),sockets=new Set(),received=[];
 const source=path.join(root,'Control_Privados_mIRC_v87.mrc');fs.copyFileSync(path.join(__dirname,'../test/fixtures/mirc/Control_Privados_mIRC_v87.mrc'),source);
 const server=net.createServer(socket=>{
  sockets.add(socket);socket.on('close',()=>sockets.delete(socket));let buffer='',echoEnabled=false;
  socket.on('data',data=>{buffer+=data;let at;while((at=buffer.indexOf('\r\n'))>=0){
   const line=buffer.slice(0,at);buffer=buffer.slice(at+2);received.push(line.replace(/^@\S+ /,''));
   if(line==='CAP LS 302')socket.write(':local CAP * LS :echo-message labeled-response message-tags\r\n');
   if(line.startsWith('CAP REQ :')){echoEnabled=line.includes('echo-message');socket.write(':local CAP * ACK :'+line.split('CAP REQ :')[1]+'\r\n');}
   const sent=/^(?:@([^ ]+) )?PRIVMSG (\S+) :([\s\S]*)$/.exec(line);if(sent&&echoEnabled)socket.write((sent[1]?'@'+sent[1]+' ':'')+':Tester!me@local PRIVMSG '+sent[2]+' :'+sent[3]+'\r\n');
   if(line.startsWith('USER '))socket.write(':local 001 Tester :Welcome\r\n:local 005 Tester PREFIX=(qaohv)~&@%+ :supported\r\n');
   if(line==='JOIN #prueba')socket.write(':Tester!me@local JOIN :#prueba\r\n:local 353 Tester = #prueba :@Tester Victima\r\n:local 366 Tester #prueba :End\r\n:Victima!guest@one.host JOIN :#prueba\r\n');
   if(line==='MODE #prueba')socket.write(':local 324 Tester #prueba +nt\r\n');
  }});
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');let app;
 try{
  const args=[...(process.platform==='linux'?['--no-sandbox','--ozone-platform=headless','--disable-gpu']:[]),'--user-data-dir='+path.join(root,'profile'),...(process.env.DREAMS_BINARY?[]:[process.env.DREAMS_APP_ASAR||'.'])];
  app=await electron.launch({args,env:{...process.env,XDG_CONFIG_HOME:root,XDG_CACHE_HOME:path.join(root,'cache')},timeout:20000,...(process.env.DREAMS_BINARY?{executablePath:process.env.DREAMS_BINARY}:{})});
  app.process().on('exit',(code,signal)=>console.log('Electron exit',code,signal));
  const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.waitForFunction(()=>window.dreamsUIReady===true);
  await app.evaluate(({Notification,shell})=>{Notification.isSupported=()=>false;shell.beep=()=>{};});
  await page.getByRole('button',{name:'Añadir red',exact:true}).click();
  await page.locator('#profile-name').fill('Prueba mSL');await page.locator('#profile-host').fill('127.0.0.1');
  await page.locator('#profile-port').fill(String(server.address().port));await page.locator('#profile-tls').uncheck();
  await page.locator('#profile-nick').fill('Tester');await page.locator('#profile-channels').fill('#prueba');
  await page.getByRole('button',{name:'Guardar y conectar',exact:true}).click();
  await expect(page.locator('#message-input')).toBeEnabled();
  await expect(page.getByRole('button',{name:'@Tester',exact:true})).toBeVisible();
  await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},source);
  const imported=await page.evaluate(()=>window.dreams.advanced('script.mirc.import'));
  expect(imported.error).toBeUndefined();expect(imported.aliases).toContain('pvconfig');
  const commands=await page.evaluate(()=>window.dreams.advanced('script.commands'));expect(commands.some(c=>c.name==='pvconfig')).toBe(true);expect(commands.some(c=>c.name==='pv.ruta')).toBe(false);
  const pending=page.locator('.mirc-dialog').filter({has:page.getByRole('heading',{name:/Pendientes y autoaceptados/})});
  const config=page.locator('.mirc-dialog').filter({has:page.getByRole('heading',{name:/Dramatiik - Configuracion/})});
  const send=text=>[...sockets].forEach(s=>s.write(text+'\r\n'));
  send(':Alice!guest@one.host PRIVMSG Tester :primero "literal"');
  await expect(pending).toBeVisible();await expect.poll(()=>received.some(l=>/^PRIVMSG Alice :Espere/.test(l))).toBe(true);
  send(':Victima!guest@one.host PRIVMSG #prueba :eco procesado');await expect(page.locator('#messages')).toContainText('eco procesado');
  expect(await page.evaluate(()=>network(active.id).conversations.has(fold('Alice')))).toBe(false);
  send(':Alice!guest@one.host PRIVMSG Tester :segundo');
  await pending.locator('[data-mirc-id="10"]').selectOption('1');await pending.getByRole('button',{name:'Aceptar',exact:true}).click();
  await expect.poll(()=>received.some(l=>/^PRIVMSG Alice :Hola Alice/.test(l))).toBe(true);
  await expect(page.locator('#messages')).toContainText('primero "literal"');await expect(page.locator('#messages')).toContainText('segundo');
  send(':Alice!guest@one.host PRIVMSG Tester :tercero visible');await expect(page.locator('#messages')).toContainText('tercero visible');
  await page.evaluate(()=>choose(active.id,'Existing'));
  send(':Existing!guest@old.host PRIVMSG Tester :secreto ventana existente');
  await expect(pending.locator('[data-mirc-id="10"]')).toContainText('Existing');
  expect(await page.evaluate(()=>conversation(active.id,'Existing').messages.some(m=>m.text.includes('secreto ventana existente')))).toBe(false);
  send(':Victima!guest@one.host PRIVMSG #prueba :existente procesado');await expect.poll(()=>page.evaluate(()=>conversation(active.id,'#prueba').messages.some(m=>m.text==='existente procesado'))).toBe(true);
  expect(await page.evaluate(()=>conversation(active.id,'Existing').messages.length)).toBe(0);
  await page.evaluate(()=>window.dreams.send({id:active.id,target:'*',text:'/pvignorar Existing'}));
  send(':Bob!guest@two.host PRIVMSG Tester :solicitud Bob');await expect(pending.locator('[data-mirc-id="10"]')).toContainText('Bob');
  await pending.locator('[data-mirc-id="10"]').selectOption('1');await pending.getByRole('button',{name:'Rechazar',exact:true}).click();
  await expect.poll(()=>received.some(l=>/^PRIVMSG Bob :Disculpa Bob/.test(l))).toBe(true);
  expect(await page.evaluate(()=>network(active.id).conversations.has(fold('Bob')))).toBe(false);
  await page.locator('#message-input').fill('/pvconfig');await page.locator('#message-input').press('Enter');await expect(config).toBeVisible();
  await page.locator('#message-input').fill('/pvpendientes');await page.locator('#message-input').press('Enter');
  await pending.getByRole('button',{name:'Configuracion',exact:true}).click();
  const beforeMove=await config.boundingBox(),head=config.locator('header').first(),headBox=await head.boundingBox();
  await page.mouse.move(headBox.x+100,headBox.y+15);await page.mouse.down();await page.mouse.move(headBox.x+170,headBox.y+95,{steps:8});await page.mouse.up();
  const afterMove=await config.boundingBox();expect(Math.abs(afterMove.x-beforeMove.x)+Math.abs(afterMove.y-beforeMove.y)).toBeGreaterThan(20);
  await config.locator('[data-mirc-id="13"]').fill('Bien "{nick}"');
  await config.locator('[data-mirc-id="21"] input').check();await config.getByRole('button',{name:'Guardar',exact:true}).click();await expect(config).toHaveCount(0);
  send(':Carol!guest@three.host PRIVMSG Tester :modo automatico');await expect.poll(()=>received.includes('PRIVMSG Carol :Bien "Carol"')).toBe(true);
  await page.evaluate(()=>choose(active.id,'Carol'));await expect(page.locator('#messages')).toContainText('modo automatico');
  await page.locator('#message-input').fill('/pvconfig');await page.locator('#message-input').press('Enter');await expect(config).toBeVisible();
  await config.locator('[data-mirc-id="20"] input').check();await config.getByRole('button',{name:'Guardar',exact:true}).click();await expect(config).toHaveCount(0);
  await pending.locator('[data-mirc-id="41"]').fill('Dave');await pending.getByRole('button',{name:'Agregar nick',exact:true}).click();
  await expect(pending.locator('[data-mirc-id="40"]')).toContainText('dave');await expect(pending.locator('[data-mirc-id="41"]')).toHaveValue('');
  await page.evaluate(async id=>{await window.dreams.advanced('script.mirc.configure',{id,enabled:false});await window.dreams.advanced('script.mirc.configure',{id,enabled:true});},imported.id);
  send(':Dave!guest@four.host PRIVMSG Tester :lista persistente');await expect.poll(()=>received.includes('PRIVMSG Dave :Bien "Dave"')).toBe(true);
  const retained=await page.evaluate(()=>{
   const id=active.id;for(let i=0;i<50;i++)workspace.addMessage(id,'#memoria',{text:'guardado '+i,historical:true});for(let i=0;i<800;i++)workspace.addMessage(id,'#memoria',{nick:'Alice',text:'nuevo '+i});choose(id,'#memoria');choose(id,'#prueba');choose(id,'#memoria');const c=conversation(id,'#memoria');return {count:c.messages.length,first:c.messages[0].text,last:c.messages.at(-1).text};
  });expect(retained).toEqual({count:850,first:'guardado 0',last:'nuevo 799'});
  await expect(page.locator('#messages')).toContainText('guardado 0');await expect(page.locator('#messages')).toContainText('nuevo 799');
  expect(errors).toEqual([]);
  console.log('PASS: v87 original; privado retenido, aceptar y reproducir, rechazo sin abrir PV, diálogo, INI, autoaceptación y lista persistente desde el diálogo; sala con 50 antiguas + 800 nuevas sin recorte.');
 }catch(e){const log=path.join(root,'profile','startup.log');if(fs.existsSync(log))console.error(fs.readFileSync(log,'utf8'));throw e;}finally{
  if(app){let timer;try{await Promise.race([app.close(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Electron no cerró.')),10000);})]);}catch(e){app.process().kill();throw e;}finally{clearTimeout(timer);}}
  for(const socket of sockets)socket.destroy();server.close();fs.rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:100});
 }
}
run().catch(e=>{console.error(e);process.exitCode=1;});
