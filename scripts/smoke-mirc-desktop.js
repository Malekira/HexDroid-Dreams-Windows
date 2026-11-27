'use strict';
// Real Electron IPC, mSL worker and a local IRC socket; no public IRC network.
const {_electron:electron,expect}=require('@playwright/test');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
const {once}=require('node:events');
async function run(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'dreams-mirc-desktop-')),sockets=new Set(),received=[];
 const source=path.join(root,'kaos_ident.mrc');fs.copyFileSync(path.join(__dirname,'../test/fixtures/mirc/kaos_ident.mrc'),source);
 const server=net.createServer(socket=>{
  sockets.add(socket);socket.on('close',()=>sockets.delete(socket));let buffer='';
  socket.on('data',data=>{buffer+=data;let at;while((at=buffer.indexOf('\r\n'))>=0){
   const line=buffer.slice(0,at);buffer=buffer.slice(at+2);received.push(line);
   if(line==='CAP LS 302')socket.write(':local CAP * LS :\r\n');
   if(line.startsWith('USER '))socket.write(':local 001 Tester :Welcome\r\n:local 005 Tester PREFIX=(qaohv)~&@%+ :supported\r\n');
   if(line==='JOIN #prueba')socket.write(':Tester!me@local JOIN :#prueba\r\n:local 353 Tester = #prueba :@Tester Victima\r\n:local 366 Tester #prueba :End\r\n:Victima!guest@one.host JOIN :#prueba\r\n');
   if(line==='WHO Victima')socket.write(':local 352 Tester #prueba guest one.host local Victima H :0 Victima\r\n:local 315 Tester Victima :End\r\n');
   if(line==='MODE #prueba -b')socket.write(':local 367 Tester #prueba *!*@blocked.host Tester 123\r\n:local 368 Tester #prueba :End\r\n');
   if(line==='MODE #prueba')socket.write(':local 324 Tester #prueba +nt\r\n');
  }});
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');let app;
 try{
  const args=[...(process.platform==='linux'?['--no-sandbox','--ozone-platform=headless','--disable-gpu']:[]),'--user-data-dir='+path.join(root,'profile'),...(process.env.DREAMS_BINARY?[]:[process.env.DREAMS_APP_ASAR||'.'])];
  app=await electron.launch({args,env:{...process.env,XDG_CONFIG_HOME:root,XDG_CACHE_HOME:path.join(root,'cache')},timeout:20000,...(process.env.DREAMS_BINARY?{executablePath:process.env.DREAMS_BINARY}:{})});
  const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.waitForFunction(()=>window.dreamsUIReady===true);
  await app.evaluate(({Notification})=>{Notification.isSupported=()=>false;});
  await page.keyboard.press('Control+n');
  await page.locator('#profile-name').fill('Prueba mSL');await page.locator('#profile-host').fill('127.0.0.1');
  await page.locator('#profile-port').fill(String(server.address().port));await page.locator('#profile-tls').uncheck();
  await page.locator('#profile-nick').fill('Tester');await page.locator('#profile-channels').fill('#prueba');
  await page.getByRole('button',{name:'Guardar y conectar',exact:true}).click();
  await expect(page.locator('#message-input')).toBeEnabled();
  await expect(page.getByRole('button',{name:'@Tester',exact:true})).toBeVisible();
  await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},source);
  const imported=await page.evaluate(()=>window.dreams.advanced('script.mirc.import'));
  expect(imported.error).toBeUndefined();expect(imported.aliases).toEqual(['tp-ident']);
  expect((await page.evaluate(()=>window.dreams.advanced('script.commands'))).some(c=>c.name==='tp-ident')).toBe(true);
  await page.locator('#message-input').fill('/tp-ident Victima prueba nativa');await page.locator('#message-input').press('Enter');
  await expect.poll(()=>received.includes('KICK #prueba Victima :prueba nativa')).toBe(true);
  for(const socket of sockets)socket.write(':Reincidente!guest@two.host JOIN :#prueba\r\n');
  await expect.poll(()=>received.includes('KICK #prueba Reincidente :2 prueba nativa')).toBe(true);
  await page.evaluate(id=>window.dreams.advanced('script.mirc.configure',{id,enabled:false}),imported.id);
  await page.evaluate(id=>window.openDreamsScriptEditor(id,'mirc'),imported.id);
  await expect(page.locator('#script-editor-dialog h2')).toHaveText('Editor de scripts compatibles');
  const saved=await page.getByLabel('Código del script',{exact:true}).inputValue();await page.getByLabel('Código del script',{exact:true}).fill(saved+'\nalias editorproof { echo -s Editado desde el panel }');
  await page.locator('#script-editor-dialog').getByRole('button',{name:'Guardar en la aplicación',exact:true}).click();await expect(page.locator('#script-editor-dialog')).toContainText('Addon actualizado');await page.locator('#script-editor-dialog').getByRole('button',{name:'Cerrar',exact:true}).click();
  await page.evaluate(id=>window.openDreamsScriptHelp(id,'mirc'),imported.id);await expect(page.locator('#script-help-dialog')).toContainText('/editorproof');await page.locator('#script-help-dialog').getByRole('button',{name:'Cerrar',exact:true}).click();
  expect((await page.evaluate(()=>window.dreams.advanced('script.mirc.list'))).find(s=>s.id===imported.id).enabled).toBe(false);
  for(const socket of sockets)socket.write(':SinAccion!guest@three.host JOIN :#prueba\r\n');
  await expect(page.getByRole('button',{name:'SinAccion',exact:true})).toBeVisible();
  expect(received.some(line=>line.startsWith('KICK #prueba SinAccion'))).toBe(false);
  // Exercise original timer/RAW/menu/custom-window addons through real IPC and IRC.
  for(const name of ['spy.mrc','delBans.mrc']){
   const file=path.join(__dirname,'../test/fixtures/mirc',name);
   await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},file);
   const result=await page.evaluate(()=>window.dreams.advanced('script.mirc.import'));expect(result.error).toBeUndefined();
  }
  await page.evaluate(()=>window.dreams.send({id:active.id,target:'#prueba',text:'/spy Victima'}));
  await expect.poll(()=>received.includes('WHO Victima')).toBe(true);
  await expect(page.locator('#conversation-title')).toHaveText('*addon-spy*');
  await expect(page.locator('#message-input')).toBeDisabled();
  await expect(page.locator('#messages')).toContainText('Victima');
  await page.getByText('Scripts',{exact:true}).first().click();
  await expect(page.getByRole('button',{name:'spy › Comands',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'spy › Comands',exact:true}).click();
  await page.getByRole('button',{name:'Sala #prueba',exact:true}).click({button:'right'});
  await expect(page.getByRole('menuitem',{name:'spy › Comands',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');
  await page.evaluate(()=>window.dreams.send({id:active.id,target:'#prueba',text:'/delBans'}));
  await expect.poll(()=>received.some(line=>line.startsWith('MODE #prueba -bbbbbb *!*@blocked.host'))).toBe(true);
  expect(errors).toEqual([]);
  console.log('PASS: originales spy/delBans: RAW, timer, menú, ventana local; Electron + IRC local + IPC + worker mSL; kaos_ident original, alias, JOIN, ident y desactivación'+(process.env.DREAMS_APP_ASAR?' desde app.asar empaquetado.':'.'));
 }finally{
  if(app){let timer;try{await Promise.race([app.close(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Electron no cerró.')),10000);})]);}catch(e){app.process().kill();throw e;}finally{clearTimeout(timer);}}
  for(const socket of sockets)socket.destroy();server.close();fs.rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:100});
 }
}
run().catch(e=>{console.error(e);process.exitCode=1;});
