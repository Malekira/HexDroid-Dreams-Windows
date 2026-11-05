'use strict';
const $ = id => document.getElementById(id);
const api = window.dreams;
let appVersion = '0.2.0';
let config = { settings: {}, profiles: [] }, active = null, toastTimer, saveQueue = Promise.resolve();
let workspace = new DreamsWorkspace.Workspace();
let networks = workspace.networks;
const selectedMessages = new Set();
let framePending = false, lastMessageView = '', draggedItem = null, settingsSection = 'appearance', pendingAction = null;
const contextMenu = new DreamsDesktop.ContextMenu($('context-menu'), error => notify(error.message, true));
const passwords = new Map();
function fold(s) { return String(s).toLowerCase().replace(/[\[\]\\^]/g, c => ({ '[': '{', ']': '}', '\\': '|', '^': '~' })[c]); }
function el(tag, className, text) { const n = document.createElement(tag); if (className) n.className = className; if (text !== undefined) n.textContent = text; return n; }
function network(id) { return workspace.network(id); }
function conversation(id, name = '*') { return workspace.conversation(id,name); }
function selected() { return active ? conversation(active.id, active.target) : null; }
function profile(id) { return config.profiles.find(p => p.id === id); }
function notify(text, error = false) {
  $('toast').textContent = text; $('toast').classList.toggle('error', error); $('toast').hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, error ? 9000 : 4000);
}
function persist() {
  workspace.profiles = config.profiles; workspace.active = active;
  const snapshot = structuredClone({ ...config, workspace:workspace.serialize() });
  saveQueue = saveQueue.catch(() => {}).then(async () => {
    const result = await api.save(snapshot);
    if (result?.error) { $('settings-feedback').textContent = 'No se pudo guardar. Vuelve a intentarlo.'; notify(result.error, true); throw new Error(result.error); }
    $('settings-feedback').textContent = 'Cambios guardados.';
  });
  return saveQueue;
}
function applySettings() {
  const s = config.settings, sizes = DreamsWorkspace.panelSizes(innerWidth,s);
  const root = document.documentElement.style;
  root.setProperty('--sidebar-width', sizes.left + 'px'); root.setProperty('--users-width', sizes.right + 'px');
  root.setProperty('--font-size', s.fontSize + 'px'); root.setProperty('--chat-font', s.fontFamily);
  root.setProperty('--chat-line-height',s.lineHeight); root.setProperty('--message-spacing',s.messageSpacing + 'px'); root.setProperty('--own-nick-color',s.ownNickColor);
  $('sidebar-resizer').setAttribute('aria-valuenow',String(sizes.left)); $('users-resizer').setAttribute('aria-valuenow',String(sizes.right));
  document.body.classList.toggle('compact',s.compact);
  $('private-panel').hidden = !s.showPrivates; $('sidebar-resizer').hidden = !s.showPrivates;
  $('users-panel').hidden = !s.showUsers; $('users-resizer').hidden = !s.showUsers;
  for (const [id, key, noun] of [['users-toggle','showUsers','usuarios'],['privates-toggle','showPrivates','privados']]) {
    $(id).setAttribute('aria-pressed',String(s[key])); $(id).setAttribute('aria-label',(s[key] ? 'Ocultar ' : 'Mostrar ') + noun);
  }
  $('private-sort').value = s.privateSort;
  for (const [id,key] of [['font','fontSize'],['sidebar','sidebarWidth'],['usersWidth','usersWidth'],['fontFamily','fontFamily'],['lineHeight','lineHeight'],['messageSpacing','messageSpacing'],['ownNickColor','ownNickColor']]) $('setting-' + id).value = String(s[key]);
  for (const key of ['compact','timestamps','showPrivates','showUsers','showTopic','showEvents','autoScroll']) $('setting-' + key).checked = s[key];
}
function captureConversation() {
  const c = selected(); if (!c) return;
  c.draft = $('message-input').value;
  if (!$('message-search').value) c.scrollTop = $('messages').scrollTop;
}
function choose(id,target,focus = true) {
  captureConversation(); if (active) network(active.id).lastTarget = active.target;
  active = { id,target }; workspace.choose(id,target); selectedMessages.clear(); $('selection-count').textContent = '';
  $('message-input').value = conversation(id,target).draft; $('message-search').value = '';
  render(); previewFormat(); if (focus && !$('message-input').disabled) $('message-input').focus();
  persist().catch(() => {});
}
function addMessage(id,target,message) {
  workspace.active = active;
  if (!config.settings.autoScroll && !message.own && active?.id === id && fold(active.target) === fold(target)) conversation(id,target).follow = false;
  workspace.addMessage(id,target,message);
}
function dragOrder(node,id,target) {
  node.draggable = true;
  node.addEventListener('dragstart',e => { draggedItem = { id,target }; e.dataTransfer.setData('text/plain',target); e.dataTransfer.effectAllowed = 'move'; });
  node.addEventListener('dragover',e => { if (draggedItem?.id === id && DreamsWorkspace.kind(draggedItem.target) === DreamsWorkspace.kind(target)) { e.preventDefault(); node.classList.add('drag-over'); } });
  node.addEventListener('dragleave',() => node.classList.remove('drag-over'));
  node.addEventListener('drop',e => { e.preventDefault(); const item = draggedItem; draggedItem = null; node.classList.remove('drag-over'); if (item?.id === id && workspace.move(id,item.target,target)) { if (DreamsWorkspace.kind(target) === 'private') config.settings.privateSort = 'manual'; persist().catch(() => {}); render(); } });
  node.addEventListener('dragend',() => { draggedItem = null; renderSidebar(); renderTabs(); });
}
function renderSidebar() {
  const picker = $('network-select'); picker.replaceChildren();
  for (const p of config.profiles) {
    const n = network(p.id), unread = [...n.conversations.values()].reduce((sum,c) => sum + c.unread,0);
    const option = el('option','',p.name + (unread ? ` (${unread})` : '')); option.value = p.id; picker.append(option);
  }
  if (!config.profiles.length) picker.append(el('option','','Sin redes')); else picker.value = active?.id || config.profiles[0].id;
  picker.disabled = !config.profiles.length;
  if (draggedItem) return;
  const list = $('network-list'); list.replaceChildren();
  const query = fold($('search').value), n = active && network(active.id);
  let entries = n ? [...n.conversations.values()].filter(c => c.kind === 'private' && fold(c.name).includes(query)) : [];
  if (config.settings.privateSort === 'alphabetical') entries.sort((a,b) => a.name.localeCompare(b.name));
  if (config.settings.privateSort === 'unread') entries.sort((a,b) => b.unread - a.unread || a.name.localeCompare(b.name));
  if (!entries.length) list.append(el('p','empty-networks',query ? 'No hay privados que coincidan.' : 'Los mensajes privados aparecerán aquí. Doble clic en un usuario para iniciar uno.'));
  for (const c of entries) {
    const id = active.id, row = el('div','conversation' + (fold(active.target) === fold(c.name) ? ' active' : '') + (c.unread && !c.muted ? ' has-activity' : '') + (c.mentions && !c.muted ? ' has-mention' : '') + (c.muted ? ' is-muted' : ''));
    const b = el('button','conversation-name'); b.setAttribute('aria-label','Privado ' + c.name); b.append(el('span','symbol','◌'),el('span','label',c.name));
    if (c.muted) b.append(el('span','muted-symbol','◦'));
    if (c.unread) b.append(el('span','badge' + (c.mentions && !c.muted ? ' mention' : ''),c.unread > 99 ? '99+' : String(c.unread)));
    b.onclick = () => choose(id,c.name);
    const close = el('button','close-private','×'); close.setAttribute('aria-label','Cerrar privado ' + c.name); close.onclick = () => closeConversation(id,c.name);
    row.append(b,close); row.oncontextmenu = e => conversationMenu(e,id,c); dragOrder(row,id,c.name); list.append(row);
  }
}
function renderTabs() {
  if (draggedItem) return;
  const tabs = $('room-tabs'); tabs.replaceChildren();
  const channels = active ? [...network(active.id).conversations.values()].filter(c => c.kind === 'channel') : [];
  if (!channels.length) tabs.append(el('span','empty-tabs','Sin canales abiertos · usa + para entrar en una sala'));
  for (const c of channels) {
    const id = active.id, selected = fold(c.name) === fold(active.target), tab = el('div','room-tab' + (selected ? ' selected' : '') + (c.mentions && !c.muted ? ' has-mention' : '') + (c.muted ? ' is-muted' : ''));
    const button = el('button','',c.name); button.setAttribute('role','tab'); button.setAttribute('aria-label',c.name); button.setAttribute('aria-selected',String(selected)); button.tabIndex = selected ? 0 : -1;
    if (c.unread) button.append(el('span','badge' + (c.mentions && !c.muted ? ' mention' : ''),String(c.unread)));
    button.onclick = () => choose(id,c.name); tab.append(button);
    const close = el('button','close-tab','×'); close.setAttribute('aria-label','Cerrar ' + c.name); close.onclick = () => closeConversation(id,c.name); tab.append(close);
    tab.oncontextmenu = e => conversationMenu(e,id,c); dragOrder(tab,id,c.name); tabs.append(tab);
  }
}
async function closeConversation(id, target) {
  const c = conversation(id, target);
  if (c.joined && network(id).state === 'connected') {
    const result = await api.send({ id, target, text: '/part' }); if (result?.error) { notify(result.error, true); return; }
  }
  const cWasActive = active?.id === id && fold(active.target) === fold(target);
  network(id).conversations.delete(fold(target));
  if (cWasActive) { active = null; choose(id,'*'); } else render();
  persist().catch(() => {});
}
function renderMessages(preserveScroll = false) {
  const list = $('messages'), c = selected(), query = fold($('message-search').value);
  list.hidden = !c; $('welcome').hidden = !!c;
  if (!c) { list.replaceChildren(); lastMessageView = ''; return; }
  const signature = JSON.stringify([c.revision,c.messages.at(-1)?.pending,c.messages.at(-1)?.failed,c.messages.at(-1)?.messageId,active.id,fold(c.name),c.messages.length,c.messages.at(-1)?.id,query,config.settings.timestamps,config.settings.showEvents,c.muted]);
  if (preserveScroll && signature === lastMessageView) return;
  const anchor = [...list.querySelectorAll('[data-message-id]')].find(row => row.offsetTop + row.offsetHeight > list.scrollTop);
  const anchorId = anchor?.dataset.messageId, anchorOffset = anchor ? anchor.offsetTop - list.scrollTop : 0;
  lastMessageView = signature; list.replaceChildren();
  const visible = c.messages.filter(m => (!m.event || config.settings.showEvents || m.error) && (!query || fold(DreamsFormatting.plain(m.text) + ' ' + (m.nick || '')).includes(query)));
  $('search-count').textContent = query ? `${visible.length} resultados` : '';
  if (!visible.length) list.append(el('div','event-message',query ? 'No hay mensajes que coincidan.' : c.kind === 'server' ? 'Conecta esta red para ver su actividad.' : 'Este es el comienzo de la conversación.'));
  let day = '';
  for (const m of visible) {
    const date = new Date(m.time), valid = !Number.isNaN(date.valueOf());
    const label = valid ? date.toLocaleDateString('es',{day:'numeric',month:'long',year:'numeric'}) : '';
    if (label && label !== day) { day = label; list.append(el('div','message-day',label)); }
    const time = el('time','',valid ? date.toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'}) : ''); if (valid) time.dateTime = date.toISOString();
    const row = el(m.event ? 'div' : 'article',m.event ? 'event-message' + (m.error ? ' error' : '') : 'message' + (m.own ? ' own' : '') + (m.action ? ' action' : '') + (m.notice ? ' notice' : '') + (m.mention && !c.muted ? ' mention' : '') + (selectedMessages.has(m.id) ? ' selected' : ''));
    row.dataset.messageId = m.id;
    if (m.event) { if (config.settings.timestamps) row.append(time); row.append(document.createTextNode(m.text)); }
    else {
      const avatar=el('span','avatar',(m.nick||'?').slice(0,2).toUpperCase()),src=network(active.id).avatars?.[fold(m.nick)];if(src){const img=el('img');img.src=src;img.alt=m.nick;avatar.replaceChildren(img);}row.append(avatar);
      const content = el('div','message-content'), header = el('div','message-header');
      const nick = el('button','message-nick',m.nick);if(!m.own){let hash=0;for(const ch of fold(m.nick))hash=(hash*31+ch.charCodeAt(0))|0;nick.style.color=`hsl(${Math.abs(hash)%360} 48% ${document.documentElement.dataset.theme==='light'?38:72}%)`;} nick.onclick = () => choose(active.id,m.nick); header.append(nick); if (config.settings.timestamps) header.append(time);
      const body = el('div','message-text'); DreamsFormatting.render(body,m.action ? '* ' + m.nick + ' ' + m.text : m.text); content.append(header,body);if(m.pending)content.append(el('small','delivery-state','Pendiente de confirmación'));if(m.failed)content.append(el('small','delivery-state','No se confirmó la entrega'));if(m.replyTo)content.prepend(el('small','reply-reference','↳ Respuesta a '+m.replyTo));if(m.reactions)content.append(el('small','reactions',Object.entries(m.reactions).map(([emoji,nicks])=>emoji+' '+nicks.join(', ')).join(' · '))); row.append(content);
    }
    row.oncontextmenu = e => messageMenu(e,m,row);
    row.addEventListener('click',e => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); e.stopPropagation(); toggleMessageSelection(m.id,row); } },true);
    list.append(row);
  }
  if (query) list.scrollTop = 0;
  else if (c.follow && config.settings.autoScroll) list.scrollTop = list.scrollHeight;
  else {
    const savedAnchor = preserveScroll && anchorId && [...list.querySelectorAll('[data-message-id]')].find(row => row.dataset.messageId === anchorId);
    list.scrollTop = savedAnchor ? savedAnchor.offsetTop - anchorOffset : c.scrollTop;
  }
  $('new-messages').hidden = c.follow || !c.unread;
  $('first-unread').disabled = !c.firstUnreadId;
}
function stripFormatting(text) { return DreamsFormatting.plain(text); }
function renderUsers() {
  const list = $('user-list'); list.replaceChildren(); const c = selected(), n = active && network(active.id), query = fold($('user-search').value);
  const rank = user => { const i = n.prefixes.indexOf(user[0]); return i < 0 ? 999 : i; };
  const users = [...(c?.users || [])].sort((a,b) => rank(a) - rank(b) || a.localeCompare(b));
  $('user-count').textContent = String(users.length);
  if (!users.length) { list.append(el('div','empty-users',c?.kind === 'channel' ? 'Los usuarios aparecerán al entrar en la sala.' : 'Selecciona una sala para ver sus usuarios.')); return; }
  for (const user of users.filter(user => fold(user).includes(query))) {
    const bare = bareNick(user,n), b = el('button','user-button' + (rank(user) < 999 ? ' operator' : ''));
    b.append(el('span','user-avatar',bare.slice(0,2).toUpperCase()),el('span','user-name',user));
    b.setAttribute('aria-label',user); b.title = 'Doble clic para abrir un privado con ' + bare;
    const id = active.id; b.ondblclick = () => choose(id,bare); b.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); choose(id,bare); } };
    b.oncontextmenu = e => userMenu(e,id,c,bare); list.append(b);
  }
}
function bareNick(user,n) { let i = 0; while (i < user.length && n.prefixes.includes(user[i])) i++; return user.slice(i); }
function renderHeader() {
  const p = active && profile(active.id), n = p && network(p.id), c = selected();
  const connection = n?.state !== 'disconnected' && n?.connection || p;
  $('conversation-title').textContent = c ? c.name === '*' ? p.name : c.name : 'Bienvenido a Dreams';
  $('channel-symbol').textContent = c ? c.name === '*' ? '◈' : /^[#&+!]/.test(c.name) ? '#' : '◌' : '✦';
  $('conversation-subtitle').hidden = !config.settings.showTopic;
  $('channel-modes').hidden = !c?.modes; $('channel-modes').textContent = c?.modes || '';
  $('server-button').disabled = !p;
  $('conversation-subtitle').textContent = c ? c.topic || (c.name === '*' ? `${connection.host}:${connection.port} · ${connection.tls ? 'TLS' : 'Sin TLS'}` : /^[#&+!]/.test(c.name) ? p.name + ' · Sala IRC' : p.name + ' · Mensaje privado') : 'Un lugar para todas tus conversaciones.';
  $('connection-button').disabled = !p;
  $('connection-button').textContent = n?.state === 'connected' ? 'Desconectar' : n?.state === 'connecting' ? 'Cancelar' : 'Conectar';
  $('join-button').disabled = n?.state !== 'connected';
  const canSend = n?.state === 'connected' && c && (c.name === '*' || !/^[#&+!]/.test(c.name) || c.joined);
  $('message-input').disabled = !canSend; $('send-button').disabled = !canSend;
  for (const button of document.querySelectorAll('.format-bar button')) button.disabled = !canSend;
  $('message-input').placeholder = !c ? 'Selecciona una conversación…' : !canSend ? 'Conecta la red y entra en la sala para escribir…' : c.name === '*' ? 'Escribe un comando, por ejemplo /join #general' : `Mensaje a ${c.name}…`;
  $('composer-context').textContent = c ? `${n.nick || p.nick} · ${n.state === 'connected' ? 'Conectado' : n.state === 'connecting' ? 'Conectando…' : 'Desconectado'}` : 'Conecta una red para empezar a conversar';
  $('transport-label').textContent = p ? (connection.tls ? n.state === 'connected' ? '◈ TLS verificado' : '◈ TLS activado' : '⚠ Conexión sin cifrar') : 'IRC · Tu próximo espacio';
  const connected = [...networks.values()].filter(n => n.state === 'connected').length;
  $('self-nick').textContent = n?.nick || 'Tu espacio IRC'; $('connection-summary').textContent = connected ? `${connected} ${connected === 1 ? 'red conectada' : 'redes conectadas'}` : 'Sin conexión';
  for (const id of ['global-status','footer-dot']) $(id).className = 'status-dot' + (connected ? ' online' : n?.state === 'connecting' ? ' connecting' : '');
  $('footer-info').textContent = p ? `${connection.host}:${connection.port} · Usuarios: ${c?.users.length || 0} · ${connection.tls ? 'TLS' : 'TCP'}` : 'HexDroid Dreams ' + appVersion;
  $('first-unread').disabled = !c?.firstUnreadId;
  $('new-messages').hidden = !c || c.follow || !c.unread;
  $('footer-status').textContent = n?.state === 'connecting' ? `Conectando a ${p.name}…` : connected ? `${connected} ${connected === 1 ? 'red conectada' : 'redes conectadas'}${p ? ' · ' + p.name : ''}` : 'Listo para conectar';
}
function render(preserveScroll = false) { renderSidebar(); renderTabs(); renderHeader(); renderMessages(preserveScroll); renderUsers(); }
function scheduleRender() { if (!framePending) { framePending = true; requestAnimationFrame(() => { framePending = false; render(true); }); } }
function togglePanel(key) { config.settings[key] = !config.settings[key]; applySettings(); persist().catch(() => {}); }
function goLatest() {
  const c = selected(); if (!c) return;
  c.follow = true; c.unread = 0; c.mentions = 0; c.firstUnreadId = null; $('message-search').value = '';
  renderMessages(); $('messages').scrollTop = $('messages').scrollHeight; $('new-messages').hidden = true; renderHeader(); renderSidebar(); renderTabs();
}
function goFirstUnread() {
  const c = selected(); if (!c?.firstUnreadId) return;
  $('message-search').value = ''; c.follow = false; renderMessages();
  const row = [...$('messages').querySelectorAll('[data-message-id]')].find(row => row.dataset.messageId === c.firstUnreadId);
  if (row) { row.scrollIntoView({ block:'center' }); row.classList.add('focus-message'); }
  else notify('Ese mensaje ya no está en el historial en memoria.');
}
function cycleChannel(direction) {
  if (!active) return;
  const channels = [...network(active.id).conversations.values()].filter(c => c.kind === 'channel'); if (!channels.length) return;
  const i = channels.findIndex(c => fold(c.name) === fold(active.target));
  choose(active.id,channels[i < 0 ? direction > 0 ? 0 : channels.length - 1 : (i + direction + channels.length) % channels.length].name);
}
function toggleMessageSelection(id,row) {
  if (selectedMessages.has(id)) selectedMessages.delete(id); else selectedMessages.add(id);
  row.classList.toggle('selected',selectedMessages.has(id)); $('selection-count').textContent = selectedMessages.size ? `${selectedMessages.size} seleccionados · Ctrl+C` : '';
}
async function copyText(text) { const result = await api.copy(text); if (result?.error) throw new Error(result.error); }
function printable(m) { return `${m.time} ${m.nick ? '<' + m.nick + '> ' : ''}${stripFormatting(m.text)}`; }
function copyMessages() { return copyText(selected().messages.filter(m => selectedMessages.has(m.id)).map(printable).join('\n')); }
function messageMenu(event,m,row) {
  const selection = document.getSelection()?.toString();
  contextMenu.show(event,m.nick || 'Mensaje del servidor',[
    ...(selection ? [{ label:'Copiar texto seleccionado',action:() => copyText(selection) }] : []),
    { label:'Copiar mensaje',action:() => copyText(printable(m)) },
    ...(api.advanced&&m.messageId&&network(active.id).capabilities?.includes('message-tags') ? [
      {label:'Responder',action:()=>askAction('Responder a '+m.nick,'Respuesta','',text=>advancedMessage('reply',m,{text}))},
      {label:'Reaccionar',action:()=>askAction('Reaccionar','Emoji','👍',emoji=>advancedMessage('reaction',m,{emoji}))},
      ...(m.own&&network(active.id).capabilities.includes('draft/message-redaction')?[{label:'Eliminar del servidor',action:()=>advancedMessage('redact',m)}]:[])
    ]:[]),
    ...(api.advanced&&/https?:\/\/[^\s]+/.test(m.text)?[{label:'Abrir primer enlace',action:()=>advancedMessage('link.open',m,{url:m.text.match(/https?:\/\/[^\s]+/)[0]})}]:[]),
    { label:selectedMessages.has(m.id) ? 'Deseleccionar mensaje' : 'Seleccionar mensaje',action:() => toggleMessageSelection(m.id,row) },
    { label:'Copiar mensajes seleccionados',disabled:!selectedMessages.size,action:copyMessages }
  ]);
}
async function advancedMessage(action,m,extra={}){const r=await api.advanced(action,{network:active.id,target:active.target,messageId:m.messageId,...extra});if(r?.error)throw new Error(r.error);}
async function sendCommand(id,target,text) { const r = await api.send({ id,target,text }); if (r?.error) throw new Error(r.error); }
function askAction(title,prompt,value,action) {
  pendingAction = action; $('action-title').textContent = title; $('action-prompt').textContent = prompt;
  $('action-input').value = value || ''; $('action-error').textContent = ''; $('action-dialog').showModal(); $('action-input').focus();
}
$('action-form').onsubmit = async e => {
  e.preventDefault(); try { await pendingAction?.($('action-input').value.trim()); $('action-dialog').close(); } catch (error) { $('action-error').textContent = error.message; }
};
$('action-dialog').addEventListener('close',() => { pendingAction = null; $('action-input').value = ''; });
function conversationMenu(event,id,c) {
  const sameKind = [...network(id).conversations.values()].filter(item => item.kind === c.kind), index = sameKind.indexOf(c);
  const move = direction => {
    if (direction < 0 && index > 0) workspace.move(id,c.name,sameKind[index - 1].name);
    else if (direction > 0 && index < sameKind.length - 1) workspace.move(id,sameKind[index + 1].name,c.name);
    config.settings.privateSort = 'manual'; applySettings(); persist().catch(() => {}); render();
  };
  contextMenu.show(event,c.name,[
    { label:'Abrir conversación',action:() => choose(id,c.name) },
    { label:'Marcar como leído',action:() => { c.unread = 0; c.mentions = 0; c.firstUnreadId = null; render(); } },
    { label:c.muted ? 'Activar resaltado de actividad' : 'Silenciar resaltado de actividad',action:() => { c.muted = !c.muted; persist().catch(() => {}); render(); } },
    null,
    { label:c.kind === 'channel' ? 'Mover pestaña a la izquierda' : 'Mover arriba',disabled:index <= 0,action:() => move(-1) },
    { label:c.kind === 'channel' ? 'Mover pestaña a la derecha' : 'Mover abajo',disabled:index >= sameKind.length - 1,action:() => move(1) },
    ...(c.kind === 'channel' ? [
      { label:'Entrar de nuevo en el canal',disabled:c.joined || network(id).state !== 'connected',action:() => sendCommand(id,'*','/join ' + c.name) },
      { label:'Editar topic',disabled:!c.joined,action:() => askAction('Editar topic','Nuevo topic',c.topic,value => sendCommand(id,c.name,'/topic ' + value)) }
    ] : [{ label:'WHOIS',disabled:network(id).state !== 'connected',action:async () => { await sendCommand(id,c.name,'/whois ' + c.name); choose(id,'*'); } }]),
    null,{ label:c.kind === 'channel' ? 'Cerrar canal' : 'Cerrar privado',action:() => closeConversation(id,c.name) }
  ]);
}
function userMenu(event,id,c,nick) {
  const n = network(id), connected = n.state === 'connected';
  const own = c.users.find(user => fold(bareNick(user,n)) === fold(n.nick)) || '';
  const ownSymbols = own.slice(0,own.length - bareNick(own,n).length);
  const hasMode = modes => [...ownSymbols].some(symbol => modes.includes(n.prefixModes[n.prefixes.indexOf(symbol)]));
  const operator = connected && hasMode('oaq'), moderator = connected && hasMode('hoaq');
  contextMenu.show(event,nick,[
    { label:'Abrir privado',action:() => choose(id,nick) },
    ...(api.advanced?[{label:'Ignorar usuario',action:()=>sendCommand(id,c.name,'/ignore '+nick)},{label:'Dejar de ignorar',action:()=>sendCommand(id,c.name,'/unignore '+nick)}]:[]),
    ...(api.advanced&&n.capabilities?.includes('draft/metadata-2')?[{label:'Cargar avatar publicado',action:async()=>{const r=await api.advanced('avatar.preview',{network:id,nick});if(r?.error)throw new Error(r.error);if(r.image){n.avatars||={};n.avatars[fold(nick)]=r.image;render();}else if(r.pending)notify('Avatar solicitado. Vuelve a elegir Cargar avatar cuando llegue la respuesta.');}}]:[]),
    { label:'WHOIS',disabled:!connected,action:async () => { await sendCommand(id,c.name,'/whois ' + nick); choose(id,'*'); } },
    { label:'WHO',disabled:!connected,action:async () => { await sendCommand(id,c.name,'/who ' + nick); choose(id,'*'); } },
    { label:'Invitar a un canal…',disabled:!connected,action:() => askAction('Invitar a ' + nick,'Canal de destino',c.name,value => { if (!/^[#&+!][^\s,:]+$/.test(value)) throw new Error('Introduce un canal válido.'); return sendCommand(id,value,'/invite ' + nick); }) },
    null,
    {label:'Consultar bans',disabled:!connected,action:()=>sendCommand(id,c.name,'/mode '+c.name+' +b')},
    {label:'Consultar excepciones',disabled:!connected,action:()=>sendCommand(id,c.name,'/mode '+c.name+' +e')},
    {label:'Aplicar ban…',disabled:!moderator,action:()=>askAction('Aplicar ban','Máscara',nick+'!*@*',mask=>sendCommand(id,c.name,'/ban '+mask))},
    {label:'Kick y ban…',disabled:!moderator,action:()=>askAction('Expulsar y bloquear','Motivo','Expulsado',reason=>sendCommand(id,c.name,'/kickban '+nick+' '+reason))},
    ...(n.prefixModes.includes('h')?[{label:'Dar halfop',disabled:!operator,action:()=>sendCommand(id,c.name,'/mode '+c.name+' +h '+nick)},{label:'Quitar halfop',disabled:!operator,action:()=>sendCommand(id,c.name,'/mode '+c.name+' -h '+nick)}]:[]),
    { label:'Expulsar del canal…',disabled:!moderator,action:() => askAction('Expulsar a ' + nick,'Motivo','Expulsado',value => sendCommand(id,c.name,`/kick ${nick} ${value}`)) },
    ...(n.prefixModes.includes('v') ? [
      { label:'Dar voz',disabled:!operator,action:() => sendCommand(id,c.name,'/voice ' + nick) },
      { label:'Quitar voz',disabled:!operator,action:() => sendCommand(id,c.name,'/devoice ' + nick) }
    ] : []),
    ...(n.prefixModes.includes('o') ? [
      { label:'Dar operador',disabled:!operator,action:() => sendCommand(id,c.name,'/op ' + nick) },
      { label:'Quitar operador',disabled:!operator,action:() => sendCommand(id,c.name,'/deop ' + nick) }
    ] : [])
  ]);
}
function previewFormat() {
  const input = $('message-input'), preview = $('format-preview'); preview.hidden = !/[\x02\x03\x04\x0f\x11\x16\x1b\x1d-\x1f]/.test(input.value);
  if (!preview.hidden) DreamsFormatting.render(preview,input.value);
}
function insertFormat(open,close = open) {
  const input = $('message-input'); if (input.disabled) return;
  const start = input.selectionStart, end = input.selectionEnd;
  input.setRangeText(open + input.value.slice(start,end) + close,start,end,'end'); input.setSelectionRange(start + open.length,end + open.length); input.focus(); input.dispatchEvent(new Event('input'));
}
document.querySelectorAll('[data-format]').forEach(button => button.onclick = event => {
  if (button.dataset.format === 'color') contextMenu.show(event,'Color IRC',['Blanco','Negro','Azul oscuro','Verde','Rojo','Granate','Violeta','Naranja','Amarillo','Lima','Turquesa oscuro','Turquesa','Azul','Rosa','Gris','Gris claro'].map((name,i) => ({ label:name,action:() => insertFormat('\x03' + String(i).padStart(2,'0'),'\x03') })));
  else insertFormat({ bold:'\x02',italic:'\x1d',underline:'\x1f' }[button.dataset.format]);
});
function filterSettings() {
  const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const query = normalize($('settings-search').value.trim());
  for (const panel of document.querySelectorAll('[data-panel]')) {
    panel.hidden = query ? !normalize(panel.textContent).includes(query) : panel.dataset.panel !== settingsSection;
    for (const row of panel.querySelectorAll('.setting-row')) row.hidden = !!query && !normalize(row.textContent).includes(query);
  }
}
function openSettings(section = 'networks') {
  for (const node of document.querySelectorAll('[data-panel]')) node.hidden = node.dataset.panel !== section;
  for (const node of document.querySelectorAll('[data-section]')) node.classList.toggle('selected', node.dataset.section === section);
  settingsSection = section; $('settings-search').value = ''; filterSettings();
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
      workspace.profiles = config.profiles; workspace.networks.delete(p.id);
      $('message-input').value = selected()?.draft || ''; await persist(); renderProfiles(); render();
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
  'toggle-users': () => togglePanel('showUsers'),
  'toggle-privates': () => togglePanel('showPrivates'),
  server: () => { if (active) choose(active.id,'*'); },
  'search-messages': () => { $('chat-search').hidden = !$('chat-search').hidden; if (!$('chat-search').hidden) $('message-search').focus(); else { $('message-search').value = ''; renderMessages(); } },
  latest: () => goLatest(),
  'first-unread': () => goFirstUnread(),
  connection: () => toggleConnection(), join: () => openJoin(),
  logs: async () => { const r = await api.logs(); if (r?.error) notify(r.error, true); }, quit: () => api.quit(),
  help: () => info('Comandos y atajos', ['/join #sala · /part · /nick apodo · /me acción', '/msg apodo mensaje · /whois apodo · /topic texto · /quit', 'Para enviar un mensaje que empieza por /, escribe // al principio.', 'Ctrl+N: nueva red · Ctrl+J: entrar en sala · Ctrl+U: ocultar usuarios · Ctrl+,: configuración.', 'Las salas aparecen como pestañas arriba. Arrastra el borde izquierdo de la conversación para ajustar la barra lateral.']),
  about: () => info('HexDroid Dreams', ['Versión ' + (appVersion) + ' · Cliente IRC para Windows.', 'Cliente de escritorio con IRCv3, autenticación SASL, historial opcional, DCC, cifrado y scripts .hex.', 'Las funciones dependen de las capacidades de cada servidor. Revisa Herramientas para configurarlas.'])
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
  if (!host || /[\s\0\r\n,]/.test(host) || !/^[^\s\0\r\n:,]+$/.test(nick)) { $('network-error').textContent = 'Revisa el servidor y el apodo: no pueden contener espacios ni dos puntos.'; return; }
  const channels = [...new Set($('profile-channels').value.trim().split(/[\s,]+/).filter(Boolean))];
  if (channels.some(c => !/^[#&+!][^\s:,]+$/.test(c)) || channels.length > 30) { $('network-error').textContent = 'Introduce hasta 30 salas, empezando por #, &, + o !.'; return; }
  if (!$('profile-id').value && config.profiles.length >= 30) { $('network-error').textContent = 'Esta versión admite hasta 30 redes.'; return; }
  const id = $('profile-id').value || crypto.randomUUID();
  const p = { ...profile(id), id, name: $('profile-name').value.trim() || host, host, port: Number($('profile-port').value), nick, tls: $('profile-tls').checked, channels };
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
  const id = active.id, target = active.target, c = selected(), text = $('message-input').value;
  if (!text.trim()) return;
  if (text.trim() === '/markread') { c.unread = 0; c.mentions = 0; c.firstUnreadId = null; c.draft = ''; $('message-input').value = ''; render(); return; }
  const result = await api.send({ id,target,text });
  if (result?.error) notify(result.error,true);
  else {
    c.history.push(text); if (c.history.length > 100) c.history.shift(); c.historyIndex = -1;
    if (c.draft === text) c.draft = '';
    if (active?.id === id && fold(active.target) === fold(target) && $('message-input').value === text) { $('message-input').value = ''; c.draft = ''; previewFormat(); }
  }
});
$('message-input').addEventListener('input',() => { if (selected()) selected().draft = $('message-input').value; previewFormat(); });
$('message-input').addEventListener('keydown', e => {
  const c = selected(); if (!c || e.isComposing) return;
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('composer').requestSubmit(); }
  else if (e.key === 'Tab' && !e.ctrlKey && !e.altKey) {
    const input = e.target, before = input.value.slice(0,input.selectionStart), match = /([^ \n]*)$/.exec(before), word = match[0];
    const candidates = word.startsWith('/') ? ['/join','/part','/nick','/query','/whois','/who','/me','/msg','/notice','/topic','/mode','/raw','/quit','/markread'] : c.users.map(u => bareNick(u,network(active.id)));
    const found = candidates.find(name => fold(name).startsWith(fold(word)) && word);
    if (found) { e.preventDefault(); input.setRangeText(found + ' ',before.length - word.length,input.selectionEnd,'end'); input.dispatchEvent(new Event('input')); }
  } else if (['ArrowUp','ArrowDown'].includes(e.key) && (e.ctrlKey || !e.target.value || c.historyIndex >= 0) && c.history.length) {
    e.preventDefault(); if (c.historyIndex < 0) c.historyDraft = e.target.value;
    c.historyIndex = e.key === 'ArrowUp' ? Math.min(c.history.length-1,c.historyIndex + 1) : Math.max(-1,c.historyIndex - 1);
    e.target.value = c.historyIndex < 0 ? c.historyDraft || '' : c.history[c.history.length - 1 - c.historyIndex]; c.draft = e.target.value; previewFormat();
  }
});
$('search').addEventListener('input',renderSidebar); $('user-search').addEventListener('input',renderUsers);
$('network-select').onchange = e => { const id = e.target.value; const n = network(id); const target = n.lastTarget && n.conversations.has(fold(n.lastTarget)) ? n.lastTarget : '*'; if (active) network(active.id).lastTarget = active.target; choose(id,target); };
$('private-sort').onchange = e => { config.settings.privateSort = e.target.value; renderSidebar(); persist().catch(() => {}); };
$('message-search').oninput = () => renderMessages();
$('settings-search').oninput = filterSettings;
$('new-messages').onclick = goLatest;
$('messages').addEventListener('scroll',() => {
  const list = $('messages'), c = selected(); if (!c || $('message-search').value) return;
  c.scrollTop = list.scrollTop; c.follow = list.scrollHeight - list.scrollTop - list.clientHeight < 70;
  if (c.follow) { c.unread = 0; c.mentions = 0; $('new-messages').hidden = true; }
});
for (const key of ['compact','timestamps','showPrivates','showUsers','showTopic','showEvents','autoScroll']) $('setting-' + key).onchange = () => { config.settings[key] = $('setting-' + key).checked; applySettings(); render(); persist().catch(() => {}); };
for (const [id,key,numeric] of [['font','fontSize',true],['fontFamily','fontFamily',false],['ownNickColor','ownNickColor',false],['lineHeight','lineHeight',true],['messageSpacing','messageSpacing',true],['sidebar','sidebarWidth',true],['usersWidth','usersWidth',true]]) {
  const node = $('setting-' + id); node.oninput = () => { config.settings[key] = numeric ? Number(node.value) : node.value; applySettings(); };
  node.onchange = () => { config.settings[key] = numeric ? Number(node.value) : node.value; applySettings(); persist().catch(() => {}); };
}
for (const [id,key,min,max,pointer] of [['sidebar-resizer','sidebarWidth',160,420,e => e.clientX],['users-resizer','usersWidth',140,360,e => innerWidth - e.clientX]]) DreamsDesktop.bindResizer($(id),{ min,max,read:() => config.settings[key],write:v => { config.settings[key] = v; },apply:applySettings,save:() => persist().catch(() => {}),fromPointer:pointer });
window.addEventListener('resize',() => applySettings());
document.addEventListener('keydown',e => {
  if (e.ctrlKey && e.key.toLowerCase() === 'c' && selectedMessages.size && !document.getSelection()?.toString() && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) { e.preventDefault(); copyMessages(); return; }
  if (!e.ctrlKey || e.altKey) return;
  if (e.key === 'Tab' && active && !document.querySelector('dialog[open]')) { e.preventDefault(); cycleChannel(e.shiftKey ? -1 : 1); return; }
  const map = { n:'add-network',j:'join',u:'toggle-users',p:'toggle-privates',f:'search-messages',',':'settings' }, action = map[e.key.toLowerCase()];
  if (!action) return; e.preventDefault(); if (document.querySelector('dialog[open]') && e.key !== ',') return;
  Promise.resolve(actions[action]()).catch(error => notify(error.message,true));
});
$('room-tabs').addEventListener('keydown',e => { if (['ArrowLeft','ArrowRight'].includes(e.key) && e.target.getAttribute('role') === 'tab') { e.preventDefault(); cycleChannel(e.key === 'ArrowLeft' ? -1 : 1); $('room-tabs [aria-selected=true]')?.focus(); } });
api.onEvent(event => {
  if (!profile(event.id)) return;
  const n = network(event.id), id = event.id;
  switch (event.type) {
    case 'status':
      n.state = event.state; if (event.nick) n.nick = event.nick; if (event.connection) n.connection = event.connection;
      addMessage(id, '*', { event: true, text: event.text });
      if (event.state === 'disconnected') for (const c of n.conversations.values()) { c.joined = false; c.users = []; }
      break;
    case 'problem': addMessage(id, '*', { event: true, error: true, text: event.text }); notify(event.text, true); break;
    case 'server': addMessage(id, '*', { event: true, text: event.text }); break;
    case 'query': choose(id,event.target); break;
    case 'modes': conversation(id,event.target).modes = event.text; break;
    case 'message': addMessage(id, event.target && event.target !== '*' ? event.target : '*', event); break;
    case 'users': conversation(id,event.target).users = event.users; if (event.prefixes) n.prefixes = event.prefixes; if (event.prefixModes) n.prefixModes = event.prefixModes; break;
    case 'topic': conversation(id, event.target).topic = event.text; break;
    case 'channel': {
      if (!n.conversations.has(fold(event.target)) && event.action !== 'join') break;
      const c = conversation(id, event.target);
      if (event.own) { c.joined = event.action === 'join'; if (!c.joined) c.users = []; }
      const verb = { join: 'ha entrado en la sala', part: 'ha salido de la sala', quit: 'se ha desconectado', kick: 'ha sido expulsado' }[event.action];
      addMessage(id, event.target, { event: true, text: event.nick + ' ' + verb });
      if (event.own && event.action === 'join') choose(id,event.target,false);
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
  scheduleRender();
  if ($('settings-dialog').open) renderProfiles();
});
(async () => {
  try {
    const result = await api.load(); if (result.error) throw new Error(result.error);
    config = { profiles:result.profiles, settings: { fontSize:14,sidebarWidth:240,usersWidth:192,showPrivates:true,showUsers:true,showTopic:true,timestamps:true,showEvents:true,compact:false,autoScroll:true,fontFamily:'Segoe UI',lineHeight:1.65,messageSpacing:9,ownNickColor:'#c0adf1',privateSort:'manual',...result.settings } };
    workspace = new DreamsWorkspace.Workspace(config.profiles,result.workspace); networks = workspace.networks; active = workspace.active;
    appVersion = result.version || '0.2.0';
    if (active) $('message-input').value = selected().draft;
    applySettings(); render();
    if (result.warnings?.length) notify(result.warnings.join(' '), true);
  } catch (error) { notify('No se pudo iniciar la interfaz: ' + error.message, true); }
})();
