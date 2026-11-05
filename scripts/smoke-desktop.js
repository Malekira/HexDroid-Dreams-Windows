'use strict';
// Runs the actual Electron app and IPC against a local IRC server.
const { _electron: electron, expect } = require('@playwright/test');
const net = require('node:net');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { spawn } = require('node:child_process');
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
        if (line === 'JOIN #dreams') socket.write(':Dreamer!u@local JOIN :#dreams\r\n:local 353 Dreamer = #dreams :Dreamer @Alice\r\n:Alice!u@local PRIVMSG #dreams :Desktop IPC works\r\n');
        if (line.startsWith('PART #dreams')) socket.write(':Dreamer!u@local PART #dreams :bye\r\n');
      }
    });
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const args = process.platform === 'linux' ? ['--no-sandbox','--ozone-platform=headless','--disable-gpu','.'] : ['.'];
  const env = { ...process.env, XDG_CONFIG_HOME: root, XDG_CACHE_HOME: path.join(root, 'cache') };
  // On Windows, isolate userData too, without modifying the production application.
  if (process.platform === 'win32') env.APPDATA = root;
  let app;
  try {
    app = await electron.launch({ args, env }); let page = await app.firstWindow();
    const rendererErrors = []; page.on('pageerror', e => rendererErrors.push(e.message));
    await expect(page.locator('#conversation-title')).toHaveText('Bienvenido a Dreams');
    await page.getByRole('button', { name: 'Añadir red', exact: true }).click();
    await page.locator('#profile-name').fill('Servidor de prueba'); await page.locator('#profile-host').fill('127.0.0.1');
    await page.locator('#profile-port').fill(String(server.address().port)); await page.locator('#profile-tls').uncheck();
    await page.locator('#profile-nick').fill('Dreamer'); await page.locator('#profile-channels').fill('#dreams');
    await page.getByRole('button', { name: 'Guardar y conectar', exact: true }).click();
    await expect(page.locator('.message-text')).toHaveText('Desktop IPC works');
    await expect(page.getByRole('button', { name: '@Alice', exact: true })).toBeVisible();
    await page.locator('#message-input').fill('Desktop sent a message'); await page.locator('#message-input').press('Enter');
    await expect.poll(() => received.includes('PRIVMSG #dreams :Desktop sent a message')).toBe(true);
    await expect.poll(() => received.includes('PONG :desktop-test')).toBe(true);
    await page.getByRole('button', { name: 'Ocultar usuarios', exact: true }).click();
    await page.getByRole('separator', { name: 'Ancho de conversaciones' }).focus(); await page.keyboard.press('End');
    await page.getByRole('button', { name: 'Cerrar #dreams', exact: true }).click();
    await expect(page.getByRole('tab', { name: '#dreams', exact: true })).toHaveCount(0);
    await expect.poll(() => received.some(line => line.startsWith('PART #dreams'))).toBe(true);
    await page.getByRole('button', { name: 'Entrar en una sala', exact: true }).click();
    await page.locator('#join-channel').fill('#dreams'); await page.locator('#join-form button[type=submit]').click();
    await expect(page.locator('.message-text')).toHaveText('Desktop IPC works');
    const dataPath = await app.evaluate(({ app }) => app.getPath('userData'));
    // Ensure all queued preference writes have reached the actual main process.
    await expect.poll(() => JSON.parse(fs.readFileSync(path.join(dataPath, 'settings.json'))).settings.sidebarWidth).toBe(420);
    await app.close(); app = null;

    app = await electron.launch({ args, env }); page = await app.firstWindow();
    await expect(page.locator('.sidebar')).toHaveCSS('width', '420px');
    await expect(page.locator('#users-panel')).toBeHidden();
    await expect(page.locator('#connection-button')).toHaveText('Conectar');
    await page.locator('#connection-button').click();
    await expect(page.locator('.message-text')).toHaveText('Desktop IPC works');
    // A second launch must exit and restore the existing application window.
    const child = spawn(require('electron'), args, { cwd: path.resolve(__dirname, '..'), env, stdio: 'ignore' });
    const timer = setTimeout(() => child.kill(), 10000);
    const [code] = await once(child, 'exit'); clearTimeout(timer);
    expect(code).toBe(0); expect(await app.windows()).toHaveLength(1);
    await app.close(); app = null;

    fs.writeFileSync(path.join(dataPath, 'settings.json'), '{broken-settings');
    app = await electron.launch({ args, env }); page = await app.firstWindow();
    await expect(page.locator('#conversation-title')).toHaveText('Bienvenido a Dreams');
    await expect(page.locator('#toast')).toContainText('No se pudo leer la configuración');
    expect(fs.readdirSync(dataPath).some(name => name.startsWith('settings.json.recovery-'))).toBe(true);
    expect(fs.readFileSync(path.join(dataPath, 'startup.log'), 'utf8')).toContain('Inicio 0.1.0');
    expect(rendererErrors).toEqual([]);
    console.log('PASS: Electron startup, real IPC/IRC, messages, users, PART/rejoin, second launch, single instance, settings recovery and startup log.');
  } finally {
    if (app) await app.close(); for (const socket of sockets) socket.destroy(); server.close(); fs.rmSync(root, { recursive: true, force: true });
  }
}
run().catch(e => { console.error(e); process.exitCode = 1; });
