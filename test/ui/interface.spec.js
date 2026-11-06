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
  await expect(page.getByRole('heading',{name:'#dreams',exact:true})).toBeVisible();
  await expect(page.locator('#message-input')).toHaveValue('');
  await page.locator('#network-select').selectOption(ids[1]);
  await expect(page.locator('#message-input')).toHaveValue('second network draft');
});
test('Both panel widths, visibility and configuration searches work and survive reopening', async ({page}) => {
  await page.goto('http://127.0.0.1:4173'); await addNetwork(page);
  const divider = await page.locator('#users-resizer').boundingBox();
  await page.mouse.move(divider.x + 2,divider.y + 80); await page.mouse.down(); await page.mouse.move(1020,divider.y + 80); await page.mouse.up();
  await expect(page.locator('#users-panel')).toHaveCSS('width','260px');
  await page.getByRole('button',{name:'Ocultar panel izquierdo',exact:true}).click();
  await expect(page.locator('#private-panel')).toBeHidden();
  await page.getByRole('button',{name:'Ocultar usuarios',exact:true}).click();
  await expect(page.locator('#users-panel')).toBeHidden();
  await page.reload();
  await expect(page.locator('#private-panel')).toBeHidden(); await expect(page.locator('#users-panel')).toBeHidden();
  await page.getByRole('button',{name:'Mostrar panel izquierdo',exact:true}).click(); await page.getByRole('button',{name:'Mostrar usuarios',exact:true}).click();
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
  await page.reload();
  await expect(page.locator('#tree-rooms .tree-name').first()).toHaveAttribute('aria-label','Sala #general');
  await expect(page.locator('.conversation.is-muted')).toHaveCount(1);
  await page.getByRole('button',{name:'Privado Luna',exact:true}).click({button:'right'});
  await page.getByRole('menuitem',{name:'Cerrar privado',exact:true}).click();
  await expect(page.getByRole('button',{name:'Privado Luna',exact:true})).toHaveCount(0);
  expect(await page.evaluate(() => (window.__sent || []).some(m => m.text === '/quit'))).toBe(false);
  await page.getByRole('button',{name:'Sala #general',exact:true}).click({button:'right'}); await page.keyboard.press('Escape');
  await expect(page.locator('#context-menu')).toBeHidden();
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
 await page.evaluate(()=>{const id=JSON.parse(localStorage.getItem('dreams-test')).profiles[0].id;window.__emit({id,type:'topic',target:'#general',text:'Topic recibido al reconectar'});});
 const separator=page.getByRole('separator',{name:'Altura del topic',exact:true});await separator.focus();await page.keyboard.press('End');
 const bounds=await separator.boundingBox(),top=await page.locator('#conversation-subtitle').evaluate(n=>n.getBoundingClientRect().top);
 await page.mouse.move(bounds.x+40,bounds.y+2);await page.mouse.down();await page.mouse.move(bounds.x+40,top+60);await page.mouse.up();await expect(page.locator('#conversation-subtitle')).toHaveCSS('height','60px');
 await page.reload();await page.evaluate(()=>{const id=JSON.parse(localStorage.getItem('dreams-test')).profiles[0].id;window.__emit({id,type:'topic',target:'#general',text:'Topic recibido al reconectar'});});await expect(page.locator('#conversation-subtitle')).toHaveCSS('height','60px');
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
 for(const id of ['connection-button','join-button','notify-button','topic-toggle','room-appearance-button'])expect(await page.locator('#'+id).evaluate(n=>!!n.closest('.menubar'))).toBe(true);
 const title=await page.locator('#conversation-title').boundingBox(),modes=await page.locator('#channel-modes').boundingBox();expect(Math.abs(title.y-modes.y)).toBeLessThan(8);
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
 const buttons=await page.locator('#whois-profile-dialog .profile-action-buttons button').evaluateAll(nodes=>nodes.map(n=>({x:n.getBoundingClientRect().x,y:n.getBoundingClientRect().y,width:n.getBoundingClientRect().width})));expect(buttons.length).toBe(5);expect(buttons[1].y).toBe(buttons[0].y);expect(buttons[1].x).toBeGreaterThan(buttons[0].x);
 await page.locator('#whois-profile-dialog .dialog-header').getByRole('button',{name:'Cerrar',exact:true}).click();await page.getByRole('button',{name:'Consulta *consultas*',exact:true}).click();await expect(page.locator('#messages')).toContainText('Alice WHOIS recibido');
});
test('Purple navy theme and a named style survive saving, switching and reopening',async({page})=>{
 await page.goto('http://127.0.0.1:4173');await addNetwork(page);await page.getByRole('button',{name:'Abrir configuración',exact:true}).click();await page.locator('[data-section=appearance]').click();
 await page.getByRole('combobox',{name:'Tema guardado',exact:true}).selectOption('violet');await page.getByRole('button',{name:'Aplicar tema',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','violet');
 await page.locator('#setting-font').selectOption('18');await page.getByRole('textbox',{name:'Nombre del tema',exact:true}).fill('Mi morado');await page.getByRole('button',{name:'Guardar como tema',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('dreams-test')).settings.savedThemes?.length)).toBe(1);
 const id=await page.evaluate(()=>JSON.parse(localStorage.getItem('dreams-test')).settings.savedThemes[0].id);
 await page.getByRole('combobox',{name:'Tema guardado',exact:true}).selectOption('light');await page.getByRole('button',{name:'Aplicar tema',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await page.reload();await page.getByRole('button',{name:'Abrir configuración',exact:true}).click();await page.locator('[data-section=appearance]').click();await page.getByRole('combobox',{name:'Tema guardado',exact:true}).selectOption(id);await page.getByRole('button',{name:'Aplicar tema',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','violet');await expect(page.locator('html')).toHaveCSS('--font-size','18px');
 await page.getByRole('button',{name:'Listo',exact:true}).click();await page.screenshot({path:'dist/HexDreams-morado.png'});
});
test('Opening a colored real name preserves its IRC color rather than saving a contrast-adjusted replacement',async({page})=>{
 await page.goto('http://127.0.0.1:4173');await addNetwork(page);await page.getByRole('button',{name:'Abrir configuración',exact:true}).click();await page.locator('[data-section=networks]').click();await page.locator('#profile-list').getByRole('button',{name:'Editar',exact:true}).click();
 const result=await page.evaluate(()=>{const editor=document.getElementById('profile-realName');editor.value='\x0302Azul original\x0f';return editor.value;});expect(result).toBe('\x0302Azul original\x0f');
});
