const { test, expect } = require('@playwright/test');
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const listeners=[];
    const defaults = { fontSize: 14, sidebarWidth: 240, showUsers: true, timestamps: true, showEvents: true, compact: false, autoScroll: true };
    const emit = event => listeners.forEach(cb=>cb(event));
    window.__emit = emit;
    window.dreams = {
      load: async () => ({ ...(JSON.parse(localStorage.getItem('dreams-test')) || { settings: defaults, profiles: [] }), version: '0.2.0', warnings: [] }),
      save: async data => { localStorage.setItem('dreams-test', JSON.stringify(data)); return data; },
      copy: async text => { window.__copied = text; return {ok:true}; }, onEvent: cb => { listeners.push(cb); }, logs: async () => ({ ok: true }), quit: async () => {},
      connect: async ({ id }) => {
        const p = JSON.parse(localStorage.getItem('dreams-test')).profiles.find(p => p.id === id);
        emit({ id, type: 'status', state: 'connected', text: 'Conectado', nick: p.nick, connection:{host:p.host,port:p.port,tls:p.tls} });
        for (const target of p.channels) {
          emit({ id, type: 'channel', target, nick: p.nick, action: 'join', own: true });
          emit({ id, type: 'users', target, users: ['@Luna', '+Atlas', p.nick, 'Nora', 'Sol'] });
          emit({ id, type: 'topic', target, text: 'Un pequeño rincón para grandes conversaciones. Bienvenidos a Dreams ✦' });
        }
        return { ok: true };
      },
      disconnect: async id => { emit({ id, type: 'status', state: 'disconnected', text: 'Desconectado' }); return { ok: true }; },
      send: async ({ id, target, text }) => {
        (window.__sent ||= []).push({id,target,text});
        if (text.startsWith('/join ')) emit({ id, type: 'channel', target: text.slice(6), action: 'join', own: true, nick: 'Dreamer' });
        else if (text === '/part') emit({ id, type: 'channel', target, action: 'part', own: true, nick: 'Dreamer' });
        else emit({ id, type: 'message', target, text, nick: 'Dreamer', own: true, time: new Date().toISOString() });
        return { ok: true };
      }
    };
  });
});
async function addNetwork(page, name = 'Libera Chat', host = 'irc.libera.chat', channels = '#dreams, #general', tls = true) {
  await page.getByRole('button', { name: 'Añadir red', exact: true }).click();
  await page.locator('#profile-name').fill(name); await page.locator('#profile-host').fill(host);
  await page.locator('#profile-nick').fill('Dreamer'); await page.locator('#profile-channels').fill(channels);
  if (!tls) await page.locator('#profile-tls').uncheck();
  await page.getByRole('button', { name: 'Guardar y conectar', exact: true }).click();
}
test('Tree navigation, adjustable left sidebar, hideable users and top settings', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4173');
  await expect(page.getByRole('heading', { name: 'La conversación empieza aquí.' })).toBeVisible();
  await expect(page.locator('#toast')).toBeHidden();
  await addNetwork(page);
  await expect(page.getByRole('button',{name:'Sala #dreams',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Sala #general',exact:true})).toHaveAttribute('aria-current', 'true');
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
test('Messages, private conversations, unread tree nodes, room closure and multiple networks', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173'); await addNetwork(page);
  await page.getByRole('button',{name:'Sala #dreams',exact:true}).click();
  await page.locator('#message-input').fill('Hola desde Dreams'); await page.locator('#message-input').press('Enter');
  await expect(page.locator('.message-text').filter({ hasText: 'Hola desde Dreams' })).toBeVisible();
  await page.evaluate(() => {
    const id = JSON.parse(localStorage.getItem('dreams-test')).profiles[0].id;
    window.__emit({ id, type: 'message', target: '#general', nick: 'Luna', text: '<img src=x onerror=alert(1)>', time: new Date().toISOString() });
  });
  await expect(page.getByRole('button',{name:'Sala #general',exact:true}).locator('.badge')).toHaveText('1');
  await page.getByRole('button',{name:'Sala #general',exact:true}).click();
  await expect(page.locator('.message-text')).toHaveText('<img src=x onerror=alert(1)>');
  await expect(page.locator('.message-text img')).toHaveCount(0);
  await page.getByRole('button', { name: '@Luna', exact: true }).dblclick();
  await expect(page.getByRole('button', { name: 'Privado Luna', exact: true })).toBeVisible();
  await expect(page.getByRole('button',{name:'Privado Luna',exact:true})).toHaveCount(1);
  await page.locator('#message-input').fill('Mensaje privado'); await page.locator('#message-input').press('Enter');
  await expect(page.locator('.message-text')).toHaveText('Mensaje privado');
  await addNetwork(page, 'Otra red', 'irc.example.org', '#otra');
  await expect(page.locator('#network-select option')).toHaveCount(3);
  await page.getByRole('button', { name: 'Cerrar nodo #otra', exact: true }).click();
  await expect(page.getByRole('button',{name:'Sala #otra',exact:true})).toHaveCount(0);
  await page.locator('#connection-button').click();
  await expect(page.locator('#connection-button')).toHaveText('Conectar');
});
test('Screenshot of the populated chat and settings; no layout overflow', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173'); await addNetwork(page);
  await page.getByRole('button',{name:'Sala #dreams',exact:true}).click();
  await page.evaluate(() => {
    const id = JSON.parse(localStorage.getItem('dreams-test')).profiles[0].id;
    for (const [nick, text, own] of [
      ['Luna', '¡Bienvenidos a nuestro nuevo espacio! ✦', false],
      ['Atlas', 'Me gusta tener las salas como pestañas. Mucho más cómodo para seguir las conversaciones.', false],
      ['Dreamer', 'Y la lista de usuarios se puede ocultar cuando necesito más espacio.', true],
      ['Nora', 'Podemos dejar #general para charlar y #dreams para las novedades.', false],
      ['Luna', 'Perfecto. ¿Qué os gustaría construir primero?', false]
    ]) window.__emit({ id, type: 'message', target: '#dreams', nick, text, own, time: new Date().toISOString() });
    window.__emit({id,type:'message',target:'Luna',nick:'Luna',text:'Hola Dreamer, ¿probamos los privados?',time:new Date().toISOString()});
    window.__emit({id,type:'message',target:'Atlas',nick:'Atlas',text:'Te paso las novedades por aquí.',time:new Date().toISOString()});
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
test('Private drafts, channels and conversations with identical names stay isolated across networks', async ({page}) => {
  await page.goto('http://127.0.0.1:4173'); await addNetwork(page);
  await page.locator('#message-input').fill('channel draft');
  await page.getByRole('button',{name:'@Luna',exact:true}).dblclick();
  await page.locator('#message-input').fill('private draft');
  await page.getByRole('button',{name:'Sala #general',exact:true}).click();
  await expect(page.locator('#message-input')).toHaveValue('channel draft');
  await page.getByRole('button',{name:'Privado Luna',exact:true}).click();
  await expect(page.locator('#message-input')).toHaveValue('private draft');
  await expect(page.locator('#private-panel .conversation')).toHaveCount(1);
  await expect(page.getByRole('button',{name:'Privado Luna',exact:true})).toHaveCount(1);
  await addNetwork(page,'Second','irc.example.org','#general');
  await page.getByRole('button',{name:'@Luna',exact:true}).dblclick();
  await expect(page.locator('#message-input')).toHaveValue('');
  await page.locator('#message-input').fill('second network draft');
  const ids = await page.locator('#network-select option').evaluateAll(nodes => nodes.map(n => n.value));
  await page.locator('#network-select').selectOption(ids[0]);
  await expect(page.locator('#message-input')).toHaveValue('private draft');
  await page.keyboard.press('Control+Tab');
  await expect(page.locator('.mdi-active .mdi-title')).toContainText('#dreams');
  await expect(page.locator('#message-input')).toHaveValue('');
  await page.locator('#network-select').selectOption(ids[1]);
  await expect(page.locator('#message-input')).toHaveValue('second network draft');
});
test('Both panel widths, visibility and configuration searches work and survive reopening', async ({page}) => {
  await page.goto('http://127.0.0.1:4173'); await addNetwork(page);
  const divider = await page.locator('#users-resizer').boundingBox();
  await page.mouse.move(divider.x + 2,divider.y + 80); await page.mouse.down(); await page.mouse.move(1020,divider.y + 80); await page.mouse.up();
  await expect(page.locator('#users-panel')).toHaveCSS('width','260px');
  await page.getByText('Ver',{exact:true}).click();await page.getByRole('button',{name:'Mostrar / ocultar panel lateral izquierdo',exact:true}).click();
  await expect(page.locator('#private-panel')).toBeHidden();
  await page.getByRole('button',{name:'Ocultar usuarios',exact:true}).click();
  await expect(page.locator('#users-panel')).toBeHidden();
  await page.reload();
  await expect(page.locator('#private-panel')).toBeHidden(); await expect(page.locator('#users-panel')).toBeHidden();
  await page.getByText('Ver',{exact:true}).click();await page.getByRole('button',{name:'Mostrar / ocultar panel lateral izquierdo',exact:true}).click();await page.locator('#connection-button').click();
  await expect(page.locator('#users-panel')).toHaveCSS('width','260px');
  await page.getByRole('button',{name:'Abrir configuración',exact:true}).click();
  await page.getByRole('textbox',{name:'Buscar opciones de configuración'}).fill('altura');
  await expect(page.locator('#setting-lineHeight')).toBeVisible(); await expect(page.locator('#setting-font')).toBeHidden();
  await page.locator('#setting-lineHeight').fill('1.8'); await page.locator('#setting-lineHeight').dispatchEvent('change');
  await page.getByRole('button',{name:'Listo',exact:true}).click();
  await page.setViewportSize({width:760,height:560});
  await expect.poll(() => page.locator('.timeline').evaluate(n => n.clientWidth)).toBeGreaterThanOrEqual(350);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
test('Channel drag order, keyboard context menus, private silence and closure persist correctly', async ({page}) => {
  await page.goto('http://127.0.0.1:4173'); await addNetwork(page);
  await page.getByRole('button',{name:'Sala #general',exact:true}).dragTo(page.getByRole('button',{name:'Sala #dreams',exact:true}));
  await expect.poll(() => page.locator('#tree-rooms .tree-name').evaluateAll(nodes => nodes.map(n => n.getAttribute('aria-label')))).toEqual(['Sala #general','Sala #dreams']);
  await page.getByRole('button',{name:'@Luna',exact:true}).dblclick();
  await page.getByRole('button',{name:'Privado Luna',exact:true}).click({button:'right'});
  await page.getByRole('menuitem',{name:'Silenciar resaltado de actividad',exact:true}).click();
  await expect(page.locator('.conversation.is-muted')).toHaveCount(1);
  await expect(page.locator('#tree-rooms .tree-name').first()).toHaveAttribute('aria-label','Sala #general');
  await expect(page.locator('.conversation.is-muted')).toHaveCount(1);
  await page.getByRole('button',{name:'Privado Luna',exact:true}).click({button:'right'});
  await page.getByRole('menuitem',{name:'Cerrar privado',exact:true}).click();
  await expect(page.getByRole('button',{name:'Privado Luna',exact:true})).toHaveCount(0);
  expect(await page.evaluate(() => (window.__sent || []).some(m => m.text === '/quit'))).toBe(false);
  await page.getByRole('button',{name:'Sala #general',exact:true}).click({button:'right'}); await page.keyboard.press('Escape');
  await expect(page.locator('#context-menu')).toBeHidden();
  await page.reload();await expect(page.locator('#tree-rooms .tree-name')).toHaveCount(0);await expect(page.locator('.conversation')).toHaveCount(0);
});
test('Message formatting, selection, clipboard, search and user permissions have functional actions', async ({page}) => {
  await page.goto('http://127.0.0.1:4173'); await addNetwork(page);
  await page.evaluate(() => {
    const id=JSON.parse(localStorage.getItem('dreams-test')).profiles[0].id;
    window.__emit({id,type:'message',target:'#general',nick:'Luna',text:'\x02bold\x02 \x0304red\x0f <img src=x onerror=alert(1)>',time:new Date().toISOString()});
    window.__emit({id,type:'message',target:'#general',nick:'Atlas',text:'second message',time:new Date().toISOString()});
  });
  await expect(page.locator('.message-text').first()).toContainText('bold red <img');
  await expect(page.locator('.message-text img')).toHaveCount(0);
  await expect(page.locator('.message-text').first().locator('span').filter({hasText:/^bold$/})).toHaveCSS('font-weight','700');
  await page.locator('.message').first().click({modifiers:['Control']});
  await page.locator('.message').last().click({modifiers:['Control']});
  await page.locator('.message').first().click({button:'right'});
  await page.getByRole('menuitem',{name:'Copiar mensajes seleccionados',exact:true}).click();
  await expect.poll(() => page.evaluate(() => window.__copied)).toContain('second message');
  await page.keyboard.press('Control+f'); await page.locator('#message-search').fill('second');
  await expect(page.locator('.message-text')).toHaveCount(1);
  await page.getByRole('button',{name:'Cerrar búsqueda de mensajes',exact:true}).click();
  await page.getByRole('textbox',{name:'Buscar usuarios',exact:true}).fill('Luna');
  await expect(page.locator('.user-button')).toHaveCount(1);
  await page.getByRole('button',{name:'@Luna',exact:true}).click({button:'right'});
  await expect(page.getByRole('menuitem',{name:'Dar operador',exact:true})).toBeDisabled();
  await page.getByRole('menuitem',{name:'WHOIS',exact:true}).click();
  await expect.poll(() => page.evaluate(() => window.__sent.at(-1).text)).toBe('/whois Luna');
});
test('Message bursts are bounded and do not lose the reading position or first unread marker', async ({page}) => {
  const errors=[]; page.on('pageerror',error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4173'); await addNetwork(page);
  await page.evaluate(() => {
    const id=JSON.parse(localStorage.getItem('dreams-test')).profiles[0].id;
    for(let i=0;i<900;i++) window.__emit({id,type:'message',target:'#general',nick:'Luna',text:'burst '+i,time:new Date().toISOString()});
  });
  await expect(page.locator('.message')).toHaveCount(600);
  await page.locator('#messages').evaluate(node => {node.scrollTop=100;node.dispatchEvent(new Event('scroll'));});
  const before=await page.locator('#messages').evaluate(node => node.scrollTop);
  await page.evaluate(() => {
    const id=JSON.parse(localStorage.getItem('dreams-test')).profiles[0].id;
    window.__emit({id,type:'message',target:'#general',nick:'Luna',text:'Dreamer: new unread',time:new Date().toISOString()});
  });
  await expect(page.getByRole('button',{name:'Primer mensaje sin leer',exact:true})).toBeEnabled();
  expect(await page.locator('#messages').evaluate(node => node.scrollTop)).toBeLessThan(before+200);
  await page.getByRole('button',{name:'Primer mensaje sin leer',exact:true}).click();
  await expect(page.locator('.focus-message')).toContainText('new unread');
  await page.getByRole('button',{name:'↓ Último mensaje',exact:true}).click();
  await expect(page.getByRole('button',{name:'Primer mensaje sin leer',exact:true})).toBeDisabled();
  expect(errors).toEqual([]);
});
test('Editing a profile never misrepresents the security of its existing connection', async ({page}) => {
  await page.goto('http://127.0.0.1:4173'); await addNetwork(page,'Plain','irc.example.org','#room',false);
  await expect(page.locator('#transport-label')).toContainText('sin cifrar');
  await page.getByRole('button',{name:'Abrir configuración',exact:true}).click();
  await page.locator('[data-section="networks"]').click();
  await page.locator('.profile-actions').getByRole('button',{name:'Editar',exact:true}).click();
  await page.locator('#profile-tls').check(); await page.locator('#profile-host').fill('another.example.org');
  await page.getByRole('button',{name:'Guardar',exact:true}).click();
  await page.getByRole('button',{name:'Listo',exact:true}).click();
  await expect(page.locator('#transport-label')).toContainText('sin cifrar');
  await expect(page.locator('#conversation-title')).toHaveText('#room');
  await page.locator('#server-button').click();
  await expect(page.locator('#conversation-subtitle')).toContainText('irc.example.org:6667');
});

test('Network identity and slash post-connect commands stay independent per profile',async({page})=>{
 await page.goto('http://127.0.0.1:4173');await addNetwork(page,'Primera');
 await page.getByRole('button',{name:'Abrir configuración',exact:true}).click();await page.locator('[data-section=networks]').click();await page.locator('#profile-list').getByRole('button',{name:'Editar',exact:true}).click();
 await page.locator('#profile-username').fill('ident_primera');await page.locator('#profile-realName').fill('Nombre Primera');await page.locator('#profile-commands').fill('/nick Primera\n/identify primera');await page.locator('#network-form').getByRole('button',{name:'Guardar',exact:true}).click();await page.locator('#settings-dialog .dialog-header [data-close]').click();
 await addNetwork(page,'Segunda');await page.getByRole('button',{name:'Abrir configuración',exact:true}).click();await page.locator('[data-section=networks]').click();await page.locator('#profile-list .profile-card').nth(1).getByRole('button',{name:'Editar',exact:true}).click();
 await expect(page.locator('#profile-username')).not.toHaveValue('ident_primera');await page.locator('#profile-username').fill('ident_segunda');await page.locator('#profile-realName').fill('Nombre Segunda');await page.locator('#network-form').getByRole('button',{name:'Guardar',exact:true}).click();
 await page.locator('#profile-list .profile-card').first().getByRole('button',{name:'Editar',exact:true}).click();await expect(page.locator('#profile-username')).toHaveValue('ident_primera');await expect(page.locator('#profile-realName')).toHaveText('Nombre Primera');await expect(page.locator('#profile-commands')).toHaveValue('/nick Primera\n/identify primera');
 const overflow=await page.locator('#network-dialog .form-content').evaluate(n=>n.scrollWidth>n.clientWidth);expect(overflow).toBe(false);
});
test('Topic renders IRC formatting and emoji picker inserts at the cursor',async({page})=>{
 await page.goto('http://127.0.0.1:4173');await addNetwork(page);
 await page.evaluate(()=>{const id=JSON.parse(localStorage.getItem('dreams-test')).profiles[0].id;window.__emit({id,type:'topic',target:'#general',text:'\x02\x0313Bienvenidos\x0f al canal \x0304,01Chat 🦆\x0f'});});
 await expect(page.locator('#conversation-subtitle')).toHaveText('Bienvenidos al canal Chat 🦆');
 await expect(page.locator('#conversation-subtitle span').filter({hasText:/^Bienvenidos$/})).toHaveCSS('color','rgb(255, 0, 255)');
 await expect(page.locator('#conversation-subtitle span').filter({hasText:/^Bienvenidos$/})).toHaveCSS('font-weight','700');
 await page.locator('#message-input').fill('Hola ');await page.locator('#message-input').press('End');
 await page.getByLabel('Estilos de escritura',{exact:true}).click();await page.getByRole('button',{name:'Abrir emojis',exact:true}).click();await page.getByRole('button',{name:'Insertar 🦆',exact:true}).click();
 await expect(page.locator('#message-input')).toHaveValue('Hola 🦆');
});
test('Identity editor has alternate nick, formatted real name and readable light-theme controls',async({page})=>{
 await page.goto('http://127.0.0.1:4173');await addNetwork(page);
 await page.evaluate(()=>{config.settings.theme='light';applySettings();});
 await page.getByRole('button',{name:'Abrir configuración',exact:true}).click();await page.locator('[data-section=networks]').click();await page.locator('#profile-list').getByRole('button',{name:'Editar',exact:true}).click();
 await page.locator('#profile-alternateNick').fill('Dreamer2');await page.locator('#profile-realName').fill('Nombre con estilo');await page.locator('#profile-realName').selectText();
 await page.locator('#realname-tools').getByRole('button',{name:'Negrita',exact:true}).click();
 await expect(page.locator('#realname-preview span')).toHaveCSS('font-weight','700');
 await expect(page.locator('#profile-photoUrl')).toHaveValue('https://chat-avatars.chateagratis.net/avatar/Chat/{Nick}.png');
 await expect(page.locator('#profile-host')).toHaveCSS('color','rgb(29, 41, 60)');await expect(page.locator('#profile-host')).toHaveCSS('background-color','rgb(245, 246, 250)');
 await page.screenshot({path:'dist/Dreams-identidad-claro.png'});
 await page.locator('#network-form').getByRole('button',{name:'Guardar',exact:true}).click();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('dreams-test')).profiles[0].alternateNick)).toBe('Dreamer2');
});
test('Topic can be hidden, resized upward and restored after reloading',async({page})=>{
 await page.goto('http://127.0.0.1:4173');await addNetwork(page);
 await page.evaluate(()=>{const id=JSON.parse(localStorage.getItem('dreams-test')).profiles[0].id;window.__emit({id,type:'topic',target:'#general',text:Array(12).fill('Un tema largo con varias líneas').join('\n')});});
 const before=await page.locator('#messages').evaluate(n=>n.clientHeight);await page.getByRole('button',{name:'Ocultar topic',exact:true}).click();await expect(page.locator('#conversation-subtitle')).toBeHidden();expect(await page.locator('#messages').evaluate(n=>n.clientHeight)).toBeGreaterThan(before);
 await page.reload();await expect(page.locator('#conversation-subtitle')).toBeHidden();await page.getByRole('button',{name:'Mostrar topic',exact:true}).click();
 await page.locator('#connection-button').click();await page.evaluate(()=>{const id=JSON.parse(localStorage.getItem('dreams-test')).profiles[0].id;window.__emit({id,type:'topic',target:'#general',text:'Topic recibido al reconectar'});});
 const separator=page.getByRole('separator',{name:'Altura del topic',exact:true});await separator.focus();await page.keyboard.press('End');
 const bounds=await separator.boundingBox(),top=await page.locator('#conversation-subtitle').evaluate(n=>n.getBoundingClientRect().top);
 await page.mouse.move(bounds.x+40,bounds.y+2);await page.mouse.down();await page.mouse.move(bounds.x+40,top+60);await page.mouse.up();await expect(page.locator('#conversation-subtitle')).toHaveCSS('height','60px');
 await page.reload();await page.locator('#connection-button').click();await page.evaluate(()=>{const id=JSON.parse(localStorage.getItem('dreams-test')).profiles[0].id;window.__emit({id,type:'topic',target:'#general',text:'Topic recibido al reconectar'});});await expect(page.locator('#conversation-subtitle')).toHaveCSS('height','60px');
});
test('Notify lists are saved independently for each network',async({page})=>{
 await page.goto('http://127.0.0.1:4173');await addNetwork(page,'Primera');await page.getByRole('button',{name:'Notify: usuarios en línea',exact:true}).click();await page.getByRole('textbox',{name:'Nick para Notify',exact:true}).fill('Alice');await page.locator('#notify-dialog').getByRole('button',{name:'Añadir',exact:true}).click();await expect(page.locator('#notify-list')).toContainText('Alice');await page.getByRole('button',{name:'Cerrar Notify',exact:true}).click();
 await addNetwork(page,'Segunda');await page.getByRole('button',{name:'Notify: usuarios en línea',exact:true}).click();await expect(page.locator('#notify-list')).not.toContainText('Alice');await page.getByRole('button',{name:'Cerrar Notify',exact:true}).click();
 const ids=await page.locator('#network-select option').evaluateAll(nodes=>nodes.map(n=>n.value));await page.locator('#network-select').selectOption(ids[0]);await page.getByRole('button',{name:'Notify: usuarios en línea',exact:true}).click();await expect(page.locator('#notify-list')).toContainText('Alice');
});
test('Compact toolbar and alphabetic Explorer tree replace the old private panel',async({page})=>{
 await page.goto('http://127.0.0.1:4173');await addNetwork(page);await page.evaluate(()=>{const id=JSON.parse(localStorage.getItem('dreams-test')).profiles[0].id;for(const nick of ['Zeta','Alpha'])window.__emit({id,type:'message',target:nick,nick,text:'Hola '+nick});window.__emit({id,type:'modes',target:'#general',text:'+nt'});});
 await expect.poll(()=>page.locator('#tree-rooms .tree-name').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label')))).toEqual(['Sala #dreams','Sala #general']);
 expect(await page.locator('.chat-heading').evaluate(n=>n.getBoundingClientRect().height)).toBeLessThanOrEqual(28);
 for(const id of ['connection-button','join-button','notify-button','topic-toggle'])expect(await page.locator('#'+id).evaluate(n=>!!n.closest('.menubar'))).toBe(true);
 await expect(page.locator('.mdi-active .mdi-title')).toContainText('#general +nt');
 await page.getByRole('button',{name:'Privado Alpha',exact:true}).click();await expect(page.getByRole('button',{name:'Privado Alpha',exact:true})).toHaveAttribute('aria-current','true');
 await page.locator('#tree-privates>summary').click();await expect(page.getByRole('button',{name:'Privado Alpha',exact:true})).toBeHidden();await expect(page.getByRole('tab')).toHaveCount(0);await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('dreams-test')).settings.treePrivatesOpen)).toBe(false);await page.reload();await expect(page.locator('#tree-privates')).not.toHaveAttribute('open','');
});
test('Channel event arrows, optional masks and nickname actions never add photo thumbnails',async({page})=>{
 await page.goto('http://127.0.0.1:4173');await addNetwork(page);await page.evaluate(()=>{const id=JSON.parse(localStorage.getItem('dreams-test')).profiles[0].id;for(const action of ['join','part','quit'])window.__emit({id,type:'channel',target:'#general',nick:'Visitante',ident:'ident',host:'host.example',action});});
 await expect(page.locator('.event-join').last().locator('.event-arrow')).toHaveText('→');await expect(page.locator('.event-part .event-arrow')).toHaveText('←');await expect(page.locator('.event-quit .event-arrow')).toHaveText('←');await expect(page.locator('.channel-event img')).toHaveCount(0);await expect(page.locator('.event-mask')).toHaveCount(0);
 await page.getByRole('button',{name:'Abrir configuración',exact:true}).click();await page.locator('[data-section=layout]').click();await page.locator('#setting-eventShowHost').check();await page.getByRole('button',{name:'Listo',exact:true}).click();await expect(page.locator('.event-part')).toContainText('ident@host.example');
 await page.locator('.event-part').getByRole('button',{name:'Perfil de Visitante',exact:true}).click();await expect(page.locator('#user-profile')).toBeVisible();
});
test('Appearance preview precedes a three-column grid and uses visible color swatches',async({page})=>{
 await page.goto('http://127.0.0.1:4173');await addNetwork(page);await page.getByRole('button',{name:'Apariencia de sala',exact:true}).click();
 const preview=await page.locator('.room-live-preview').boundingBox(),first=await page.getByLabel('Fondo de sala',{exact:true}).boundingBox(),second=await page.getByLabel('Fondo del cuadro de texto',{exact:true}).boundingBox(),third=await page.getByLabel('Color del texto',{exact:true}).boundingBox();expect(preview.y+preview.height).toBeLessThan(first.y);expect(first.y).toBe(second.y);expect(second.y).toBe(third.y);expect(first.height).toBeGreaterThanOrEqual(30);
 await page.getByLabel('Color del propio nick',{exact:true}).fill('#12ab34');await page.screenshot({path:'dist/Dreams-apariencia-compacta.png'});await page.getByRole('button',{name:'Guardar apariencia',exact:true}).click();await page.reload();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('dreams-test')).settings.ownNickColor)).toBe('#12ab34');
});
test('Commands menu groups commands and enables room and IRC operators from actual state',async({page})=>{
 await page.goto('http://127.0.0.1:4173');await addNetwork(page);await page.locator('#commands-menu>summary').click();await page.locator('#commands-menu').getByText('Operador de sala (@)',{exact:true}).click();const op=page.getByRole('menuitem',{name:'Operador de sala (@): /op · Dar operador',exact:true});await expect(op).toBeDisabled();
 await page.evaluate(()=>{const id=JSON.parse(localStorage.getItem('dreams-test')).profiles[0].id;window.__emit({id,type:'users',target:'#general',users:['@Dreamer','Luna']});});await expect(op).toBeEnabled();await op.click();await expect(page.locator('#message-input')).toHaveValue('/op ');expect(await page.evaluate(()=>window.__sent||[])).toEqual([]);
 await page.locator('#commands-menu>summary').click();await page.locator('#commands-menu').getByText('Operador de red (IRC oper)',{exact:true}).click();const kill=page.getByRole('menuitem',{name:'Operador de red (IRC oper): /kill · Desconectar usuario',exact:true});await expect(kill).toBeDisabled();await page.evaluate(()=>{const id=JSON.parse(localStorage.getItem('dreams-test')).profiles[0].id;window.__emit({id,type:'oper-state',oper:true});});await expect(kill).toBeEnabled();
});
test('A single tree click survives messages arriving between pointer down and pointer up',async({page})=>{
 await page.goto('http://127.0.0.1:4173');await addNetwork(page);
 await page.evaluate(()=>{const id=JSON.parse(localStorage.getItem('dreams-test')).profiles[0].id;window.__emit({id,type:'message',target:'Alice',nick:'Alice',text:'privado'});});
 for(const name of ['Sala #dreams','Privado Alice','Sala #general']){
  const button=page.getByRole('button',{name,exact:true}),box=await button.boundingBox();
  await button.evaluate(n=>window.__clickedNode=n);await page.mouse.move(box.x+30,box.y+box.height/2);await page.mouse.down();
  await page.evaluate(()=>{const id=JSON.parse(localStorage.getItem('dreams-test')).profiles[0].id;for(let i=0;i<15;i++)window.__emit({id,type:'message',target:'#general',nick:'Visitor',text:'llegando '+i});});
  await page.waitForTimeout(60);expect(await button.evaluate(n=>n===window.__clickedNode)).toBe(true);await page.mouse.up();
  await expect(button).toHaveAttribute('aria-current','true');
 }
 await expect(page.locator('#room-tabs')).toBeHidden();await expect(page.getByRole('tab')).toHaveCount(0);
});
test('Composer uses one compact styled editor and typing preference survives reload',async({page})=>{
 await page.goto('http://127.0.0.1:4173');await addNetwork(page);
 await page.getByLabel('Estilos de escritura',{exact:true}).click();await page.getByRole('button',{name:'Negrita',exact:true}).click();
 await page.getByLabel('Enviar «Estoy escribiendo»',{exact:true}).uncheck();
 await page.locator('#message-input').fill('Texto sin duplicar');await expect(page.locator('#format-preview')).toBeHidden();
 await expect(page.locator('#message-input')).toHaveCSS('font-weight','700');await expect(page.locator('#message-input')).toHaveCSS('font-size','14px');
 expect((await page.locator('#composer').boundingBox()).height).toBeLessThan(65);
 await page.reload();await page.getByLabel('Estilos de escritura',{exact:true}).click();await expect(page.getByLabel('Enviar «Estoy escribiendo»',{exact:true})).not.toBeChecked();
});
test('Private selection opens the interlocutor profile, and empty topics consume no panel space',async({page})=>{
 await page.goto('http://127.0.0.1:4173');await addNetwork(page);
 await page.getByRole('button',{name:'@Luna',exact:true}).dblclick();await expect(page.locator('#user-profile')).toBeVisible();await expect(page.locator('#user-profile h3')).toHaveText('Luna');await expect(page.locator('#topic-panel')).toBeHidden();
 await page.getByRole('button',{name:'Sala #general',exact:true}).click();await expect(page.locator('#user-profile')).toBeHidden();
 await page.evaluate(()=>{const id=JSON.parse(localStorage.getItem('dreams-test')).profiles[0].id;window.__emit({id,type:'topic',target:'#general',text:''});});await expect(page.locator('#topic-panel')).toBeHidden();await expect(page.locator('#topic-height-resizer')).toBeHidden();
});
test('Light room backgrounds stay readable inside a dark application, including IRC colors and event nicks',async({page})=>{
 await page.goto('http://127.0.0.1:4173');await addNetwork(page);
 await page.evaluate(()=>{config.settings.roomAppearance={background:'#ffffff',text:'#e4e8f1',inputBackground:'#ffffff'};applySettings();const id=config.profiles[0].id;window.__emit({id,type:'message',target:'#general',nick:'Luna',text:'\x0300Texto blanco sobre blanco\x0f'});window.__emit({id,type:'channel',target:'#general',nick:'Visitante',action:'join'});});
 await expect(page.locator('.message-text')).toContainText('Texto blanco sobre blanco');
 const result=await page.evaluate(()=>{const bg=getComputedStyle(document.getElementById('messages')).backgroundColor;return [...document.querySelectorAll('.message-text span,.event-nick,.message-header .message-nick')].map(n=>DreamsFormatting.contrast(getComputedStyle(n).color,bg));});
 expect(result.length).toBeGreaterThan(2);for(const contrast of result)expect(contrast).toBeGreaterThanOrEqual(4.5);
 await page.screenshot({path:'dist/Dreams-contraste-claro.png'});
});
test('Network picker offers Add network without changing the selected conversation',async({page})=>{
 await page.goto('http://127.0.0.1:4173');await addNetwork(page);await page.locator('#network-select').selectOption('__add_network__');await expect(page.locator('#network-dialog')).toBeVisible();await expect(page.locator('#profile-name')).toHaveValue('');await expect(page.locator('#conversation-title')).toHaveText('#general');
});
test('WHOIS query opens a compact floating profile and also keeps the query conversation',async({page})=>{
 await page.goto('http://127.0.0.1:4173');await addNetwork(page);await page.evaluate(()=>{const id=config.profiles[0].id;window.__emit({id,type:'query',target:'*consultas*',whois:'Alice'});window.__emit({id,type:'server',target:'*consultas*',text:'Alice WHOIS recibido'});});
 await expect(page.locator('#whois-profile-dialog')).toBeVisible();await expect(page.locator('#whois-profile-dialog .user-profile h3')).toHaveText('Alice');
 const buttons=await page.locator('#whois-profile-dialog .profile-action-buttons button').evaluateAll(nodes=>nodes.map(n=>({x:n.getBoundingClientRect().x,y:n.getBoundingClientRect().y,width:n.getBoundingClientRect().width})));expect(buttons.length).toBe(6);expect(buttons[1].y).toBe(buttons[0].y);expect(buttons[1].x).toBeGreaterThan(buttons[0].x);
 await page.locator('#whois-profile-dialog .dialog-header').getByRole('button',{name:'Cerrar',exact:true}).click();await page.getByRole('button',{name:'Consulta *consultas*',exact:true}).click();await expect(page.locator('#messages')).toContainText('Alice WHOIS recibido');
});
test('Purple navy theme and a named style survive saving, switching and reopening',async({page})=>{
 await page.goto('http://127.0.0.1:4173');await addNetwork(page);await page.getByRole('button',{name:'Abrir configuración',exact:true}).click();await page.locator('[data-section=appearance]').click();
 await page.getByRole('combobox',{name:'Tema',exact:true}).selectOption('violet');await page.getByRole('button',{name:'Aplicar',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','violet');
 await page.locator('#setting-font').selectOption('18');await page.getByRole('textbox',{name:'Nombre del tema',exact:true}).fill('Mi morado');await page.getByRole('button',{name:'Guardar',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('dreams-test')).settings.savedThemes?.length)).toBe(1);
 const id=await page.evaluate(()=>JSON.parse(localStorage.getItem('dreams-test')).settings.savedThemes[0].id);
 await page.getByRole('combobox',{name:'Tema',exact:true}).selectOption('light');await page.getByRole('button',{name:'Aplicar',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await page.reload();await page.getByRole('button',{name:'Abrir configuración',exact:true}).click();await page.locator('[data-section=appearance]').click();await page.getByRole('combobox',{name:'Tema',exact:true}).selectOption(id);await page.getByRole('button',{name:'Aplicar',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','violet');await expect(page.locator('html')).toHaveCSS('--font-size','18px');
 await page.getByRole('button',{name:'Listo',exact:true}).click();await page.screenshot({path:'dist/HexDreams-morado.png'});
});
test('Opening a colored real name preserves its IRC color rather than saving a contrast-adjusted replacement',async({page})=>{
 await page.goto('http://127.0.0.1:4173');await addNetwork(page);await page.getByRole('button',{name:'Abrir configuración',exact:true}).click();await page.locator('[data-section=networks]').click();await page.locator('#profile-list').getByRole('button',{name:'Editar',exact:true}).click();
 const result=await page.evaluate(()=>{const editor=document.getElementById('profile-realName');editor.value='\x0302Azul original\x0f';return editor.value;});expect(result).toBe('\x0302Azul original\x0f');
});
test('Room events can be separated, resized and restored without removing user messages or event history',async({page})=>{
 await page.goto('http://127.0.0.1:4173');await addNetwork(page);
 await page.evaluate(()=>{const id=config.profiles[0].id;window.__emit({id,type:'message',target:'#general',nick:'Luna',text:'Mensaje normal'});window.__emit({id,type:'nick',old:'Luna',nick:'Lunita',targets:['#general']});window.__emit({id,type:'clones',target:'#general',nicks:['Uno','Dos'],host:'shared.example'});});
 await expect(page.locator('#messages .event-nick-change')).toContainText('Luna → Lunita');await expect(page.locator('#messages .event-clones')).toContainText('Uno, Dos');
 const red=await page.locator('#messages .event-nick-change').evaluate(n=>getComputedStyle(n).color);const rgb=red.match(/\d+/g).map(Number);expect(rgb[0]).toBeGreaterThan(rgb[1]);expect(rgb[0]).toBeGreaterThan(rgb[2]);
 await page.getByRole('combobox',{name:'Vista de sala',exact:true}).selectOption('split');await expect(page.locator('#messages .message-text')).toHaveText('Mensaje normal');await expect(page.locator('#messages .event-nick-change')).toHaveCount(0);await expect(page.locator('#channel-events .event-nick-change')).toContainText('Luna → Lunita');await expect(page.locator('#channel-events .event-clones')).toContainText('Uno, Dos');
 await page.screenshot({path:'dist/HexDreams-sala-dividida.png'});
 const divider=page.getByRole('separator',{name:'Altura de eventos de sala',exact:true});await divider.focus();await page.keyboard.press('End');await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('dreams-test')).settings.eventsPanePercent)).toBe(65);
 const handle=await divider.boundingBox(),area=await page.locator('#conversation-panes').boundingBox();await page.mouse.move(handle.x+40,handle.y+2);await page.mouse.down();await page.mouse.move(handle.x+40,area.y+area.height*.7);await page.mouse.up();await expect.poll(()=>page.evaluate(()=>Math.round(JSON.parse(localStorage.getItem('dreams-test')).settings.eventsPanePercent))).toBe(30);
 await page.getByRole('combobox',{name:'Vista de sala',exact:true}).selectOption('unified');await expect(page.locator('#channel-events-pane')).toBeHidden();await expect(page.locator('#messages .event-nick-change')).toBeVisible();await expect(page.locator('#messages .message-text')).toHaveText('Mensaje normal');
 await page.getByRole('combobox',{name:'Vista de sala',exact:true}).selectOption('split');await page.reload();await page.locator('#connection-button').click();await expect(page.locator('#channel-events-pane')).toBeVisible();await expect(page.getByRole('combobox',{name:'Vista de sala',exact:true})).toHaveValue('split');
});
test('Mention highlight has its own color and can be disabled without suppressing the message',async({page})=>{
 await page.goto('http://127.0.0.1:4173');await addNetwork(page);await page.evaluate(()=>window.__emit({id:config.profiles[0].id,type:'message',target:'#general',nick:'Alice',text:'Dreamer: hola'}));await expect(page.locator('.message.mention')).toContainText('Dreamer: hola');
 await page.getByRole('button',{name:'Abrir configuración',exact:true}).click();await page.locator('[data-section=chat]').click();await page.getByLabel('Color del resaltado de menciones',{exact:true}).fill('#2255aa');await page.getByRole('button',{name:'Listo',exact:true}).click();await expect(page.locator('.message.mention')).toHaveCSS('border-left-color','rgb(34, 85, 170)');
 await page.getByRole('button',{name:'Abrir configuración',exact:true}).click();await page.locator('[data-section=chat]').click();await page.getByLabel('Resaltar mensajes que mencionen mi nick',{exact:true}).uncheck();await page.getByRole('button',{name:'Listo',exact:true}).click();await expect(page.locator('.message.mention')).toHaveCount(0);await expect(page.locator('.message-text')).toHaveText('Dreamer: hola');
});
test('Notify is alphabetical, has its own add button, and the internal logo stays inside the bar',async({page})=>{
 await page.goto('http://127.0.0.1:4173');await addNetwork(page);await page.evaluate(()=>{config.profiles[0].notifyNicks=['Zeta','alice','Bob'];});
 await page.getByRole('button',{name:'Agregar usuario a Notify',exact:true}).click();await expect(page.getByRole('textbox',{name:'Nick para Notify',exact:true})).toBeFocused();expect(await page.locator('#notify-list .notify-row>.notify-profile-name').allTextContents()).toEqual(['alice','Bob','Zeta']);await page.getByRole('button',{name:'Cerrar Notify',exact:true}).click();
 await expect(page.locator('.connections-sidebar-title')).toContainText('Conexiones');await expect(page.locator('.connections-sidebar-title').getByRole('button',{name:'Añadir red',exact:true})).toBeVisible();
 const bar=await page.locator('.menubar').boundingBox(),logo=await page.locator('.brand-logo').boundingBox();expect(logo.y).toBeGreaterThanOrEqual(bar.y);expect(logo.y+logo.height).toBeLessThanOrEqual(bar.y+bar.height);expect(logo.height).toBeLessThanOrEqual(22);
});
test('One connected nickname is displayed once when two saved Notify entries follow it',async({page})=>{
 await page.goto('http://127.0.0.1:4173');await addNetwork(page);await page.evaluate(()=>{window.getDreamsNotify=()=>[{nick:'Alice',currentNick:'Bob',online:true},{nick:'Bob',online:true}];window.renderDreamsNotify();});await expect(page.locator('#sidebar-notify-list .notify-online-row')).toHaveCount(1);await expect(page.locator('#sidebar-notify-list')).toHaveText('●Bob');
});
test('Message thumbnails remain visible in compact mode, independent of user-list photos, and can be disabled',async({page})=>{
 await page.goto('http://127.0.0.1:4173');await addNetwork(page);
 await page.evaluate(()=>{const id=config.profiles[0].id,n=network(id);config.settings.compact=true;config.settings.mediaEnabled=true;config.settings.showAvatars=false;config.settings.showMessageAvatars=true;n.avatars={alice:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='};n.avatarRevision=(n.avatarRevision||0)+1;window.__emit({id,type:'message',target:'#general',nick:'Alice',text:'Con miniatura'});applySettings();render();});
 await expect(page.locator('#messages .message>.avatar img')).toBeVisible();await expect(page.locator('.user-avatar img')).toHaveCount(0);
 await page.evaluate(()=>{config.settings.showMessageAvatars=false;applySettings();render();});await expect(page.locator('#messages .message>.avatar')).toHaveCount(0);await expect(page.locator('.message-text')).toHaveText('Con miniatura');
 await page.evaluate(()=>{config.settings.showMessageAvatars=true;applySettings();render();});await expect(page.locator('#messages .message>.avatar img')).toBeVisible();
});
test('Menus close siblings; room nick opens actions without private chat; explicit WHOIS preserves emojis and joins channels',async({page})=>{
 await page.addInitScript(()=>{window.__whois=[];window.dreams.advanced=async(name,data)=>{if(name==='user.whois')window.__whois.push(data.nick);if(name==='history.search')return[];if(name==='presence.status')return[];if(name==='status')return{secureStorage:false,scripts:[],transfers:[],debug:[]};return{};};});
 await page.goto('http://127.0.0.1:4173');await addNetwork(page);await page.getByText('Archivo',{exact:true}).click();await page.locator('#scripts-menu>summary').click();await expect(page.locator('.menu[open]')).toHaveCount(1);await page.getByText('Ver',{exact:true}).click();await expect(page.locator('.menu[open]')).toHaveCount(1);await page.getByText('Archivo',{exact:true}).click();await page.locator('#favorites-menu>summary').click();await page.locator('#favorites-menu').getByRole('button',{name:'Configuración',exact:true}).click();await page.locator('#favorite-manager-dialog').getByRole('button',{name:'Añadir',exact:true}).click();await page.locator('#favorite-manager-dialog').getByRole('button',{name:'Cerrar',exact:true}).click();await page.getByText('Ver',{exact:true}).click();await page.getByText('Archivo',{exact:true}).click();await page.locator('#favorites-menu>summary').click();await expect(page.locator('#favorites-menu')).toContainText('#general · Libera Chat');await expect(page.locator('#favorites-menu').getByRole('button',{name:/Quitar/})).toHaveCount(0);await page.getByText('Ver',{exact:true}).click();
 await page.evaluate(()=>{const id=config.profiles[0].id;window.__whois=[];window.__emit({id,type:'message',target:'#general',nick:'Luna',text:'Hola'});});await page.locator('#messages .message-nick').click();await expect(page.locator('#user-profile h3')).toHaveText('Luna');await expect(page.getByRole('button',{name:'Privado Luna',exact:true})).toHaveCount(0);await expect(page.locator('#user-profile .user-details')).toHaveCount(0);expect(await page.evaluate(()=>window.__whois)).toEqual([]);
 await page.getByRole('button',{name:'Hacer WHOIS',exact:true}).click();expect(await page.evaluate(()=>window.__whois)).toEqual(['Luna']);await page.evaluate(()=>{const id=config.profiles[0].id;window.__emit({id,type:'user-profile',nick:'Luna',code:'311',params:['ident','host','*','💋🦆'],realName:'💋🦆'});window.__emit({id,type:'user-profile',nick:'Luna',code:'319',params:['@#Dreams +#general']});window.__emit({id,type:'user-profile',nick:'Luna',code:'318',params:[]});});await expect(page.locator('#whois-profile-dialog')).toContainText('💋🦆');await page.locator('#whois-profile-dialog').getByRole('button',{name:'@#Dreams',exact:true}).click();expect(await page.evaluate(()=>window.__sent.at(-1).text)).toBe('/join #Dreams');
});
test('PurpleDreamsLight and a preview-edited custom theme persist with strong or pastel nick colors',async({page})=>{
 await page.goto('http://127.0.0.1:4173');await addNetwork(page);await page.getByRole('button',{name:'Abrir configuración',exact:true}).click();await page.locator('[data-section=appearance]').click();await page.getByRole('combobox',{name:'Tema',exact:true}).selectOption('purple-light');await page.getByRole('button',{name:'Aplicar',exact:true}).click();await page.getByRole('button',{name:'Listo',exact:true}).click();await expect(page.locator('#messages')).toHaveCSS('background-color','rgb(255, 255, 255)');await page.screenshot({path:'dist/HexDreams-PurpleDreamsLight.png'});
 await page.getByRole('button',{name:'Abrir configuración',exact:true}).click();await page.locator('[data-section=appearance]').click();await page.getByRole('button',{name:'Agregar…',exact:true}).click();await page.getByRole('textbox',{name:'Nombre del nuevo tema',exact:true}).fill('Mi tema de prueba');await page.locator('#theme-editor-dialog').getByLabel('Colores de nicks',{exact:true}).selectOption('pastel');await page.locator('#theme-editor-dialog').getByLabel('Fondo de sala',{exact:true}).fill('#f0eaff');await expect(page.locator('.theme-live-preview')).toHaveCSS('background-color','rgb(240, 234, 255)');await page.locator('#theme-editor-dialog').getByRole('button',{name:'Guardar tema',exact:true}).click();await page.reload();await expect(page.locator('#messages')).toHaveCSS('background-color','rgb(240, 234, 255)');expect(await page.evaluate(()=>config.settings.nickPalette)).toBe('pastel');expect(await page.evaluate(()=>config.settings.savedThemes[0].name)).toBe('Mi tema de prueba');
});
test('Compact backups, Notify, notifications and profile buttons align without wasting vertical space',async({page})=>{
 await page.addInitScript(()=>{window.dreams.advanced=async(name)=>{if(name==='notifications.list')return window.__notifications||[];if(['history.search','presence.status','script.list'].includes(name))return[];if(name==='status')return{secureStorage:false,scripts:[],transfers:[],debug:[]};return{};};});
 await page.goto('http://127.0.0.1:4173');await addNetwork(page);await page.evaluate(()=>window.openDreamsBackup('export'));
 const row=page.locator('#selective-backup-dialog label.setting-row').first(),rb=await row.boundingBox(),cb=await row.locator('input').boundingBox();expect(rb.height).toBeLessThan(40);expect(Math.abs((rb.y+rb.height/2)-(cb.y+cb.height/2))).toBeLessThan(3);await page.screenshot({path:'dist/HexDreams-respaldo-compacto.png'});await page.locator('#selective-backup-dialog').getByRole('button',{name:'Cancelar',exact:true}).click();
 await page.evaluate(()=>{config.profiles[0].notifyNicks=['Alice','Bob','Carol'];});await page.locator('#notify-button').click();await expect(page.locator('#notify-list .notify-row')).toHaveCount(3);const notifyRows=await page.locator('#notify-list .notify-row').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().height));expect(Math.max(...notifyRows)).toBeLessThan(38);await page.screenshot({path:'dist/HexDreams-notify-compacto.png'});await page.locator('#notify-dialog .dialog-header button').click();
 await page.evaluate(()=>{const id=config.profiles[0].id;window.__notifications=[{key:'compact',network:id,target:'#general',nick:'Alice',kind:'mention',text:'Dreamer, hola',time:new Date().toISOString()}];window.__emit({id,type:'notification-entry',entry:{key:'compact',network:id,target:'#general',nick:'Alice',kind:'mention',text:'Dreamer, hola',time:new Date().toISOString()}});});await page.locator('#notification-bell').click();await expect(page.locator('.notification-entry')).toHaveCount(1);const box=await page.locator('.notification-entry').boundingBox();expect(box.height).toBeLessThan(55);await page.screenshot({path:'dist/HexDreams-notificaciones-compactas.png'});await page.locator('#notification-dialog').getByRole('button',{name:'Cerrar',exact:true}).click();
 await page.evaluate(()=>window.openDreamsUser(config.profiles[0].id,'Alice'));const buttons=await page.locator('#user-profile .profile-action-buttons button').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return{width:r.width,height:r.height,y:r.y};}));expect(buttons.length).toBe(6);expect(Math.max(...buttons.map(b=>b.width))-Math.min(...buttons.map(b=>b.width))).toBeLessThan(1);expect(Math.max(...buttons.map(b=>b.height))-Math.min(...buttons.map(b=>b.height))).toBeLessThan(1);expect(buttons[0].y).toBe(buttons[1].y);await page.screenshot({path:'dist/HexDreams-botones-perfil.png'});
});
test('Script views refresh in place and notify their owner when closed',async({page})=>{
 await page.addInitScript(()=>{window.__scriptSignals=[];window.dreams.advanced=async(name,data)=>{if(name==='script.signal')window.__scriptSignals.push(data.signal);if(['history.search','notifications.list','presence.status'].includes(name))return[];return{scripts:[],debug:[]};};});await page.goto('http://127.0.0.1:4173');await addNetwork(page);await page.evaluate(()=>{const id=config.profiles[0].id;window.__emit({id,type:'script-ui',subtype:'view',script:'fixture',fields:{network:id,buffer:'#general'},tree:[{type:'text',text:'Original'}]});window.__emit({id,type:'script-ui',subtype:'view',script:'fixture',fields:{network:id,buffer:'#general'},tree:[{type:'text',text:'Actualizado'}]});});await expect(page.locator('dialog.script-view')).toHaveCount(1);await expect(page.locator('dialog.script-view')).toContainText('Actualizado');await page.locator('dialog.script-view').getByRole('button',{name:'Cerrar',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.__scriptSignals)).toContain('view_closed');
});

test('Notify opens user actions; WHO and WHOIS stay in the current conversation; disconnect closes windows',async({page})=>{
 await page.goto('http://127.0.0.1:4173');await addNetwork(page);
 await page.evaluate(()=>{window.getDreamsNotify=()=>[{nick:'Alice',online:true}];window.renderDreamsNotify();});
 await page.getByRole('button',{name:'Notify Alice en línea',exact:true}).click();
 await expect(page.locator('#user-profile')).toContainText('Alice');await expect(page.getByRole('button',{name:'Privado Alice',exact:true})).toHaveCount(0);
 await page.evaluate(()=>{const id=config.profiles[0].id;window.__emit({id,type:'query',target:'*consultas*',kind:'who'});window.__emit({id,type:'message',target:'*consultas*',event:true,text:'Resultado WHO'});});
 await expect(page.getByRole('button',{name:'Sala #general',exact:true})).toHaveAttribute('aria-current','true');await expect(page.locator('#messages')).not.toContainText('Resultado WHO');
 await page.getByRole('button',{name:'Consulta *consultas*',exact:true}).click();await expect(page.locator('#message-input')).toBeFocused();await expect(page.locator('#messages')).toContainText('Resultado WHO');
 await page.locator('#connection-button').click();await expect(page.locator('.mdi-window')).toHaveCount(0);await expect(page.locator('#tree-rooms .tree-name')).toHaveCount(0);await expect(page.locator('#tree-privates .tree-name')).toHaveCount(0);
});
test('Internal chat windows tile, update in background, activate once, move and resize with independent drafts',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4173');await addNetwork(page);
 await page.locator('#message-input').fill('borrador general');await page.getByRole('button',{name:'Sala #dreams',exact:true}).click();await expect(page.locator('#message-input')).toBeFocused();await page.locator('#message-input').fill('borrador dreams');
 await page.evaluate(()=>window.arrangeDreamsWindows('tile'));
 const general=page.locator('.mdi-window[data-target="#general"]'),dreams=page.locator('.mdi-window[data-target="#dreams"]');await expect(general).toBeVisible();await expect(dreams).toBeVisible();
 const a=await general.boundingBox(),b=await dreams.boundingBox();expect(a.x>=b.x+b.width-1||b.x>=a.x+a.width-1||a.y>=b.y+b.height-1||b.y>=a.y+a.height-1).toBe(true);
 await page.evaluate(()=>window.__emit({id:config.profiles[0].id,type:'message',target:'#general',nick:'Nora',text:'mensaje en segundo plano'}));await expect(general.locator('.mdi-text').filter({hasText:'mensaje en segundo plano'})).toBeVisible();
 await general.locator('.mdi-title').click();await expect(general).toHaveClass(/mdi-active/);await expect(page.locator('#message-input')).toBeFocused();await expect(page.locator('#message-input')).toHaveValue('borrador general');
 await page.evaluate(()=>window.arrangeDreamsWindows('cascade'));const before=await general.boundingBox(),bar=await general.locator('.mdi-titlebar').boundingBox();await page.mouse.move(bar.x+60,bar.y+13);await page.mouse.down();await page.mouse.move(bar.x+90,bar.y+43);await page.mouse.up();const moved=await general.boundingBox();expect(moved.x).toBeGreaterThan(before.x);expect(moved.y).toBeGreaterThan(before.y);
 const grip=general.getByRole('separator',{name:'Tamaño de ventana #general',exact:true});await grip.focus();await page.keyboard.press('ArrowLeft');expect((await general.boundingBox()).width).toBeLessThan(moved.width);
 await page.getByRole('button',{name:'Sala #dreams',exact:true}).click();await expect(page.locator('#message-input')).toHaveValue('borrador dreams');await expect(general.locator('.mdi-text').filter({hasText:'mensaje en segundo plano'})).toBeVisible();expect(errors).toEqual([]);await page.screenshot({path:'dist/HexDreams-ventanas-internas.png'});
});
test('Live nick and command suggestions include active scripts; Tab cycles the original prefix in both directions',async({page})=>{
 await page.addInitScript(()=>{window.__commands=[{name:'abrazo',description:'Dar un abrazo',script:'Sociales'}];window.dreams.advanced=async(name)=>name==='script.commands'?window.__commands:{};});
 await page.goto('http://127.0.0.1:4173');await addNetwork(page);await page.evaluate(()=>window.__emit({id:config.profiles[0].id,type:'users',target:'#general',users:['@Alice','+Alberto','Atlas']}));
 const input=page.locator('#message-input'),popup=page.locator('#composer-suggestions');await input.fill('Al');await expect(popup).toContainText('Alice');await expect(popup).toContainText('Alberto');await input.press('Tab');await expect(input).toHaveValue('Alberto ');await input.press('Tab');await expect(input).toHaveValue('Alice ');await input.press('Tab');await expect(input).toHaveValue('Alberto ');await input.press('Shift+Tab');await expect(input).toHaveValue('Alice ');
 await input.fill('/abr');await expect(popup).toContainText('/abrazo');await expect(popup).toContainText('Dar un abrazo');await input.press('ArrowDown');await input.press('Enter');await expect(input).toHaveValue('/abrazo ');expect(await page.evaluate(()=>window.__sent||[])).toHaveLength(0);
 await input.fill('/joi');await expect(popup).toContainText('/join');await input.press('Tab');await expect(input).toHaveValue('/join ');
 await page.evaluate(()=>window.__emit({type:'script-commands',commands:[]}));await input.fill('/abr');await expect(popup).toBeHidden();
 await page.keyboard.press('Control+Shift+Z');
 await page.evaluate(()=>choose(config.profiles[0].id,'Alberto'));await input.fill('Al');await expect(popup).toContainText('Alberto');await input.press('Tab');await expect(input).toHaveValue('Alberto ');
});
test('v15 menus have uniform items, right hand flyouts, hierarchy and stay above chat windows',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4173');await addNetwork(page);
 await page.locator('#commands-menu>summary').click();const user=page.locator('#commands-menu .command-category').first();await user.locator('summary').click();const fly=user.locator('.menu-flyout');await expect(fly).toBeVisible();const a=await user.locator('summary').boundingBox(),b=await fly.boundingBox();expect(b.x).toBeGreaterThanOrEqual(a.x+a.width);expect(Math.abs(b.y-a.y)).toBeLessThan(2);
 const action=fly.getByRole('menuitem').first();const metrics=await user.locator('summary').evaluate(n=>{const s=getComputedStyle(n);return[s.fontSize,s.minHeight,s.paddingTop,s.paddingBottom];});expect(await action.evaluate(n=>{const s=getComputedStyle(n);return[s.fontSize,s.minHeight,s.paddingTop,s.paddingBottom];})).toEqual(metrics);
 const point=await action.boundingBox();expect(await page.evaluate(p=>document.elementFromPoint(p.x+5,p.y+5)?.closest('.menu-flyout')!==null,point)).toBe(true);await page.screenshot({path:'dist/HexDreams-v15-menus.png'});
 await page.getByText('Ver',{exact:true}).click();await expect(fly).toBeHidden();expect(await page.locator('.menu[open]>.menu-popup').evaluate(n=>[...n.children].filter(c=>c.tagName!=='HR').map(c=>c.tagName==='DETAILS'?c.querySelector('summary').textContent:c.textContent.replace(/Ctrl.*/, '').trim()))).toEqual(['Historial','Visor de logs','Ventanas','Mostrar / ocultar panel lateral izquierdo','Mostrar / ocultar panel lateral derecho']);await page.getByText('Archivo',{exact:true}).click();await page.locator('#favorites-menu>summary').click();await expect(page.locator('#favorites-menu .menu-flyout')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('.menu-flyout:popover-open')).toHaveCount(0);expect(errors).toEqual([]);
});
test('v15 user visibility belongs to each chat; Status has no users and can close while disconnected',async({page})=>{
 await page.goto('http://127.0.0.1:4173');await addNetwork(page);await page.getByRole('button',{name:'Ocultar usuarios',exact:true}).click();await expect(page.locator('#users-panel')).toBeHidden();await page.getByRole('button',{name:'Sala #dreams',exact:true}).click();await expect(page.locator('#users-panel')).toBeVisible();await page.getByRole('button',{name:'Sala #general',exact:true}).click();await expect(page.locator('#users-panel')).toBeHidden();
 await page.evaluate(()=>choose(config.profiles[0].id,'Luna'));await expect(page.locator('#user-profile h3')).toHaveText('Luna');await expect(page.locator('#users-panel')).toBeVisible();await page.getByRole('button',{name:'Sala #general',exact:true}).click();await expect(page.locator('#users-panel')).toBeHidden();
 await page.evaluate(()=>choose(config.profiles[0].id,'*'));await expect(page.locator('#users-panel')).toBeHidden();await page.getByRole('button',{name:'Cerrar ventana *',exact:true}).click();await expect(page.locator('.mdi-window[data-target="*"]')).toHaveCount(1);await expect(page.locator('#toast')).toContainText('Desconecta');
 await page.locator('#connection-button').click();await page.evaluate(()=>choose(config.profiles[0].id,'*'));await page.getByRole('button',{name:'Cerrar ventana *',exact:true}).click();await expect(page.locator('.mdi-window')).toHaveCount(0);expect(await page.evaluate(()=>active)).toBeNull();
});
test('v15 settings follow the requested hierarchy and theme operations are consolidated',async({page})=>{
 await page.addInitScript(()=>{window.dreams.advanced=async name=>name==='status'?{scripts:[],transfers:[],debug:[]}:['history.search','presence.status'].includes(name)?[]:{};});
 await page.goto('http://127.0.0.1:4173');await addNetwork(page);await page.getByRole('button',{name:'Abrir configuración',exact:true}).click();
 expect(await page.locator('.settings-group>summary').allTextContents()).toEqual(['Redes e identidad','Apariencia','Chat y notificaciones','Herramientas']);expect(await page.locator('.settings-group').nth(1).locator('button').allTextContents()).toEqual(['Colores del entorno','Chat','Paneles','Multimedia']);
 await page.getByRole('button',{name:'Colores del entorno',exact:true}).click();await expect(page.getByRole('combobox',{name:'Tema',exact:true})).toBeVisible();for(const name of ['Aplicar','Agregar…','Guardar','Eliminar'])await expect(page.getByRole('button',{name,exact:true})).toBeVisible();await page.getByRole('combobox',{name:'Colores de nicks',exact:true}).selectOption('pastel');await expect.poll(()=>page.evaluate(()=>config.settings.nickPalette)).toBe('pastel');
 await page.getByRole('button',{name:'Paneles',exact:true}).click();await expect(page.getByRole('combobox',{name:'Vista de eventos de sala',exact:true})).toBeVisible();await expect(page.locator('#setting-eventShowHost')).toBeVisible();
 await page.locator('.settings-nav').getByRole('button',{name:'Configuración de resaltado',exact:true}).click();await expect(page.getByRole('combobox',{name:'Tema',exact:true})).toBeHidden();await expect(page.getByRole('combobox',{name:'Red del color de menciones',exact:true})).toBeVisible();await page.screenshot({path:'dist/HexDreams-v15-configuracion.png'});
});
test('v15 network identity stores its own nick colour and outgoing text style without changing other networks',async({page})=>{
 await page.goto('http://127.0.0.1:4173');await addNetwork(page,'Primera');await addNetwork(page,'Segunda');
 await page.getByRole('button',{name:'Abrir configuración',exact:true}).click();await page.locator('[data-section=networks]').click();await page.locator('#profile-list .profile-card').filter({hasText:'Segunda'}).getByRole('button',{name:'Editar',exact:true}).click();await page.locator('#profile-ownNickColor').fill('#ff2266');await page.locator('#profile-textColor').fill('#123abc');await page.locator('#profile-textStyle').selectOption('bold-italic');await page.locator('#network-form').getByRole('button',{name:'Guardar',exact:true}).click();await page.getByRole('button',{name:'Listo',exact:true}).click();
 await page.locator('#message-input').fill('estilo de segunda');await page.locator('#message-input').press('Enter');const sent=await page.evaluate(()=>window.__sent.at(-1));expect(sent.text).toBe('\x02\x1d\x0302estilo de segunda\x0f');const profiles=await page.evaluate(()=>config.profiles);expect(profiles[1].ownNickColor).toBe('#ff2266');expect(profiles[0].textColor).toBeUndefined();
 await page.locator('#network-select').selectOption(profiles[0].id);await page.locator('#message-input').fill('texto normal');await page.locator('#message-input').press('Enter');expect(await page.evaluate(()=>window.__sent.at(-1).text)).toBe('texto normal');await page.reload();expect(await page.evaluate(()=>config.profiles[1].textStyle)).toBe('bold-italic');
});
test('v16 dictionary edits, expands whole words and persists without rewriting commands',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4173');await addNetwork(page);await page.getByRole('button',{name:'Abrir configuración',exact:true}).click();await page.getByRole('button',{name:'Diccionario y nick completion',exact:true}).click();await page.getByRole('textbox',{name:'Abreviatura',exact:true}).fill('XDD');await page.getByRole('textbox',{name:'Reemplazo',exact:true}).fill('😂 💜');await page.locator('.dictionary-editor').getByRole('button',{name:'Añadir',exact:true}).click();await expect(page.locator('.dictionary-row')).toContainText('XDD');await page.getByRole('button',{name:'Listo',exact:true}).click();
 const input=page.locator('#message-input');await input.fill('Hola XDD ');await expect(input).toHaveValue('Hola 😂 💜 ');await input.press('Enter');expect(await page.evaluate(()=>window.__sent.at(-1).text)).toBe('Hola 😂 💜 ');await input.fill('/join XDD');await input.press('Enter');expect(await page.evaluate(()=>window.__sent.at(-1).text)).toBe('/join XDD');await page.reload();expect(await page.evaluate(()=>config.settings.dictionary[0].to)).toBe('😂 💜');expect(errors).toEqual([]);
});
test('v16 nick completion previews styles, cycles decorated nicks and preserves formatted drafts by room',async({page})=>{
 await page.goto('http://127.0.0.1:4173');await addNetwork(page);await page.evaluate(()=>window.__emit({id:config.profiles[0].id,type:'users',target:'#general',users:['Alice','Alberto']}));await page.getByRole('button',{name:'Abrir configuración',exact:true}).click();await page.getByRole('button',{name:'Diccionario y nick completion',exact:true}).click();await page.getByRole('checkbox',{name:'Personalizar nick completion',exact:true}).check();await page.getByRole('textbox',{name:'Plantilla',exact:true}).fill('👋 {nick} 💜');await page.locator('.nick-completion-editor').getByRole('checkbox',{name:'Color',exact:true}).check();await page.getByLabel('Color del nick completado',{exact:true}).fill('#123abc');await page.locator('.nick-completion-editor').getByRole('checkbox',{name:'Negrita',exact:true}).check();await expect(page.getByLabel('Vista previa del nick completion',{exact:true})).toContainText('👋 Luna 💜');await page.getByRole('button',{name:'Guardar nick completion',exact:true}).click();await page.screenshot({path:'dist/HexDreams-v16-escritura.png'});await page.getByRole('button',{name:'Listo',exact:true}).click();
 const input=page.locator('#message-input');await input.fill('Al');await input.press('Tab');await expect(input).toHaveValue('👋 Alberto 💜 ');await input.press('Tab');await expect(input).toHaveValue('👋 Alice 💜 ');await page.getByRole('button',{name:'Sala #dreams',exact:true}).click();await page.getByRole('button',{name:'Sala #general',exact:true}).click();await expect(input).toHaveValue('👋 Alice 💜 ');await input.press('Enter');expect(await page.evaluate(()=>window.__sent.at(-1).text)).toBe('\x0f\x02\x0302👋 Alice 💜\x0f ');
});
test('v16 suggestions remain readable and full width on light and dark writing backgrounds',async({page})=>{
 await page.goto('http://127.0.0.1:4173');await addNetwork(page);for(const background of ['#ffffff','#141932']){await page.evaluate(background=>{config.settings.roomAppearance={background,inputBackground:background};applySettings();render();},background);await page.locator('#message-input').fill('Lu');const option=page.locator('#composer-suggestions .completion-option').first();await expect(option).toBeVisible();const result=await option.evaluate(n=>{const s=getComputedStyle(n),strong=getComputedStyle(n.querySelector('strong'));return{contrast:DreamsFormatting.contrast(s.color,s.backgroundColor),width:n.clientWidth,parent:n.parentElement.clientWidth,font:strong.fontSize,height:n.clientHeight};});expect(result.contrast).toBeGreaterThan(4.5);expect(result.width).toBeGreaterThan(result.parent*.85);expect(result.font).toBe('12px');expect(result.height).toBeLessThan(40);await page.locator('#message-input').press('ArrowDown');await expect(option).toHaveAttribute('aria-selected','true');}await page.screenshot({path:'dist/HexDreams-v16-sugerencias.png'});
});
test('v16 toolbar, preference sections and quick themes follow the requested compact order',async({page})=>{
 await page.addInitScript(()=>{window.dreams.advanced=async name=>name==='status'?{scripts:[],transfers:[],debug:[]}:['history.search','presence.status'].includes(name)?[]:{};});await page.goto('http://127.0.0.1:4173');await addNetwork(page);
 expect(await page.locator('.menubar nav>.menu>summary').allTextContents()).toEqual(['Archivo','Ver','Comandos','Scripts','Ayuda']);expect(await page.locator('.network-strip').evaluate(n=>[...n.children].map(c=>c.id||c.className))).toEqual(['network-picker','connection-button','server-button','join-button','topic-toggle','notify-button','network-picker theme-picker','settings-top','notification-bell']);await expect(page.locator('.mdi-active .mdi-users-button')).toBeVisible();await expect(page.locator('.network-strip #users-toggle')).toHaveCount(0);
 await expect(page.locator('#theme-quick-select option').first()).toHaveText('Ir a temas…');await page.getByRole('combobox',{name:'Tema rápido',exact:true}).selectOption('purple-light');await expect(page.locator('html')).toHaveAttribute('data-theme','purple-light');await page.getByRole('button',{name:'Abrir configuración',exact:true}).click();await page.getByRole('button',{name:'Colores del entorno',exact:true}).click();await expect(page.getByRole('combobox',{name:'Colores de nicks',exact:true})).toHaveCount(1);await expect(page.getByRole('combobox',{name:'Colores de los nicks',exact:true})).toHaveCount(0);
 for(const name of ['Configuración general','Configuración de Away','Configuración de NOTICE','Configuración de notificaciones','Configuración de resaltado','Configuración de sonido'])await expect(page.locator('.settings-nav').getByRole('button',{name,exact:true})).toBeVisible();await page.getByRole('button',{name:'Configuración de notificaciones',exact:true}).click();await page.getByRole('checkbox',{name:'Notificar privados',exact:true}).uncheck();await page.getByRole('checkbox',{name:'Notificar menciones',exact:true}).check();await page.locator('.advanced-content').getByRole('button',{name:'Guardar',exact:true}).click();await expect.poll(()=>page.evaluate(()=>config.settings.notifyPrivates)).toBe(false);expect(await page.evaluate(()=>config.settings.notifyMentions)).toBe(true);await page.screenshot({path:'dist/HexDreams-v16-configuracion.png'});
});
test('v16 internal windows minimize, retain drafts, restore from taskbar or tree and tile in both directions',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4173');await addNetwork(page);const general=page.locator('.mdi-window[data-target="#general"]');await page.locator('#message-input').fill('borrador minimizado');await page.getByRole('button',{name:'Minimizar ventana #general',exact:true}).click();await expect(general).toBeHidden();await expect(page.getByRole('button',{name:'Restaurar conversación #general',exact:true})).toBeVisible();await page.getByRole('button',{name:'Restaurar conversación #general',exact:true}).click();await expect(general).toBeVisible();await expect(page.locator('#message-input')).toHaveValue('borrador minimizado');await page.getByRole('button',{name:'Minimizar ventana #general',exact:true}).click();await page.getByRole('button',{name:'Sala #general',exact:true}).click();await expect(general).toBeVisible();await expect(page.locator('#message-input')).toBeFocused();await expect(page.getByRole('button',{name:'Restaurar conversación #general',exact:true})).toHaveCount(0);
 for(const mode of ['vertical','horizontal']){await page.evaluate(mode=>window.arrangeDreamsWindows(mode),mode);const boxes=await page.locator('.mdi-window:visible').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};}));expect(boxes.length).toBeGreaterThan(1);if(mode==='vertical'){expect(Math.max(...boxes.map(b=>b.y))-Math.min(...boxes.map(b=>b.y))).toBeLessThan(1);expect(new Set(boxes.map(b=>b.x)).size).toBe(boxes.length);}else{expect(Math.max(...boxes.map(b=>b.x))-Math.min(...boxes.map(b=>b.x))).toBeLessThan(1);expect(new Set(boxes.map(b=>b.y)).size).toBe(boxes.length);}}expect(errors).toEqual([]);await page.screenshot({path:'dist/HexDreams-v16-ventanas.png'});
});
test('v16 NOTICE settings save destinations and local style without losing its text',async({page})=>{
 await page.addInitScript(()=>{window.dreams.advanced=async name=>name==='status'?{scripts:[],transfers:[],debug:[]}:['history.search','presence.status'].includes(name)?[]:{};});await page.goto('http://127.0.0.1:4173');await addNetwork(page);await page.getByRole('button',{name:'Abrir configuración',exact:true}).click();await page.getByRole('button',{name:'Configuración de NOTICE',exact:true}).click();await page.getByRole('checkbox',{name:'NOTICE en Destino original',exact:true}).uncheck();await page.getByRole('checkbox',{name:'NOTICE en Status',exact:true}).check();await page.getByRole('checkbox',{name:'Personalizar color del NOTICE',exact:true}).check();await page.getByLabel('Color del NOTICE',{exact:true}).fill('#123abc');await page.getByRole('checkbox',{name:'Personalizar fondo del NOTICE',exact:true}).check();await page.getByLabel('Fondo del NOTICE',{exact:true}).fill('#ffffff');await page.getByRole('combobox',{name:'Estilo del NOTICE',exact:true}).selectOption('bold-italic');await page.locator('.advanced-content').getByRole('button',{name:'Guardar',exact:true}).click();await expect.poll(()=>page.evaluate(()=>config.settings.noticeDestinations)).toEqual(['status']);await page.getByRole('button',{name:'Listo',exact:true}).click();
 await page.evaluate(()=>window.__emit({id:config.profiles[0].id,type:'message',target:'#general',nick:'Alice',notice:true,text:'\x0304Aviso con color de origen\x0f'}));await expect(page.locator('.message.notice')).toHaveCSS('background-color','rgb(255, 255, 255)');await expect(page.locator('.message.notice')).toHaveCSS('font-style','italic');await expect(page.locator('.message.notice .message-text span')).toHaveCSS('color','rgb(18, 58, 188)');await expect(page.locator('.message.notice .message-text')).toHaveText('Aviso con color de origen');
});
test('v16 nick templates leave command recipients raw and real-name limits are visible',async({page})=>{
 await page.goto('http://127.0.0.1:4173');await addNetwork(page);await page.evaluate(()=>{config.settings.nickCompletion={enabled:true,template:'👋 {nick}',bold:true,color:'#123abc'};window.__emit({id:config.profiles[0].id,type:'users',target:'#general',users:['Alice','Alberto']});});const input=page.locator('#message-input');await input.fill('/msg Al');await input.press('Tab');await expect(input).toHaveValue('/msg Alberto ');await input.fill('/msg Bob Al');await input.press('Tab');await expect(input).toHaveValue('/msg Bob 👋 Alberto ');await input.press('Enter');expect(await page.evaluate(()=>window.__sent.at(-1).text)).toBe('/msg Bob \x0f\x02\x0302👋 Alberto\x0f ');
 await page.evaluate(()=>openNetwork(config.profiles[0].id));await page.locator('#profile-realName').fill('💜'.repeat(140));await expect(page.locator('#identity-length')).toContainText('140 caracteres');await expect(page.locator('#identity-length')).toContainText('Límite superado');await expect(page.locator('#profile-realName')).toHaveAttribute('aria-describedby','identity-length');
});
test('v17 nick activation survives delayed saves and stale preference updates after one click',async({page})=>{
 await page.addInitScript(()=>{window.dreams.advanced=async name=>name==='status'?{scripts:[],transfers:[],debug:[]}:['history.search','presence.status'].includes(name)?[]:{};const save=window.dreams.save;window.dreams.save=async data=>{if(window.__slowPreferences)await new Promise(r=>setTimeout(r,60));return save(data);};});await page.goto('http://127.0.0.1:4173');await addNetwork(page);await page.evaluate(async()=>{await saveQueue;window.__slowPreferences=true;});await page.getByRole('button',{name:'Abrir configuración',exact:true}).click();await page.getByRole('button',{name:'Diccionario y nick completion',exact:true}).click();const check=page.getByRole('checkbox',{name:'Personalizar nick completion',exact:true});await check.check();await page.evaluate(()=>window.__emit({type:'preferences',settings:{nickCompletion:{enabled:false,template:'{nick}'},ignoredUsers:{}}}));await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('dreams-test')).settings.nickCompletion?.enabled)).toBe(true);await page.getByRole('textbox',{name:'Plantilla',exact:true}).fill('✨ {nick} 💜');await page.getByRole('button',{name:'Guardar nick completion',exact:true}).click();await page.evaluate(()=>window.__emit({type:'preferences',settings:{nickCompletion:{enabled:false},ignoredUsers:{}}}));await expect(check).toBeChecked();await page.evaluate(async()=>{await saveQueue;});await page.reload();await page.getByRole('button',{name:'Abrir configuración',exact:true}).click();await page.getByRole('button',{name:'Diccionario y nick completion',exact:true}).click();await expect(check).toBeChecked();await expect(page.getByRole('textbox',{name:'Plantilla',exact:true})).toHaveValue('✨ {nick} 💜');
});
test('v17 multicolor previews and messages use classic colors for nick letters with no visible hex prefix',async({page})=>{
 await page.goto('http://127.0.0.1:4173');await addNetwork(page);for(const mode of ['letters','gradient','rainbow']){await page.getByRole('button',{name:'Abrir configuración',exact:true}).click();await page.getByRole('button',{name:'Diccionario y nick completion',exact:true}).click();await page.getByRole('checkbox',{name:'Personalizar nick completion',exact:true}).check();await page.getByRole('textbox',{name:'Plantilla',exact:true}).fill('✨ {nick} 💜');await page.getByRole('combobox',{name:'Modo de color del nick',exact:true}).selectOption(mode);await expect(page.getByLabel('Vista previa del nick completion',{exact:true})).toHaveText('✨ Luna 💜');const preview=await page.getByLabel('Vista previa del nick completion',{exact:true}).locator('span').evaluateAll(nodes=>[...new Set(nodes.map(n=>getComputedStyle(n).color))]);expect(preview.length).toBeGreaterThan(1);await page.getByRole('button',{name:'Guardar nick completion',exact:true}).click();await page.evaluate(async()=>{await saveQueue;});await page.getByRole('button',{name:'Listo',exact:true}).click();await page.locator('#message-input').fill('Lu');await page.locator('#message-input').press('Tab');await expect(page.locator('#message-input')).toHaveValue('✨ Luna 💜 ');await page.locator('#message-input').press('Enter');const sent=await page.evaluate(()=>window.__sent.at(-1).text);expect(sent).not.toContain('\x04');expect(await page.evaluate(text=>DreamsFormatting.plain(text),sent)).toBe('✨ Luna 💜 ');const colors=[...sent.matchAll(/\x03(\d{2})/g)].map(m=>Number(m[1]));expect(new Set(colors).size).toBeGreaterThan(1);expect(colors.every(n=>n<16)).toBe(true);}await page.screenshot({path:'dist/HexDreams-v17-multicolor.png'});
});
test('v17 quick theme selection preserves saved theme identity and the theme controls have inner margins',async({page})=>{
 await page.goto('http://127.0.0.1:4173');await addNetwork(page);await page.evaluate(async()=>{config.settings.savedThemes=[{id:'my-purple',name:'Mi tema morado',settings:DreamsThemes.snapshot({...config.settings,...DreamsThemes.violet,customColors:{...DreamsThemes.violet.customColors,accent:'#b022ff'}})}];await persist();applySettings();});const quick=page.getByRole('combobox',{name:'Tema rápido',exact:true});await quick.selectOption('my-purple');await expect(quick).toHaveValue('my-purple');await expect(page.locator('html')).toHaveCSS('--accent','#b022ff');await page.evaluate(async()=>{await saveQueue;});await page.reload();await expect(quick).toHaveValue('my-purple');await quick.selectOption('__settings__');await expect(page.locator('#settings-dialog')).toBeVisible();await expect(quick).toHaveValue('my-purple');const group=page.locator('[data-panel=appearance] .theme-manager'),parent=await group.boundingBox(),selector=await group.getByRole('combobox',{name:'Tema',exact:true}).boundingBox(),buttons=await group.locator('.theme-manager-actions').boundingBox();expect(selector.x-parent.x).toBeGreaterThanOrEqual(12);expect(selector.y-parent.y).toBeGreaterThanOrEqual(12);expect(parent.y+parent.height-buttons.y-buttons.height).toBeGreaterThanOrEqual(10);await page.screenshot({path:'dist/HexDreams-v17-tema.png'});
});
test('v17 Salas lists favorites from the selected network before join and room-list actions',async({page})=>{
 await page.goto('http://127.0.0.1:4173');await addNetwork(page,'Primera');await addNetwork(page,'Segunda');await page.evaluate(async()=>{config.settings.favoriteRooms=[{network:config.profiles[0].id,name:'#otra-red'},{network:config.profiles[1].id,name:'#zeta'},{network:config.profiles[1].id,name:'#alpha'}];await persist();});await page.getByRole('button',{name:'Salas',exact:true}).click();expect(await page.locator('#rooms-quick-popup button').allTextContents()).toEqual(['#alpha','#zeta','Entrar a otra sala…','Listado de salas','Configurar favoritas…']);await page.getByRole('menuitem',{name:'#alpha',exact:true}).click();await expect(page.getByRole('button',{name:'Sala #alpha',exact:true})).toHaveAttribute('aria-current','true');expect(await page.evaluate(()=>window.__sent.at(-1).id)).toBe(await page.evaluate(()=>config.profiles[1].id));await page.getByRole('button',{name:'Salas',exact:true}).click();await page.getByRole('menuitem',{name:'Listado de salas',exact:true}).click();await expect(page.locator('#join-dialog h2')).toHaveText('Listado de salas');
});
test('v17 network editor follows the four-card reference, keeps every control and adapts to narrow windows',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1280,height:1400});await page.goto('http://127.0.0.1:4173');await addNetwork(page,'Dramatiik');await page.evaluate(()=>openNetwork(config.profiles[0].id));const dialog=page.locator('#network-dialog');await page.evaluate(()=>{network(config.profiles[0].id).state='disconnected';render();});for(const button of await page.locator('#realname-tools button').all())await expect(button).toBeEnabled();expect(await dialog.locator('.network-card>h3').allTextContents()).toEqual(['Configuración de la red','Identidad de esta red','Foto / Avatar','Conexión y comandos']);const fields=['id','name','host','port','tls','nick','username','alternateNick','realName','customText','ownNickColor','textColor','textStyle','photoUrl','publishPhoto','photo-preview','photo-choose','photo-remove','channels','password','commands','commandDelay'];for(const id of fields){await expect(page.locator('#profile-'+id)).toHaveCount(1);expect(await page.locator('#profile-'+id).evaluate(n=>n.closest('form')?.id)).toBe('network-form');}await expect(page.locator('#network-error')).toHaveCount(1);const boxes=await Promise.all(['nick','username','alternateNick'].map(id=>page.locator('#profile-'+id).boundingBox()));expect(Math.max(...boxes.map(b=>b.y))-Math.min(...boxes.map(b=>b.y))).toBeLessThan(1);const photo=await page.locator('.network-photo-visual').boundingBox(),url=await page.locator('#profile-photoUrl').boundingBox();expect(photo.x+photo.width).toBeLessThan(url.x);await page.screenshot({path:'dist/HexDreams-v17-editar-red.png'});await page.setViewportSize({width:620,height:760});expect(await dialog.evaluate(n=>n.scrollWidth>n.clientWidth)).toBe(false);expect(await page.locator('.network-editor-body').evaluate(n=>n.scrollWidth>n.clientWidth)).toBe(false);await page.locator('#profile-channels').fill('#general, #amigos');await page.locator('#profile-commands').fill('/join #dreams');await page.locator('#network-form').getByRole('button',{name:'Guardar',exact:true}).click();expect(await page.evaluate(()=>config.profiles[0].commands)).toEqual(['/join #dreams']);expect(errors).toEqual([]);
});
test('v18 scripts can be removed from the compact manager without leaving a stale entry',async({page})=>{
 await page.addInitScript(()=>{window.__scripts=[{id:'social',name:'Sociales.hex',enabled:true}];window.__removed=[];window.dreams.advanced=async(name,data)=>{if(name==='status')return{scripts:window.__scripts,debug:[],scriptRunning:window.__scripts.length>0};if(name==='script.remove'){window.__removed.push(data.id);window.__scripts=window.__scripts.filter(s=>s.id!==data.id);return{ok:true};}return[];};});await page.goto('http://127.0.0.1:4173');await page.getByRole('button',{name:'Abrir configuración',exact:true}).click();await page.locator('[data-advanced-section=scripts]').click();await expect(page.locator('.script-card')).toHaveCount(1);await page.locator('.script-card').getByRole('button',{name:'Eliminar',exact:true}).click();await expect(page.locator('.script-card')).toHaveCount(0);expect(await page.evaluate(()=>window.__removed)).toEqual(['social']);
});
test('v18 clicking the active room, private or Status focuses writing immediately and preserves its draft',async({page})=>{
 await page.goto('http://127.0.0.1:4173');await addNetwork(page);const input=page.locator('#message-input');for(const target of ['#general','Alice','*']){await page.evaluate(target=>choose(config.profiles[0].id,target),target);await input.fill('borrador '+target);await page.evaluate(()=>document.activeElement.blur());const title=page.locator('.mdi-active .mdi-title');await title.click();await expect(input).toBeFocused();await expect(input).toHaveValue('borrador '+target);await page.evaluate(()=>document.activeElement.blur());await page.locator('.mdi-active .mdi-titlebar').click({position:{x:170,y:12}});await expect(input).toBeFocused();}
});
test('v18 network color swatches sit directly next to their labels at wide and narrow widths',async({page})=>{
 await page.goto('http://127.0.0.1:4173');await addNetwork(page);await page.evaluate(()=>openNetwork(config.profiles[0].id));for(const width of [1280,620]){await page.setViewportSize({width,height:900});for(const id of ['profile-ownNickColor','profile-textColor']){const gap=await page.locator('#'+id).evaluate(input=>{const label=input.closest('label'),range=document.createRange();range.selectNodeContents(label.firstChild);return input.getBoundingClientRect().left-range.getBoundingClientRect().right;});expect(gap).toBeGreaterThanOrEqual(0);expect(gap).toBeLessThanOrEqual(9);}}await page.screenshot({path:'dist/HexDreams-v18-colores-red.png'});
});
test('v19 Status accepts a long raw token intact and restores the ordinary room editor limit',async({page})=>{
 await page.goto('http://127.0.0.1:4173');await addNetwork(page);await page.evaluate(()=>{window.dreams.send=async data=>{(window.__sent||=[]).push(data);return{ok:true};};choose(config.profiles[0].id,'*');});const input=page.locator('#message-input'),command='/raw VALIDATE eyJ'+('Test_9-'.repeat(1800));await expect(input).toHaveAttribute('maxlength','65534');await input.fill(command);await input.press('Enter');await expect(input).toHaveValue('');expect(await page.evaluate(()=>window.__sent.at(-1))).toMatchObject({target:'*',text:command});await page.getByRole('button',{name:'Sala #general',exact:true}).click();await expect(input).toHaveAttribute('maxlength','10000');
});
test('v20 MeMo commands bypass composer styles, dictionary and nick formatting in MSG and private chat',async({page})=>{
 await page.goto('http://127.0.0.1:4173');await addNetwork(page);await page.evaluate(()=>{config.settings.composerBold=true;config.settings.composerColor=6;config.settings.dictionaryEnabled=true;config.settings.dictionary=[{from:'read',to:'saludo',enabled:true}];const p=config.profiles[0];p.textColor='#ff00ff';p.textStyle='bold';applySettings();});const input=page.locator('#message-input');await input.fill('/msg memo read 7');await input.press('Enter');expect(await page.evaluate(()=>window.__sent.at(-1).text)).toBe('/msg memo read 7');await page.evaluate(()=>choose(config.profiles[0].id,'MeMo'));await input.fill('read last');await input.press('Enter');expect(await page.evaluate(()=>window.__sent.at(-1))).toMatchObject({target:'MeMo',text:'read last'});await page.evaluate(()=>choose(config.profiles[0].id,'Alice'));await input.fill('Hola');await input.press('Enter');expect(await page.evaluate(()=>window.__sent.at(-1).text)).toContain('\x02');
});
test('v20 Notify nick opens its sidebar profile from dialog or tree even from Status without WHOIS or PV',async({page})=>{
 await page.addInitScript(()=>{window.__calls=[];window.dreams.advanced=async(name,data)=>{window.__calls.push({name,data});if(['presence.status','notifications.list'].includes(name))return[];return{};};});await page.goto('http://127.0.0.1:4173');await addNetwork(page);await page.evaluate(()=>{config.profiles[0].notifyNicks=['Alice'];});await page.locator('#notify-button').click();await page.locator('#notify-list').getByRole('button',{name:'Alice',exact:true}).click();await expect(page.locator('#notify-dialog')).toBeHidden();await expect(page.locator('#user-profile')).toBeVisible();await expect(page.locator('#user-profile h3')).toHaveText('Alice');expect(await page.evaluate(()=>active.target)).toBe('#general');await page.evaluate(()=>{const id=config.profiles[0].id;choose(id,'*');window.__emit({id,type:'presence',nick:'Alice',online:true});});await page.getByRole('button',{name:'Notify Alice en línea',exact:true}).click();await expect(page.locator('#user-profile')).toBeVisible();expect(await page.evaluate(()=>active.target)).toBe('*');expect(await page.evaluate(()=>[...network(active.id).conversations.keys()].some(k=>k.toLowerCase()==='alice'))).toBe(false);expect(await page.evaluate(()=>window.__calls.some(c=>c.name==='user.whois'))).toBe(false);await page.locator('#user-profile').getByRole('button',{name:'← Usuarios',exact:true}).click();await expect(page.locator('#users-panel')).toBeHidden();
});
