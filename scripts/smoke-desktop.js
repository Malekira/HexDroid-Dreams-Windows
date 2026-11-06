'use strict';
// Runs the actual Electron app and IPC against a local IRC server.
const { _electron: electron, expect } = require('@playwright/test');
const net = require('node:net');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { spawn } = require('node:child_process');
async function closeApplication(application){
  let timer;
  try{await Promise.race([application.close(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Electron no terminó en 10 segundos.')),10000);})]);}
  catch(error){application.process().kill();throw error;}finally{clearTimeout(timer);}
}
async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dreams-desktop-'));
  const sockets = new Set(), received = [];
  const server = net.createServer(socket => {
    sockets.add(socket); socket.on('close', () => sockets.delete(socket)); socket.setEncoding('utf8'); let buffer = '';
    socket.on('data', data => {
      buffer += data; let i;
      while ((i = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, i); buffer = buffer.slice(i + 2); received.push(line);
        if (line.startsWith('USER ')) socket.write(':local 001 Dreamer :Welcome\r\nPING :desktop-test\r\n');
        if (line === 'JOIN #dreams') socket.write(':Dreamer!u@local JOIN :#dreams\r\n:local 353 Dreamer = #dreams :Dreamer!u@local @Alice!ident@host\r\n:Alice!u@local PRIVMSG #dreams :Desktop IPC works\r\n');
        if (line === 'MODE #dreams') socket.write(':local 324 Dreamer #dreams +nt\r\n');
        if (line === 'WHO Alice') socket.write(':local 352 Dreamer #dreams ident host local Alice H :0 Alice WHO result\r\n:local 315 Dreamer Alice :End of WHO\r\n');
        if (line === 'WHOIS Alice') socket.write(':local 311 Dreamer Alice user host * :Alice Test\r\n:local 318 Dreamer Alice :End of WHOIS\r\n');
        if (line.startsWith('PART #dreams')) socket.write(':Dreamer!u@local PART #dreams :bye\r\n');
      }
    });
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const profileDirectory = path.join(root,'profile');
  const args = [...(process.platform === 'linux' ? ['--no-sandbox','--ozone-platform=headless','--disable-gpu'] : []), '--user-data-dir=' + profileDirectory, ...(process.env.DREAMS_BINARY?[]:['.'])];
  const env = { ...process.env, XDG_CONFIG_HOME: root, XDG_CACHE_HOME: path.join(root, 'cache') };
  // On Windows, isolate userData too, without modifying the production application.
  if (process.platform === 'win32') env.APPDATA = root;
  let app;
  try {
    console.log('Prueba Electron: '+(process.env.DREAMS_BINARY?'ejecutable empaquetado':'código fuente')+' · abrir');
    app = await electron.launch({ args, env, timeout:20000, ...(process.env.DREAMS_BINARY?{executablePath:process.env.DREAMS_BINARY}:{}) }); let page = await app.firstWindow({timeout:20000});
    const rendererErrors = []; page.on('pageerror', e => rendererErrors.push(e.message));
    await expect(page.locator('#conversation-title')).toHaveText('Bienvenido a Dreams');
    await page.getByRole('button', { name: 'Añadir red', exact: true }).click();
    await page.locator('#profile-name').fill('Servidor de prueba'); await page.locator('#profile-host').fill('127.0.0.1');
    await page.locator('#profile-port').fill(String(server.address().port)); await page.locator('#profile-tls').uncheck();
    await page.locator('#profile-nick').fill('Dreamer'); await page.locator('#profile-channels').fill('#dreams');
    await page.getByRole('button', { name: 'Guardar y conectar', exact: true }).click();
    await expect(page.locator('.message-text')).toHaveText('Desktop IPC works');
    await expect(page.getByRole('button', { name: '@Alice', exact: true })).toBeVisible();
    await expect(page.locator('#channel-modes')).toHaveText('+nt');
    await page.locator('#message-input').fill('Desktop sent a message'); await page.locator('#message-input').press('Enter');
    await expect.poll(() => received.includes('PRIVMSG #dreams :Desktop sent a message')).toBe(true);
    await expect.poll(() => received.includes('PONG :desktop-test')).toBe(true);
    await page.locator('#message-input').fill('draft in channel');
    await page.getByRole('button',{name:'@Alice',exact:true}).dblclick();
    await expect(page.getByRole('button',{name:'Privado Alice',exact:true})).toBeVisible();
    await expect(page.getByRole('tab',{name:'Alice',exact:true})).toHaveCount(0);
    await page.locator('#message-input').fill('draft in private');
    await page.getByRole('tab',{name:'#dreams',exact:true}).click();
    await expect(page.locator('#message-input')).toHaveValue('draft in channel');
    await page.getByRole('button',{name:'Privado Alice',exact:true}).click();
    await expect(page.locator('#message-input')).toHaveValue('draft in private');
    await page.getByRole('button',{name:'Privado Alice',exact:true}).click({button:'right'});
    await page.getByRole('menuitem',{name:'WHOIS',exact:true}).click();
    await expect.poll(() => received.includes('WHOIS Alice')).toBe(true);
    await expect(page.locator('#messages')).toContainText('Alice Test');
    await expect(page.getByRole('tab',{name:'WHOIS / WHO',exact:true})).toBeVisible();
    await page.locator('#message-input').fill('/who Alice');await page.locator('#message-input').press('Enter');
    await expect(page.locator('#messages')).toContainText('Alice WHO result');
    for(const socket of sockets)socket.write(':Alice!ident@host NICK :Alicia\r\n');
    await page.getByRole('tab',{name:'#dreams',exact:true}).click();
    await expect(page.getByRole('button',{name:'@Alicia',exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'@Alice',exact:true})).toHaveCount(0);
    for(const socket of sockets)socket.write(':Alicia!ident@host NICK :Alice\r\n');
    await expect(page.getByRole('button',{name:'@Alice',exact:true})).toBeVisible();
    await page.locator('#message-input').fill('first line\nsecond line'); await page.locator('#message-input').press('Enter');
    await expect.poll(() => received.includes('PRIVMSG #dreams :first line') && received.includes('PRIVMSG #dreams :second line')).toBe(true);
    await page.getByRole('separator',{name:'Ancho de usuarios'}).focus(); await page.keyboard.press('End');
    await page.getByRole('button', { name: 'Ocultar usuarios', exact: true }).click();
    await page.getByRole('separator', { name: 'Ancho de conversaciones' }).focus(); await page.keyboard.press('End');
    await page.getByRole('button', { name: 'Cerrar #dreams', exact: true }).click();
    await expect(page.getByRole('tab', { name: '#dreams', exact: true })).toHaveCount(0);
    await expect.poll(() => received.some(line => line.startsWith('PART #dreams'))).toBe(true);
    await page.getByRole('button', { name: 'Entrar en una sala', exact: true }).click();
    await page.locator('#join-channel').fill('#dreams'); await page.locator('#join-form button[type=submit]').click();
    await expect(page.locator('.message-text')).toHaveText('Desktop IPC works');
    console.log('Prueba Electron: formato permanente sin códigos en el editor');
    await page.getByRole('button',{name:'Negrita',exact:true}).click();
    await page.getByRole('button',{name:'Color IRC',exact:true}).click();
    await page.getByRole('menuitem',{name:'Color 13',exact:true}).click();
    for(const text of ['persistent format one','persistent format two']){
      await page.locator('#message-input').fill(text);
      await expect(page.locator('#message-input')).toHaveValue(text);
      await page.locator('#message-input').press('Enter');
      await expect.poll(()=>received.includes('PRIVMSG #dreams :\x02\x0313'+text+'\x0f')).toBe(true);
      await expect(page.locator('.message-text span').filter({hasText:text})).toHaveCSS('font-weight','700');
    }
    await page.getByRole('button',{name:'Negrita',exact:true}).click();
    await page.getByRole('button',{name:'Color IRC',exact:true}).click();
    await page.getByRole('menuitem',{name:'Sin color',exact:true}).click();
    console.log('Prueba Electron: importar script y confirmar permisos');
    const fixture=path.join(root,'desktop.hex');fs.writeFileSync(fixture,'alias desktophello { msg $buffer scripted desktop transmission }');
    await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});dialog.showMessageBox=async()=>({response:1});},fixture);
    const scriptImport=await page.evaluate(()=>window.dreams.advanced('script.import'));
    expect(scriptImport.error).toBeUndefined();expect(typeof scriptImport.id).toBe('string');
    const scriptConfigure=await page.evaluate(id=>window.dreams.advanced('script.configure',{id,enabled:true,permissions:['send'],domains:[]}),scriptImport.id);
    expect(scriptConfigure.error).toBeUndefined();
    await page.locator('#message-input').fill('/desktophello');await page.locator('#message-input').press('Enter');
    await expect.poll(()=>received.includes('PRIVMSG #dreams :scripted desktop transmission')).toBe(true);
    if(process.platform==='win32'){
      const secure=await page.evaluate(()=>window.dreams.advanced('status'));expect(secure.secureStorage).toBe(true);
      const encrypted=await app.evaluate(({safeStorage})=>{const secret='desktop DPAPI fixture';const bytes=safeStorage.encryptString(secret);return{plain:bytes.includes(Buffer.from(secret)),roundTrip:safeStorage.decryptString(bytes)};});expect(encrypted.plain).toBe(false);expect(encrypted.roundTrip).toBe('desktop DPAPI fixture');
      const cryptoResult=await page.evaluate(async()=>{const id=(await window.dreams.load()).profiles[0].id;const setup=await window.dreams.advanced('crypto.configure',{network:id,target:'#dreams',scheme:'AGM',key:'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='});const sent=await window.dreams.send({id,target:'#dreams',text:'encrypted desktop fixture'});const blocked=await window.dreams.send({id,target:'#dreams',text:'/raw PRIVMSG #dreams :must-not-leak'});await window.dreams.advanced('crypto.configure',{network:id,target:'#dreams',scheme:'none'});return{setup,sent,blocked};});expect(cryptoResult.setup.error).toBeUndefined();expect(cryptoResult.sent.error).toBeUndefined();expect(cryptoResult.blocked.error).toContain('cifrado');await expect.poll(()=>received.some(line=>line.startsWith('PRIVMSG #dreams :+AGM '))).toBe(true);expect(received.some(line=>line.includes('must-not-leak')||line.includes(':encrypted desktop fixture'))).toBe(false);

    }
    console.log('Prueba Electron: multimedia guardada y miniaturas');
    // Supply an image at the HTTP boundary; keep IPC, native decoding, cache and UI real.
    await app.evaluate(({app})=>{
      const req=process.mainModule.require.bind(process.mainModule);
      const {WebClient}=req(app.getAppPath()+'/src/services/web.js');
      const image=req('node:fs').readFileSync(app.getAppPath()+'/src/assets/tray.png');
      WebClient.prototype.request=async function(url){if(!url.startsWith('https://photos.example/'))throw new Error('Unexpected fixture URL');return{status:200,body:image};};
    });
    await page.getByRole('button',{name:'Abrir configuración',exact:true}).click();
    await page.getByRole('button',{name:'Multimedia',exact:true}).click();
    await page.getByLabel('Cargar automáticamente fotos desde mi plantilla',{exact:true}).check();
    await page.getByLabel('URL común de fotos (usa {nick} o {nickLower})',{exact:true}).fill('https://photos.example/{nickLower}.png');
    await page.getByRole('button',{name:'Guardar configuración multimedia',exact:true}).click();
    await expect(page.locator('#settings-feedback')).toHaveText('Listo.');
    await page.locator('#settings-dialog .dialog-header button').click();
    await page.getByRole('button',{name:'Mostrar usuarios',exact:true}).click();
    await expect(page.getByRole('button',{name:'@Alice',exact:true}).locator('img')).toBeVisible();
    await page.getByRole('button',{name:'Ocultar usuarios',exact:true}).click();
    await page.getByRole('button',{name:'Abrir configuración',exact:true}).click();
    await page.getByRole('button',{name:'Multimedia',exact:true}).click();
    await expect(page.getByLabel('URL común de fotos (usa {nick} o {nickLower})',{exact:true})).toHaveValue('https://photos.example/{nickLower}.png');
    await page.getByLabel('Mostrar miniaturas de usuarios',{exact:true}).uncheck();
    await page.getByRole('button',{name:'Guardar configuración multimedia',exact:true}).click();
    await expect(page.locator('#settings-feedback')).toHaveText('Listo.');
    await expect(page.locator('.user-avatar img')).toHaveCount(0);
    await page.getByLabel('Mostrar miniaturas de usuarios',{exact:true}).check();
    await page.getByRole('button',{name:'Guardar configuración multimedia',exact:true}).click();
    await expect(page.locator('#settings-feedback')).toHaveText('Listo.');
    await page.locator('#settings-dialog .dialog-header button').click();
    console.log('Prueba Electron: historial y preferencias');
    // Edit identity and commands in the network form; use a native-decoded photo.
    const photoFile=path.join(root,'identity.png');fs.copyFileSync(path.join(__dirname,'../src/assets/tray.png'),photoFile);
    await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},photoFile);
    await page.getByRole('button',{name:'Abrir configuración',exact:true}).click();
    await expect(page.locator('.settings-group')).toHaveCount(3);
    const settingsSize=await page.locator('#settings-dialog').boundingBox();
    await page.locator('#profile-list').getByRole('button',{name:'Editar',exact:true}).click();
    await page.locator('#profile-username').fill('desktop_ident');await page.locator('#profile-realName').fill('Desktop Real Name');
    await page.locator('#profile-commands').fill('/nick Dreamer');
    await page.getByRole('button',{name:'Elegir foto',exact:true}).click();
    await expect(page.locator('#profile-photo-preview')).toBeVisible();
    const editSize=await page.locator('#network-dialog').boundingBox();expect(editSize.width).toBe(settingsSize.width);expect(editSize.height).toBe(settingsSize.height);
    await page.locator('#network-form').getByRole('button',{name:'Guardar',exact:true}).click();
    const identity=await page.evaluate(async()=>{const c=await window.dreams.load();return c.profiles[0];});expect(identity.username).toBe('desktop_ident');expect(identity.realName).toBe('Desktop Real Name');expect(identity.photo).toMatch(/^data:image\/png;base64,/);const storedCommands=await page.evaluate(async id=>(await window.dreams.advanced('network.commands.get',{network:id})).commands,identity.id);expect(storedCommands).toEqual(['/nick Dreamer']);
    await page.locator('#settings-dialog .dialog-header button').click();
    await page.locator('#message-input').fill('\x0398,16visible extended color\x0f');await page.locator('#message-input').press('Enter');
    await expect(page.locator('.message-text span').filter({hasText:'visible extended color'})).toHaveCSS('color','rgb(255, 255, 255)');
    await expect(page.locator('.message-text span').filter({hasText:'visible extended color'})).toHaveCSS('background-color','rgb(71, 0, 0)');
    await expect(page.locator('.message.own .avatar img').last()).toBeVisible();
    // Exercise the advanced controls through the actual preload and main process.
    await page.getByRole('button',{name:'Abrir configuración',exact:true}).click();
    await expect(page.locator('.advanced-dialog')).toBeVisible();
    await page.getByRole('button',{name:'Historial',exact:true}).click();
    await page.getByLabel('Guardar historial local',{exact:true}).check();
    await page.getByRole('button',{name:'Guardar preferencias',exact:true}).click();
    await expect(page.locator('#settings-feedback')).toHaveText('Listo.');
    await page.locator('.advanced-dialog .dialog-header button').click();
    await page.locator('#message-input').fill('persisted SQLite desktop message');
    await page.locator('#message-input').press('Enter');
    await expect.poll(async()=>await page.evaluate(async()=>{const rows=await window.dreams.advanced('history.search',{text:'persisted SQLite desktop message'});return Array.isArray(rows)&&rows.some(m=>m.text==='persisted SQLite desktop message');})).toBe(true);
    await page.getByRole('button',{name:'Abrir configuración',exact:true}).click();
    await page.getByRole('button',{name:'Scripts .hex',exact:true}).click();
    await expect(page.locator('.advanced-content')).toContainText('Los scripts se importan desactivados');
    await page.getByRole('button',{name:'Notificaciones y tema',exact:true}).click();
    await page.getByLabel('Tema',{exact:true}).selectOption('light');
    await page.getByRole('button',{name:'Guardar',exact:true}).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme','light');
    await page.getByRole('button',{name:'Colores del entorno',exact:true}).click();
    await page.getByLabel('Fondo de conversación',{exact:true}).fill('#123456');
    await page.getByRole('button',{name:'Guardar colores del entorno',exact:true}).click();
    await expect(page.locator('html')).toHaveCSS('--bg','#123456');
    await page.locator('.advanced-dialog .dialog-header button').click();
    await expect(page.getByRole('button',{name:'Herramientas',exact:true})).toHaveCount(0);
    await page.getByRole('button',{name:'Cambiar a tema oscuro',exact:true}).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
    await page.getByRole('button',{name:'Cambiar a tema claro',exact:true}).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme','light');
    const dataPath = await app.evaluate(({ app }) => app.getPath('userData'));
    expect(path.resolve(dataPath)).toBe(path.resolve(profileDirectory));
    // Ensure all queued preference writes have reached the actual main process.
    await expect.poll(() => JSON.parse(fs.readFileSync(path.join(dataPath, 'settings.json'))).settings.sidebarWidth).toBe(420);
    await expect.poll(() => JSON.parse(fs.readFileSync(path.join(dataPath, 'settings.json'))).settings.usersWidth).toBe(360);
    await page.evaluate(async()=>{const c=await window.dreams.load();c.settings.autoAvatars=false;await window.dreams.save(c);});
    await closeApplication(app); app = null;

    console.log('Prueba Electron: '+(process.env.DREAMS_BINARY?'ejecutable empaquetado':'código fuente')+' · abrir');
    app = await electron.launch({ args, env, timeout:20000, ...(process.env.DREAMS_BINARY?{executablePath:process.env.DREAMS_BINARY}:{}) }); page = await app.firstWindow({timeout:20000});
    await expect(page.locator('html')).toHaveCSS('--bg','#123456');
    expect((await page.evaluate(()=>window.dreams.load())).settings.avatarUrlTemplate).toBe('https://photos.example/{nickLower}.png');
    const restoredLeft = await page.evaluate(() => Math.min(420,innerWidth - 365));
    await expect(page.locator('.sidebar')).toHaveCSS('width', restoredLeft + 'px');
    await expect(page.locator('#users-panel')).toBeHidden();
    await expect(page.getByRole('button',{name:'Privado Alice',exact:true})).toBeVisible();
    expect(fs.existsSync(path.join(dataPath,'window-state.json'))).toBe(true);
    await expect(page.locator('#connection-button')).toHaveText('Conectar');
    await page.getByRole('tab',{name:'WHOIS / WHO',exact:true}).click();
    await expect(page.locator('#messages')).toContainText('Alice Test');
    await page.getByRole('tab',{name:'#dreams',exact:true}).click();
    await page.locator('#connection-button').click();
    await expect(page.locator('.message-text').last()).toHaveText('Desktop IPC works');
    await expect(page.locator('.message-text').filter({hasText:'persisted SQLite desktop message'})).toHaveCount(1);
    // A second launch must exit and restore the existing application window.
    const child = spawn(process.env.DREAMS_BINARY||require('electron'), args, { cwd: path.resolve(__dirname, '..'), env, stdio: 'ignore' });
    const timer = setTimeout(() => child.kill(), 10000);
    const [code] = await once(child, 'exit'); clearTimeout(timer);
    expect(code).toBe(0); expect(await app.windows()).toHaveLength(1);
    await closeApplication(app); app = null;

    fs.writeFileSync(path.join(dataPath, 'settings.json'), '{broken-settings');
    console.log('Prueba Electron: '+(process.env.DREAMS_BINARY?'ejecutable empaquetado':'código fuente')+' · abrir');
    app = await electron.launch({ args, env, timeout:20000, ...(process.env.DREAMS_BINARY?{executablePath:process.env.DREAMS_BINARY}:{}) }); page = await app.firstWindow({timeout:20000});
    await expect(page.locator('#conversation-title')).toHaveText('Bienvenido a Dreams');
    await expect(page.locator('#toast')).toContainText('No se pudo leer la configuración');
    expect(fs.readdirSync(dataPath).some(name => name.startsWith('settings.json.recovery-'))).toBe(true);
    expect(fs.readFileSync(path.join(dataPath, 'startup.log'), 'utf8')).toContain('Inicio ' + require('../package.json').version);
    expect(rendererErrors).toEqual([]);
    console.log('PASS: Electron startup, real IPC/IRC, private/channel isolation, drafts, multiline, WHOIS, channel modes, both panel widths, PART/rejoin, second launch, window geometry, single instance, settings recovery, SQLite history, script aliases, themes and startup log.');
  } catch(error){
    const log=path.join(profileDirectory,'startup.log');if(fs.existsSync(log))console.error('Registro de la aplicación de prueba:\n'+fs.readFileSync(log,'utf8'));throw error;
  } finally {
    if (app) try{await closeApplication(app);}catch(error){console.error(error.message);} for (const socket of sockets) socket.destroy(); server.close(); fs.rmSync(root, { recursive: true, force: true });
  }
}
run().catch(e => { console.error(e); process.exitCode = 1; });
