'use strict';
const $ = id => document.getElementById(id);
const api = window.dreams;
let config = { settings: {}, profiles: [] }, active = null, toastTimer, saveQueue = Promise.resolve();
const networks = new Map();
const passwords = new Map();
function fold(s) { return String(s).toLowerCase().replace(/[\[\]\\^]/g, c => ({ '[': '{', ']': '}', '\\': '|', '^': '~' })[c]); }
function el(tag, className, text) { const n = document.createElement(tag); if (className) n.className = className; if (text !== undefined) n.textContent = text; return n; }
function network(id) {
  if (!networks.has(id)) networks.set(id, { state: 'disconnected', nick: config.profiles.find(p => p.id === id)?.nick || '', conversations: new Map() });
  return networks.get(id);
}
function conversation(id, name = '*') {
  const n = network(id), key = fold(name);
  if (!n.conversations.has(key)) n.conversations.set(key, { name, messages: [], users: [], topic: '', unread: 0, joined: false });
  return n.conversations.get(key);
}
function selected() { return active ? conversation(active.id, active.target) : null; }
function profile(id) { return config.profiles.find(p => p.id === id); }
function notify(text, error = false) {
  $('toast').textContent = text; $('toast').classList.toggle('error', error); $('toast').hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, error ? 9000 : 4000);
}
function persist() {
  const snapshot = structuredClone(config);
  saveQueue = saveQueue.catch(() => {}).then(async () => {
    const result = await api.save(snapshot);
    if (result?.error) { $('settings-feedback').textContent = 'No se pudo guardar. Vuelve a intentarlo.'; notify(result.error, true); throw new Error(result.error); }
    $('settings-feedback').textContent = 'Cambios guardados.';
  });
  return saveQueue;
}
function applySettings() {
  const s = config.settings;
  document.documentElement.style.setProperty('--sidebar-width', s.sidebarWidth + 'px');
  document.documentElement.style.setProperty('--font-size', s.fontSize + 'px');
  $('sidebar-resizer').setAttribute('aria-valuenow', String(s.sidebarWidth));
  document.body.classList.toggle('compact', s.compact);
  $('users-panel').hidden = !s.showUsers;
  $('users-toggle').setAttribute('aria-pressed', String(s.showUsers));
  $('users-toggle').setAttribute('aria-label', s.showUsers ? 'Ocultar usuarios' : 'Mostrar usuarios');
  $('setting-font').value = String(s.fontSize); $('setting-sidebar').value = String(s.sidebarWidth);
  for (const key of ['compact','timestamps','showUsers','showEvents','autoScroll']) $('setting-' + key).checked = s[key];
}
function choose(id, target) {
  active = { id, target }; conversation(id, target).unread = 0; render();
  $('message-input').focus();
}
function addMessage(id, target, message) {
  const c = conversation(id, target); c.messages.push({ time: new Date().toISOString(), ...message });
  if (c.messages.length > 600) c.messages.splice(0, c.messages.length - 600);
  if (!message.event && !message.own && (!active || active.id !== id || fold(active.target) !== fold(target))) c.unread++;
}
function renderSidebar() {
  const list = $('network-list'); list.replaceChildren(); const query = $('search').value.toLowerCase();
  if (!config.profiles.length) list.append(el('p', 'empty-networks', 'Añade una red para ver aquí tus salas y mensajes privados.'));
  for (const p of config.profiles) {
    const n = network(p.id), group = el('section', 'network-group');
    const header = el('div', 'network-header'), dot = el('span', 'status-dot ' + (n.state === 'connected' ? 'online' : n.state));
    dot.title = n.state === 'connected' ? 'Conectado' : n.state === 'connecting' ? 'Conectando' : 'Desconectado';
    header.append(dot, el('strong', '', p.name));
    const edit = el('button', '', '⋯'); edit.setAttribute('aria-label', 'Editar ' + p.name); edit.onclick = () => openNetwork(p.id); header.append(edit); group.append(header);
    conversation(p.id, '*');
    for (const c of n.conversations.values()) {
      if (query && !(c.name + p.name).toLowerCase().includes(query)) continue;
      const b = el('button', 'conversation' + (active?.id === p.id && fold(active.target) === fold(c.name) ? ' active' : ''));
      b.append(el('span', 'symbol', c.name === '*' ? '◈' : /^[#&+!]/.test(c.name) ? '#' : '◌'), el('span', 'label', c.name === '*' ? p.name : c.name));
      if (c.unread) b.append(el('span', 'badge', c.unread > 99 ? '99+' : String(c.unread)));
      b.onclick = () => choose(p.id, c.name); group.append(b);
    }
    list.append(group);
  }
}
function renderTabs() {
  const tabs = $('room-tabs'); tabs.replaceChildren();
  if (!active) { tabs.append(el('span', 'empty-tabs', 'Tus salas aparecerán aquí')); return; }
  for (const c of network(active.id).conversations.values()) {
    const isActive = fold(c.name) === fold(active.target), tab = el('div', 'room-tab' + (isActive ? ' selected' : ''));
    const button = el('button', '', c.name === '*' ? '◈ Red' : c.name);
    button.setAttribute('role', 'tab'); button.setAttribute('aria-selected', String(isActive)); button.setAttribute('aria-label', c.name === '*' ? 'Red' : c.name);
    button.onclick = () => choose(active.id, c.name);
    if (c.unread) button.append(el('span', 'badge', String(c.unread)));
    tab.append(button);
    if (c.name !== '*') {
      const close = el('button', 'close-tab', '×'); close.setAttribute('aria-label', 'Cerrar ' + c.name);
      close.onclick = () => closeConversation(active.id, c.name); tab.append(close);
    }
    tabs.append(tab);
  }
}
async function closeConversation(id, target) {
  const c = conversation(id, target);
  if (c.joined && network(id).state === 'connected') {
    const result = await api.send({ id, target, text: '/part' }); if (result?.error) { notify(result.error, true); return; }
  }
  network(id).conversations.delete(fold(target));
  if (active?.id === id && fold(active.target) === fold(target)) active = { id, target: '*' };
  render();
}
function renderMessages(preserveScroll = false) {
  const list = $('messages'), c = selected(), oldTop = list.scrollTop, atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 70;
  list.hidden = !c; $('welcome').hidden = !!c; list.replaceChildren();
  if (!c) return;
  if (!c.messages.length) list.append(el('div', 'event-message', c.name === '*' ? 'Conecta esta red para ver su actividad.' : 'Este es el comienzo de la conversación.'));
  let day = '';
  for (const m of c.messages) {
    if (m.event && !config.settings.showEvents && !m.error) continue;
    const date = new Date(m.time); const valid = !Number.isNaN(date.valueOf());
    const label = valid ? date.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    if (label && label !== day) { day = label; list.append(el('div', 'message-day', label)); }
    const time = el('time', '', valid ? date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : '');
    if (valid) time.dateTime = date.toISOString();
    if (m.event) { const row = el('div', 'event-message' + (m.error ? ' error' : '')); if (config.settings.timestamps) row.append(time); row.append(document.createTextNode(m.text)); list.append(row); continue; }
    const row = el('article', 'message' + (m.own ? ' own' : '') + (m.action ? ' action' : '') + (m.notice ? ' notice' : ''));
    row.append(el('span', 'avatar', m.nick.slice(0, 2).toUpperCase()));
    const content = el('div', 'message-content'), header = el('div', 'message-header');
    const nick = el('button', 'message-nick', m.nick); nick.onclick = () => { if (active) choose(active.id, m.nick); }; header.append(nick);
    if (config.settings.timestamps) header.append(time);
    content.append(header, el('div', 'message-text', m.action ? '* ' + m.nick + ' ' + stripFormatting(m.text) : stripFormatting(m.text))); row.append(content); list.append(row);
  }
  if (!preserveScroll || (config.settings.autoScroll && atBottom)) { list.scrollTop = list.scrollHeight; $('new-messages').hidden = true; }
  else { list.scrollTop = oldTop; $('new-messages').hidden = atBottom; }
}
function stripFormatting(text) { return String(text).replace(/\x03(?:\d{1,2}(?:,\d{1,2})?)?|\x04(?:[0-9a-fA-F]{6}(?:,[0-9a-fA-F]{6})?)?|[\x00-\x02\x0f\x11-\x1f\x7f]/g, ''); }
function renderUsers() {
  const list = $('user-list'); list.replaceChildren(); const c = selected(), users = c?.users || [];
  $('user-count').textContent = String(users.length);
  if (!users.length) { list.append(el('div', 'empty-users', c && /^[#&+!]/.test(c.name) ? 'Los usuarios aparecerán al entrar en la sala.' : 'Selecciona una sala para ver quién está conectado.')); return; }
  for (const user of users) {
    const bare = user.replace(/^[~&@%+]+/, ''), b = el('button', 'user-button' + (/^[~&@%]/.test(user) ? ' operator' : ''));
    b.append(el('span', 'user-avatar', bare.slice(0, 2).toUpperCase()), el('span', 'user-name', user));
    b.setAttribute('aria-label', user); b.title = 'Mensaje privado a ' + bare; b.onclick = () => choose(active.id, bare); list.append(b);
  }
}
function renderHeader() {
  const p = active && profile(active.id), n = p && network(p.id), c = selected();
  $('conversation-title').textContent = c ? c.name === '*' ? p.name : c.name : 'Bienvenido a Dreams';
  $('channel-symbol').textContent = c ? c.name === '*' ? '◈' : /^[#&+!]/.test(c.name) ? '#' : '◌' : '✦';
  $('conversation-subtitle').textContent = c ? c.topic || (c.name === '*' ? `${p.host}:${p.port} · ${p.tls ? 'TLS' : 'Sin TLS'}` : /^[#&+!]/.test(c.name) ? p.name + ' · Sala IRC' : p.name + ' · Mensaje privado') : 'Un lugar para todas tus conversaciones.';
  $('connection-button').disabled = !p;
  $('connection-button').textContent = n?.state === 'connected' ? 'Desconectar' : n?.state === 'connecting' ? 'Cancelar' : 'Conectar';
  $('join-button').disabled = n?.state !== 'connected';
  const canSend = n?.state === 'connected' && c && (c.name === '*' || !/^[#&+!]/.test(c.name) || c.joined);
  $('message-input').disabled = !canSend; $('send-button').disabled = !canSend;
  $('message-input').placeholder = !c ? 'Selecciona una conversación…' : !canSend ? 'Conecta la red y entra en la sala para escribir…' : c.name === '*' ? 'Escribe un comando, por ejemplo /join #general' : `Mensaje a ${c.name}…`;
  $('composer-context').textContent = c ? `${n.nick || p.nick} · ${n.state === 'connected' ? 'Conectado' : n.state === 'connecting' ? 'Conectando…' : 'Desconectado'}` : 'Conecta una red para empezar a conversar';
  $('transport-label').textContent = p ? (p.tls ? n.state === 'connected' ? '◈ TLS verificado' : '◈ TLS activado' : '⚠ Conexión sin cifrar') : 'IRC · Tu próximo espacio';
  const connected = [...networks.values()].filter(n => n.state === 'connected').length;
  $('self-nick').textContent = n?.nick || 'Tu espacio IRC'; $('connection-summary').textContent = connected ? `${connected} ${connected === 1 ? 'red conectada' : 'redes conectadas'}` : 'Sin conexión';
  for (const id of ['global-status','footer-dot']) $(id).className = 'status-dot' + (connected ? ' online' : n?.state === 'connecting' ? ' connecting' : '');
  $('footer-status').textContent = n?.state === 'connecting' ? `Conectando a ${p.name}…` : connected ? `${connected} ${connected === 1 ? 'red conectada' : 'redes conectadas'}${p ? ' · ' + p.name : ''}` : 'Listo para conectar';
}
function render(preserveScroll = false) { renderSidebar(); renderTabs(); renderHeader(); renderMessages(preserveScroll); renderUsers(); }
function openSettings(section = 'networks') {
  for (const node of document.querySelectorAll('[data-panel]')) node.hidden = node.dataset.panel !== section;
  for (const node of document.querySelectorAll('[data-section]')) node.classList.toggle('selected', node.dataset.section === section);
  renderProfiles(); applySettings(); if (!$('settings-dialog').open) $('settings-dialog').showModal();
}
function renderProfiles() {
  const list = $('profile-list'); list.replaceChildren();
  if (!config.profiles.length) list.append(el('p', 'muted', 'Todavía no has añadido ninguna red.'));
  for (const p of config.profiles) {
    const card = el('article', 'profile-card'), header = el('header'), actions = el('div', 'profile-actions');
    header.append(el('strong', '', p.name), el('span', 'status-dot' + (network(p.id).state === 'connected' ? ' online' : '')));
    card.append(header, el('p', '', `${p.host}:${p.port} · ${p.nick} · ${p.tls ? 'TLS' : 'Sin TLS'}`));
    const edit = el('button', '', 'Editar'); edit.onclick = () => openNetwork(p.id);
    const connect = el('button', '', network(p.id).state === 'disconnected' ? 'Conectar' : 'Desconectar'); connect.onclick = async () => { await toggleConnection(p.id); renderProfiles(); };
    const remove = el('button', 'danger', 'Eliminar'); remove.onclick = async () => {
      if (network(p.id).state !== 'disconnected') { notify('Desconecta la red antes de eliminarla.', true); return; }
      if (!window.confirm(`¿Eliminar la red «${p.name}» y sus conversaciones de esta sesión?`)) return;
      config.profiles = config.profiles.filter(item => item.id !== p.id); passwords.delete(p.id); networks.delete(p.id);
      if (active?.id === p.id) active = config.profiles.length ? { id: config.profiles[0].id, target: '*' } : null;
      await persist(); renderProfiles(); render();
    };
    actions.append(edit, connect, remove); card.append(actions); list.append(card);
  }
}
function openNetwork(id) {
  const p = id && profile(id); $('network-form').reset(); $('profile-id').value = p?.id || '';
  $('network-dialog-title').textContent = p ? 'Editar red' : 'Añadir una red';
  for (const key of ['name','host','nick','port']) $('profile-' + key).value = p?.[key] ?? (key === 'port' ? 6697 : '');
  $('profile-channels').value = p?.channels.join(', ') || ''; $('profile-tls').checked = p?.tls ?? true; $('profile-password').value = ''; $('network-error').textContent = '';
  if (!$('network-dialog').open) $('network-dialog').showModal(); $('profile-name').focus();
}
async function toggleConnection(id = active?.id) {
  if (!id) { openNetwork(); return; }
  const n = network(id);
  if (n.state !== 'disconnected') { const r = await api.disconnect(id); if (r?.error) notify(r.error, true); return; }
  try { await persist(); } catch { return; }
  n.state = 'connecting'; render();
  const result = await api.connect({ id, password: passwords.get(id) || '' }); passwords.delete(id);
  if (result?.error) { n.state = 'disconnected'; addMessage(id, '*', { event: true, error: true, text: result.error }); notify(result.error, true); render(); }
}
function openJoin() {
  if (!active || network(active.id).state !== 'connected') { notify('Conecta una red antes de entrar en una sala.', true); return; }
  $('join-channel').value = ''; $('join-error').textContent = ''; $('join-dialog').showModal(); $('join-channel').focus();
}
function info(title, lines) {
  $('info-title').textContent = title; $('info-content').replaceChildren();
  for (const line of lines) $('info-content').append(el('p', 'info-lines', line));
  $('info-dialog').showModal();
}
const actions = {
  'add-network': () => openNetwork(), settings: () => openSettings('appearance'), networks: () => openSettings(),
  'toggle-users': () => { config.settings.showUsers = !config.settings.showUsers; applySettings(); persist().catch(() => {}); },
  connection: () => toggleConnection(), join: () => openJoin(),
  logs: async () => { const r = await api.logs(); if (r?.error) notify(r.error, true); }, quit: () => api.quit(),
  help: () => info('Comandos y atajos', ['/join #sala · /part · /nick apodo · /me acción', '/msg apodo mensaje · /whois apodo · /topic texto · /quit', 'Para enviar un mensaje que empieza por /, escribe // al principio.', 'Ctrl+N: nueva red · Ctrl+J: entrar en sala · Ctrl+U: ocultar usuarios · Ctrl+,: configuración.', 'Las salas aparecen como pestañas arriba. Arrastra el borde izquierdo de la conversación para ajustar la barra lateral.']),
  about: () => info('HexDroid Dreams', ['Versión ' + ($('version').textContent) + ' · Cliente IRC para Windows.', 'Una implementación nueva e independiente, inspirada en HexDroid. Esta primera versión admite varias redes, TLS, salas y mensajes privados.', 'Todavía no incluye SASL/NickServ automático, cifrado de extremo a extremo, DCC, scripts ni historial persistente.'])
};
document.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (button) { for (const menu of document.querySelectorAll('.menu[open]')) menu.open = false; Promise.resolve(actions[button.dataset.action]?.()).catch(e => notify(e.message, true)); }
  const close = event.target.closest('[data-close]'); if (close) $(close.dataset.close).close();
  const section = event.target.closest('[data-section]'); if (section) openSettings(section.dataset.section);
  if (!event.target.closest('.menu')) for (const menu of document.querySelectorAll('.menu[open]')) menu.open = false;
});
document.querySelectorAll('.menu').forEach(menu => menu.addEventListener('toggle', () => { if (menu.open) for (const other of document.querySelectorAll('.menu')) if (other !== menu) other.open = false; }));
$('network-form').addEventListener('submit', async event => {
  event.preventDefault(); const host = $('profile-host').value.trim(), nick = $('profile-nick').value.trim();
  if (!host || /[\s\0\r\n:,]/.test(host) || !/^[^\s\0\r\n:,]+$/.test(nick)) { $('network-error').textContent = 'Revisa el servidor y el apodo: no pueden contener espacios ni dos puntos.'; return; }
  const channels = [...new Set($('profile-channels').value.trim().split(/[\s,]+/).filter(Boolean))];
  if (channels.some(c => !/^[#&+!][^\s:,]+$/.test(c)) || channels.length > 30) { $('network-error').textContent = 'Introduce hasta 30 salas, empezando por #, &, + o !.'; return; }
  if (!$('profile-id').value && config.profiles.length >= 30) { $('network-error').textContent = 'Esta versión admite hasta 30 redes.'; return; }
  const id = $('profile-id').value || crypto.randomUUID();
  const p = { id, name: $('profile-name').value.trim() || host, host, port: Number($('profile-port').value), nick, tls: $('profile-tls').checked, channels };
  const previous = config.profiles.findIndex(p => p.id === id); if (previous < 0) config.profiles.push(p); else config.profiles[previous] = p;
  const password = $('profile-password').value;
  try { await persist(); } catch (e) { $('network-error').textContent = e.message; return; }
  if (password) passwords.set(id, password); $('profile-password').value = '';
  if (network(id).state === 'disconnected') network(id).nick = nick;
  $('network-dialog').close(); choose(id, '*'); if ($('settings-dialog').open) renderProfiles();
  if (event.submitter?.value === 'connect') { if (network(id).state === 'disconnected') await toggleConnection(id); else notify('Red guardada. Desconecta y vuelve a conectar para aplicar los cambios.'); }
});
$('profile-tls').addEventListener('change', () => { const p = $('profile-port'); if (p.value === '6697' || p.value === '6667') p.value = $('profile-tls').checked ? '6697' : '6667'; });
$('network-dialog').addEventListener('close', () => { $('profile-password').value = ''; });
$('join-form').addEventListener('submit', async event => {
  event.preventDefault(); if (!active) return;
  let target = $('join-channel').value.trim(); if (!/^[#&+!]/.test(target)) target = '#' + target;
  const result = await api.send({ id: active.id, target: '*', text: '/join ' + target });
  if (result?.error) { $('join-error').textContent = result.error; return; }
  $('join-dialog').close(); // Wait for the server's JOIN before showing a joined room.
});
$('composer').addEventListener('submit', async event => {
  event.preventDefault(); if (!active) return;
  const text = $('message-input').value; if (!text.trim()) return;
  if (active.target === '*' && !text.startsWith('/')) { notify('En la pestaña de red usa /join #sala o /msg apodo mensaje.', true); return; }
  const result = await api.send({ ...active, text });
  if (result?.error) notify(result.error, true); else if ($('message-input').value === text) $('message-input').value = '';
});
$('search').addEventListener('input', renderSidebar);
$('new-messages').onclick = () => { $('messages').scrollTop = $('messages').scrollHeight; $('new-messages').hidden = true; };
$('messages').addEventListener('scroll', () => { const list = $('messages'); if (list.scrollHeight - list.scrollTop - list.clientHeight < 70) $('new-messages').hidden = true; });
for (const key of ['compact','timestamps','showUsers','showEvents','autoScroll']) $('setting-' + key).onchange = () => { config.settings[key] = $('setting-' + key).checked; applySettings(); renderMessages(true); persist().catch(() => {}); };
$('setting-font').onchange = () => { config.settings.fontSize = Number($('setting-font').value); applySettings(); renderMessages(true); persist().catch(() => {}); };
$('setting-sidebar').oninput = () => { config.settings.sidebarWidth = Number($('setting-sidebar').value); applySettings(); };
$('setting-sidebar').onchange = () => persist().catch(() => {});
const resizer = $('sidebar-resizer'); let dragging = false;
resizer.addEventListener('pointerdown', event => { dragging = true; resizer.setPointerCapture(event.pointerId); document.body.classList.add('dragging'); });
resizer.addEventListener('pointermove', event => { if (!dragging) return; config.settings.sidebarWidth = Math.round(Math.max(160, Math.min(420, event.clientX))); applySettings(); });
function stopDrag() { if (dragging) { dragging = false; document.body.classList.remove('dragging'); persist().catch(() => {}); } }
resizer.addEventListener('pointerup', stopDrag); resizer.addEventListener('pointercancel', stopDrag); resizer.addEventListener('lostpointercapture', stopDrag);
resizer.addEventListener('keydown', event => { if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return; event.preventDefault(); config.settings.sidebarWidth = event.key === 'Home' ? 160 : event.key === 'End' ? 420 : Math.max(160, Math.min(420, config.settings.sidebarWidth + (event.key === 'ArrowLeft' ? -10 : 10))); applySettings(); persist().catch(() => {}); });
document.addEventListener('keydown', event => {
  if (!event.ctrlKey || event.altKey) return;
  const key = event.key.toLowerCase(), map = { n: 'add-network', j: 'join', u: 'toggle-users', ',': 'settings' };
  if (!map[key]) return; event.preventDefault();
  if (document.querySelector('dialog[open]') && key !== ',') return;
  Promise.resolve(actions[map[key]]()).catch(e => notify(e.message, true));
});
api.onEvent(event => {
  if (!profile(event.id)) return;
  const n = network(event.id), id = event.id;
  switch (event.type) {
    case 'status':
      n.state = event.state; if (event.nick) n.nick = event.nick;
      addMessage(id, '*', { event: true, text: event.text });
      if (event.state === 'disconnected') for (const c of n.conversations.values()) { c.joined = false; c.users = []; }
      break;
    case 'problem': addMessage(id, '*', { event: true, error: true, text: event.text }); notify(event.text, true); break;
    case 'server': addMessage(id, '*', { event: true, text: event.text }); break;
    case 'message': addMessage(id, event.target && event.target !== '*' ? event.target : '*', event); break;
    case 'users': conversation(id, event.target).users = event.users; break;
    case 'topic': conversation(id, event.target).topic = event.text; break;
    case 'channel': {
      if (!n.conversations.has(fold(event.target)) && event.action !== 'join') break;
      const c = conversation(id, event.target);
      if (event.own) { c.joined = event.action === 'join'; if (!c.joined) c.users = []; }
      const verb = { join: 'ha entrado en la sala', part: 'ha salido de la sala', quit: 'se ha desconectado', kick: 'ha sido expulsado' }[event.action];
      addMessage(id, event.target, { event: true, text: event.nick + ' ' + verb });
      if (event.own && event.action === 'join') active = { id, target: event.target };
      break;
    }
    case 'nick': {
      if (event.own) n.nick = event.nick;
      const old = n.conversations.get(fold(event.old));
      if (old && !/^[#&+!]/.test(old.name)) {
        const existing = n.conversations.get(fold(event.nick)); n.conversations.delete(fold(event.old));
        old.name = event.nick;
        if (existing && existing !== old) { old.messages = [...old.messages, ...existing.messages].sort((a,b) => a.time.localeCompare(b.time)).slice(-600); old.unread += existing.unread; }
        n.conversations.set(fold(event.nick), old);
        if (active?.id === id && fold(active.target) === fold(event.old)) active.target = event.nick;
      }
      break;
    }
  }
  render(true);
  if ($('settings-dialog').open) renderProfiles();
});
(async () => {
  try {
    const result = await api.load(); if (result.error) throw new Error(result.error);
    config = { profiles: result.profiles, settings: result.settings };
    $('version').textContent = result.version || '0.1.0';
    if (config.profiles.length) active = { id: config.profiles[0].id, target: '*' };
    applySettings(); render();
    if (result.warnings?.length) notify(result.warnings.join(' '), true);
  } catch (error) { notify('No se pudo iniciar la interfaz: ' + error.message, true); }
})();
