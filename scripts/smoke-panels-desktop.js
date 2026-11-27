'use strict';
// Real Electron IPC, mSL worker and a local IRC socket; no public IRC network.
const {_electron:electron,expect}=require('@playwright/test');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
const {once}=require('node:events');
async function run(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'dreams-mirc-desktop-')),sockets=new Set(),received=[];
 const source=path.join(root,'ignorakuerys.xcr');fs.copyFileSync(path.join(__dirname,'../test/fixtures/mirc/ignorakuerys.xcr'),source);
 const server=net.createServer(socket=>{
  sockets.add(socket);socket.on('close',()=>sockets.delete(socket));let buffer='';
  socket.on('data',data=>{buffer+=data;let at;while((at=buffer.indexOf('\r\n'))>=0){
   const line=buffer.slice(0,at);buffer=buffer.slice(at+2);received.push(line);
   if(line==='CAP LS 302')socket.write(':local CAP * LS :\r\n');
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
  await page.keyboard.press('Control+n');
  await page.locator('#profile-name').fill('Prueba mSL');await page.locator('#profile-host').fill('127.0.0.1');
  await page.locator('#profile-port').fill(String(server.address().port));await page.locator('#profile-tls').uncheck();
  await page.locator('#profile-nick').fill('Tester');await page.locator('#profile-channels').fill('#prueba');
  await page.getByRole('button',{name:'Guardar y conectar',exact:true}).click();
  await expect(page.locator('#message-input')).toBeEnabled();
  await expect(page.getByRole('button',{name:'@Tester',exact:true})).toBeVisible();
  await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},source);
  const imported=await page.evaluate(()=>window.dreams.advanced('script.mirc.import'));expect(imported.error).toBeUndefined();
  const panel=page.locator('.mirc-dialog').filter({has:page.getByRole('heading',{name:'Ignora querys',exact:true})});
  await page.getByText('Scripts',{exact:true}).first().click();
  await page.getByRole('button',{name:/Ignorar Querys.*Configuraci/}).click();
  await expect(panel).toBeVisible();
  const combo=panel.locator('[data-mirc-id="1"] input'),choices=panel.locator('[data-mirc-id="1"] select');
  await combo.fill('Alice');await panel.getByRole('button',{name:'Añadir',exact:true}).click();await expect(choices).toContainText('Alice');
  await combo.fill('Carol');await panel.getByRole('button',{name:'Añadir',exact:true}).click();await expect(choices.locator('option')).toHaveCount(2);
  await choices.selectOption('2');await panel.getByRole('button',{name:'Borrar',exact:true}).click();await expect(choices.locator('option')).toHaveCount(1);
  await panel.locator('[data-mirc-id="4"] input').check();
  await panel.locator('[data-mirc-id="6"]').fill('No acepto privados ahora.');
  await panel.getByRole('button',{name:'Cerrar',exact:true}).click();await expect(panel).toHaveCount(0);
  const send=text=>[...sockets].forEach(s=>s.write(text+'\r\n'));
  send(':Alice!guest@one.host PRIVMSG Tester :permitido');
  await expect.poll(()=>page.evaluate(()=>network(active.id).conversations.has(fold('Alice')))).toBe(true);
  send(':Bob!guest@two.host PRIVMSG Tester :bloqueado');
  await expect.poll(()=>received.includes('PRIVMSG Bob :No acepto privados ahora.')).toBe(true);
  expect(await page.evaluate(()=>network(active.id).conversations.has(fold('Bob')))).toBe(false);
  await page.getByText('Scripts',{exact:true}).first().click();await page.getByRole('button',{name:/Ignorar Querys.*Configuraci/}).click();
  await expect(choices).toContainText('Alice');await panel.getByRole('button',{name:'Cerrar',exact:true}).click();
  await page.evaluate(id=>window.dreams.advanced('script.mirc.configure',{id,enabled:false}),imported.id);
  const guardFile=path.join(__dirname,'../test/fixtures/mirc/PVGuard.mrc');
  await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},guardFile);
  const guard=await page.evaluate(()=>window.dreams.advanced('script.mirc.import'));expect(guard.error).toBeUndefined();
  await page.evaluate(()=>window.dreams.send({id:active.id,target:'#prueba',text:'/pvguard on'}));
  const decision=page.locator('.mirc-dialog').filter({has:page.getByRole('heading',{name:'Solicitud de PV',exact:true})});
  send(':Dave!guest@four.host PRIVMSG Tester :solicitud Dave');await expect(decision).toBeVisible();
  await decision.getByRole('button',{name:'Aceptar',exact:true}).click();
  await expect.poll(()=>received.includes('PRIVMSG Dave :Privado aceptado.')).toBe(true);
  // A default button does not close unless the script requests it (PVGuard does).
  await expect(decision).toHaveCount(0);
  send(':Dave!guest@four.host PRIVMSG Tester :aceptado sin preguntar');
  await expect.poll(()=>page.evaluate(()=>conversation(active.id,'Dave').messages.some(m=>m.text==='aceptado sin preguntar'))).toBe(true);
  send(':Eve!guest@five.host PRIVMSG Tester :solicitud Eve');await expect(decision).toBeVisible();
  await decision.press('Escape');await expect(decision).toHaveCount(0);await expect.poll(()=>received.includes('PRIVMSG Eve :Privado rechazado.')).toBe(true);
  expect(await page.evaluate(()=>network(active.id).conversations.has(fold('Eve')))).toBe(false);
  send(':Eve!guest@five.host PRIVMSG Tester :segundo bloqueado');send(':Victima!guest@one.host PRIVMSG #prueba :cola procesada');
  await expect.poll(()=>page.evaluate(()=>conversation(active.id,'#prueba').messages.some(m=>m.text==='cola procesada'))).toBe(true);
  expect(received.filter(l=>l==='PRIVMSG Eve :Privado rechazado.').length).toBe(1);
  expect(errors).toEqual([]);console.log('PASS: paneles originales Ignora Querys y PVGuard; combo, lista, edición inmediata, casilla, filtrado, aceptar y Escape/rechazar; Electron + IPC + IRC local.');
 }catch(e){try{console.error('Panel debug',await (await app.firstWindow()).evaluate(()=>({active:document.activeElement?.outerHTML,feedback:document.querySelector('#settings-feedback')?.textContent,body:document.body.innerText.slice(-2500)})));console.error('IRC debug',received.slice(-20));}catch{}const log=path.join(root,'profile','startup.log');if(fs.existsSync(log))console.error(fs.readFileSync(log,'utf8'));throw e;}finally{
  if(app){let timer;try{await Promise.race([app.close(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Electron no cerró.')),10000);})]);}catch(e){app.process().kill();throw e;}finally{clearTimeout(timer);}}
  for(const socket of sockets)socket.destroy();server.close();fs.rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:100});
 }
}
run().catch(e=>{console.error(e);process.exitCode=1;});
