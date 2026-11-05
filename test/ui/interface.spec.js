const { test, expect } = require('@playwright/test');
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    let listener;
    const defaults = { fontSize: 14, sidebarWidth: 240, showUsers: true, timestamps: true, showEvents: true, compact: false, autoScroll: true };
    const emit = event => listener?.(event);
    window.__emit = emit;
    window.dreams = {
      load: async () => ({ ...(JSON.parse(localStorage.getItem('dreams-test')) || { settings: defaults, profiles: [] }), version: '0.1.0', warnings: [] }),
      save: async data => { localStorage.setItem('dreams-test', JSON.stringify(data)); return data; },
      onEvent: cb => { listener = cb; }, logs: async () => ({ ok: true }), quit: async () => {},
      connect: async ({ id }) => {
        const p = JSON.parse(localStorage.getItem('dreams-test')).profiles.find(p => p.id === id);
        emit({ id, type: 'status', state: 'connected', text: 'Conectado', nick: p.nick });
        for (const target of p.channels) {
          emit({ id, type: 'channel', target, nick: p.nick, action: 'join', own: true });
          emit({ id, type: 'users', target, users: ['@Luna', '+Atlas', p.nick, 'Nora', 'Sol'] });
          emit({ id, type: 'topic', target, text: 'Un pequeño rincón para grandes conversaciones. Bienvenidos a Dreams ✦' });
        }
        return { ok: true };
      },
      disconnect: async id => { emit({ id, type: 'status', state: 'disconnected', text: 'Desconectado' }); return { ok: true }; },
      send: async ({ id, target, text }) => {
        if (text.startsWith('/join ')) emit({ id, type: 'channel', target: text.slice(6), action: 'join', own: true, nick: 'Dreamer' });
        else if (text === '/part') emit({ id, type: 'channel', target, action: 'part', own: true, nick: 'Dreamer' });
        else emit({ id, type: 'message', target, text, nick: 'Dreamer', own: true, time: new Date().toISOString() });
        return { ok: true };
      }
    };
  });
});
async function addNetwork(page, name = 'Libera Chat', host = 'irc.libera.chat', channels = '#dreams, #general') {
  await page.getByRole('button', { name: 'Añadir red', exact: true }).click();
  await page.locator('#profile-name').fill(name); await page.locator('#profile-host').fill(host);
  await page.locator('#profile-nick').fill('Dreamer'); await page.locator('#profile-channels').fill(channels);
  await page.getByRole('button', { name: 'Guardar y conectar', exact: true }).click();
}
test('Requested desktop layout: tabs, adjustable left sidebar, hideable users, top settings', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4173');
  await expect(page.getByRole('heading', { name: 'La conversación empieza aquí.' })).toBeVisible();
  await addNetwork(page);
  await expect(page.getByRole('tab', { name: '#dreams', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: '#general', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: '@Luna', exact: true })).toBeVisible();
  await page.getByRole('separator', { name: 'Ancho de conversaciones' }).focus();
  await page.keyboard.press('End');
  await expect(page.locator('.sidebar')).toHaveCSS('width', '420px');
  await page.keyboard.press('Home');
  await expect(page.locator('.sidebar')).toHaveCSS('width', '160px');
  const bounds = await page.locator('#sidebar-resizer').boundingBox();
  await page.mouse.move(bounds.x + 2, bounds.y + 80); await page.mouse.down(); await page.mouse.move(270, bounds.y + 80); await page.mouse.up();
  await expect(page.locator('.sidebar')).toHaveCSS('width', '270px');
  await page.getByRole('button', { name: 'Ocultar usuarios', exact: true }).click();
  await expect(page.locator('#users-panel')).toBeHidden();
  await page.keyboard.press('Control+,');
  await expect(page.getByRole('dialog', { name: '' }).filter({ has: page.getByRole('heading', { name: 'Configuración', exact: true }) })).toBeVisible();
  await page.locator('#setting-font').selectOption('18');
  await page.getByRole('button', { name: 'Listo', exact: true }).click();
  await page.reload();
  await expect(page.locator('.sidebar')).toHaveCSS('width', '270px');
  await expect(page.locator('#users-panel')).toBeHidden();
  await expect(page.locator('html')).toHaveCSS('--font-size', '18px');
  expect(errors).toEqual([]);
});
test('Messages, private conversations, unread tabs, room closure and multiple networks', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173'); await addNetwork(page);
  await page.getByRole('tab', { name: '#dreams', exact: true }).click();
  await page.locator('#message-input').fill('Hola desde Dreams'); await page.locator('#message-input').press('Enter');
  await expect(page.locator('.message-text').filter({ hasText: 'Hola desde Dreams' })).toBeVisible();
  await page.evaluate(() => {
    const id = JSON.parse(localStorage.getItem('dreams-test')).profiles[0].id;
    window.__emit({ id, type: 'message', target: '#general', nick: 'Luna', text: '<img src=x onerror=alert(1)>', time: new Date().toISOString() });
  });
  await expect(page.getByRole('tab', { name: '#general', exact: true }).locator('.badge')).toHaveText('1');
  await page.getByRole('tab', { name: '#general', exact: true }).click();
  await expect(page.locator('.message-text')).toHaveText('<img src=x onerror=alert(1)>');
  await expect(page.locator('.message-text img')).toHaveCount(0);
  await page.getByRole('button', { name: '@Luna', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Luna', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.locator('#message-input').fill('Mensaje privado'); await page.locator('#message-input').press('Enter');
  await expect(page.locator('.message-text')).toHaveText('Mensaje privado');
  await addNetwork(page, 'Otra red', 'irc.example.org', '#otra');
  await expect(page.locator('.network-group')).toHaveCount(2);
  await page.getByRole('button', { name: 'Cerrar #otra', exact: true }).click();
  await expect(page.getByRole('tab', { name: '#otra', exact: true })).toHaveCount(0);
  await page.locator('#connection-button').click();
  await expect(page.locator('#connection-button')).toHaveText('Conectar');
});
test('Screenshot of the populated chat and settings; no layout overflow', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173'); await addNetwork(page);
  await page.getByRole('tab', { name: '#dreams', exact: true }).click();
  await page.evaluate(() => {
    const id = JSON.parse(localStorage.getItem('dreams-test')).profiles[0].id;
    for (const [nick, text, own] of [
      ['Luna', '¡Bienvenidos a nuestro nuevo espacio! ✦', false],
      ['Atlas', 'Me gusta tener las salas como pestañas. Mucho más cómodo para seguir las conversaciones.', false],
      ['Dreamer', 'Y la lista de usuarios se puede ocultar cuando necesito más espacio.', true],
      ['Nora', 'Podemos dejar #general para charlar y #dreams para las novedades.', false],
      ['Luna', 'Perfecto. ¿Qué os gustaría construir primero?', false]
    ]) window.__emit({ id, type: 'message', target: '#dreams', nick, text, own, time: new Date().toISOString() });
  });
  await page.screenshot({ path: 'dist/Dreams-chat.png' });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
  await page.getByRole('button', { name: 'Abrir configuración', exact: true }).click();
  await page.screenshot({ path: 'dist/Dreams-configuracion.png' });
  await page.getByRole('button', { name: 'Cerrar configuración', exact: true }).click();
  await page.setViewportSize({ width: 820, height: 560 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
