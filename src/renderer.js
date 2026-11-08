'use strict';
const $ = id => document.getElementById(id);
const api = window.dreams;
let appVersion = '0.4.0';
let config = { settings: {}, profiles: [] }, active = null, selectedNetworkId = null, toastTimer, saveQueue = Promise.resolve();
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
  lastMessageView='';
  const s = config.settings, sizes = DreamsWorkspace.panelSizes(innerWidth,{...s,showUsers:conversationShowsUsers()});
  const root = document.documentElement.style;
  root.setProperty('--sidebar-width', sizes.left + 'px'); root.setProperty('--users-width', sizes.right + 'px');
  root.setProperty('--font-size', s.fontSize + 'px'); root.setProperty('--chat-font', s.fontFamily);
  root.setProperty('--chat-line-height',s.lineHeight); root.setProperty('--message-spacing',s.messageSpacing + 'px'); root.setProperty('--own-nick-color',s.ownNickColor);
  $('sidebar-resizer').setAttribute('aria-valuenow',String(sizes.left)); $('users-resizer').setAttribute('aria-valuenow',String(sizes.right));
  document.body.classList.toggle('compact',s.compact);
  $('private-panel').hidden = !s.showPrivates; $('sidebar-resizer').hidden = !s.showPrivates;
  $('users-panel').hidden = !s.showUsers; $('users-resizer').hidden = !s.showUsers;
  for (const [id, key, noun] of [['users-toggle','showUsers','usuarios'],['privates-toggle','showPrivates','panel izquierdo']]) {
    $(id).setAttribute('aria-pressed',String(s[key])); $(id).setAttribute('aria-label',(s[key] ? 'Ocultar ' : 'Mostrar ') + noun);
  }
  $('private-sort').value = s.privateSort;
  for (const [id,key] of [['font','fontSize'],['sidebar','sidebarWidth'],['usersWidth','usersWidth'],['fontFamily','fontFamily'],['lineHeight','lineHeight'],['messageSpacing','messageSpacing'],['ownNickColor','ownNickColor']]) $('setting-' + id).value = String(s[key]);
  for (const key of ['compact','timestamps','showPrivates','showUsers','showTopic','showEvents','eventShowHost','autoScroll']) $('setting-' + key).checked = s[key];
  applyConversationUsers();
}
function captureConversation() {
  const c = selected(); if (!c) return;
  c.draft = $('message-input').value;
  if (!$('message-search').value) c.scrollTop = $('messages').scrollTop;
}
function choose(id,target,focus = true) {
  captureConversation(); if (active) network(active.id).lastTarget = active.target;
  selectedNetworkId=id; active = { id,target }; workspace.choose(id,target); selectedMessages.clear(); $('selection-count').textContent = '';
  $('message-input').value = conversation(id,target).draft; $('message-search').value = '';
  render(); previewFormat(); if (focus && !$('message-input').disabled) $('message-input').focus();
  persist().catch(() => {});
}
let activityTimer;
function addMessage(id,target,message) {
  workspace.active = active;
  if (!config.settings.autoScroll && !message.own && active?.id === id && fold(active.target) === fold(target)) conversation(id,target).follow = false;
  workspace.addMessage(id,target,message);clearTimeout(activityTimer);activityTimer=setTimeout(renderTabs,4100);
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
  const picker = $('network-select'); const existing=new Map([...picker.options].map(o=>[o.value,o]));
  for (const p of config.profiles) {
    const n = network(p.id), unread = [...n.conversations.values()].reduce((sum,c) => sum + c.unread,0);
    let option=existing.get(p.id);if(!option){option=el('option');option.value=p.id;picker.append(option);}option.textContent=p.name+(unread?` (${unread})`:'');existing.delete(p.id);
  }
  const addOption=existing.get('__add_network__');existing.delete('__add_network__');for(const option of existing.values())option.remove();
  if(!addOption){const add=el('option','','Agregar red…');add.value='__add_network__';picker.append(add);}else if(picker.lastElementChild!==addOption)picker.append(addOption);
  picker.value=active?.id||selectedNetworkId||config.profiles[0]?.id||'__add_network__';picker.disabled=false;
  if (draggedItem) return;
  window.renderDreamsTree?.();
}

function renderTabs() { $('room-tabs').hidden = true; }
async function closeConversation(id, target) {
  const c = conversation(id, target);
  if(c.kind==='server'&&network(id).state!=='disconnected'){notify('Desconecta la red antes de cerrar Status.',true);return;}
  if (c.joined && network(id).state === 'connected') {
    const result = await api.send({ id, target, text: '/part' }); if (result?.error) { notify(result.error, true); return; }
  }
  const cWasActive = active?.id === id && fold(active.target) === fold(target);
  network(id).conversations.delete(fold(target));
  if(cWasActive){active=null;workspace.active=null;if(c.kind!=='server')choose(id,'*');else{$('message-input').value='';render();}}else render();
  persist().catch(() => {});
}
function avatarFor(id,nick,scope="users"){
  if(config.settings.mediaEnabled===false||(scope==="messages"?config.settings.showMessageAvatars===false:config.settings.showAvatars===false))return null;
  const n=network(id),state=n.userStates?.[fold(nick)]||{},photo=n.avatars?.[fold(nick)];
  if(Object.hasOwn(state.metadata||{},'avatar')||Object.hasOwn(state.metadata||{},'avatar-url'))return photo||null;
  return photo||(fold(n.nick)===fold(nick)?profile(id)?.photo:null);
}
function renderMessages(preserveScroll = false) {
  const list = $('messages'), c = selected(), query = fold($('message-search').value);
  const eventList=window.prepareDreamsEventPane?.(c);
  list.hidden = !c; $('welcome').hidden = !!c;
  if (!c) { list.replaceChildren(); lastMessageView = ''; return; }
  const signature = JSON.stringify([profile(active.id)?.photo,network(active.id).avatarRevision,c.revision,c.messages.at(-1)?.pending,c.messages.at(-1)?.failed,c.messages.at(-1)?.messageId,active.id,fold(c.name),c.messages.length,c.messages.at(-1)?.id,query,config.settings.showMessageAvatars,config.settings.mediaEnabled,config.settings.showClones,config.settings.roomView,config.settings.highlightMentions,config.settings.timestamps,config.settings.showEvents,c.muted]);
  if (preserveScroll && signature === lastMessageView) return;
  const anchor = [...list.querySelectorAll('[data-message-id]')].find(row => row.offsetTop + row.offsetHeight > list.scrollTop);
  const anchorId = anchor?.dataset.messageId, anchorOffset = anchor ? anchor.offsetTop - list.scrollTop : 0;
  lastMessageView = signature; list.replaceChildren();if(eventList)eventList.replaceChildren();
  const visible = c.messages.filter(m => (m.eventType!=='clones'||config.settings.showClones!==false) && (!m.event || c.kind==='queries' || config.settings.showEvents || m.error) && (!query || fold(DreamsFormatting.plain(m.text) + ' ' + (m.nick || '')).includes(query)));
  $('search-count').textContent = query ? `${visible.length} resultados` : '';
  if (!visible.some(m=>!eventList||!m.event)) list.append(el('div','event-message',query ? 'No hay mensajes que coincidan.' : c.kind === 'server' ? 'Conecta esta red para ver su actividad.' : 'Este es el comienzo de la conversación.'));
  let day = '';
  for (const m of visible) {
    const date = new Date(m.time), valid = !Number.isNaN(date.valueOf());
    const label = valid ? date.toLocaleDateString('es',{day:'numeric',month:'long',year:'numeric'}) : '';
    const destination=m.event&&eventList?eventList:list;
    if (destination===list && label && label !== day) { day = label; list.append(el('div','message-day',label)); }
    const time = el('time','',valid ? '['+date.toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit',second:'2-digit'})+']' : ''); if (valid) time.dateTime = date.toISOString();
    const row = el(m.event ? 'div' : 'article',m.event ? 'event-message' + (m.error ? ' error' : '') : 'message' + (m.own ? ' own' : '') + (m.action ? ' action' : '') + (m.notice ? ' notice' : '') + (m.mention && !c.muted && config.settings.highlightMentions!==false ? ' mention' : '') + (selectedMessages.has(m.id) ? ' selected' : ''));
    row.dataset.messageId = m.id;
    if (m.event) { if (config.settings.timestamps) row.append(time); const formatted=el('span','event-text');DreamsFormatting.render(formatted,m.text);row.append(formatted);if(m.eventType&&!window.renderDreamsSpecialEvent?.(row,m,time))window.renderDreamsChannelEvent?.(row,m,time); }
    else {
      const avatar=el('span','avatar',(m.nick||'?').slice(0,2).toUpperCase()),src=avatarFor(active.id,m.nick,"messages");if(src){const img=el('img');img.src=src;img.alt=m.nick;avatar.replaceChildren(img);}if(config.settings.showMessageAvatars!==false&&config.settings.mediaEnabled!==false)row.append(avatar);
      const content = el('div','message-content'), header = el('div','message-header');
      const nick = el('button','message-nick','{'+m.nick+'}');nick.setAttribute('aria-label',m.nick);if(!m.own&&config.settings.coloredNicks!==false){let hash=0;for(const ch of fold(m.nick))hash=(hash*31+ch.charCodeAt(0))|0;nick.style.color=`hsl(${Math.abs(hash)%360} ${config.settings.nickPalette==='pastel'?48:78}% ${DreamsFormatting.luminance(getComputedStyle($('messages')).backgroundColor)>.4?(config.settings.nickPalette==='pastel'?36:28):(config.settings.nickPalette==='pastel'?78:68)}%)`;} nick.onclick = () => window.openDreamsUser?.(active.id,m.nick); if (config.settings.timestamps)header.append(time,document.createTextNode(' '));header.append(nick,document.createTextNode(' '));
      const body = el('div','message-text'); DreamsFormatting.render(body,m.action ? '* ' + m.nick + ' ' + m.text : m.text); content.append(header,body);if(api.advanced&&config.settings.mediaEnabled!==false){for(const url of m.text.match(/https:\/\/[^\s<>]+\.(?:png|jpe?g|gif|webp|bmp|avif)(?:\?[^\s<>]*)?/gi)||[]){const preview=el('button','message-media','Cargar imagen');preview.onclick=()=>window.previewDreamsMedia?.(url);content.append(preview);}}if(m.pending)content.append(el('small','delivery-state','Pendiente de confirmación'));if(m.failed)content.append(el('small','delivery-state','No se confirmó la entrega'));if(m.replyTo)content.prepend(el('small','reply-reference','↳ Respuesta a '+m.replyTo));if(m.reactions)content.append(el('small','reactions',Object.entries(m.reactions).map(([emoji,nicks])=>emoji+' '+nicks.join(', ')).join(' · '))); row.append(content);
    }
    row.oncontextmenu = e => messageMenu(e,m,row);
    row.addEventListener('click',e => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); e.stopPropagation(); toggleMessageSelection(m.id,row); } },true);
    destination.append(row);
  }
  if(eventList){if(!eventList.children.length)eventList.append(el("div","event-message","Sin eventos de sala."));eventList.scrollTop=c.eventsFollow===false?c.eventScrollTop||0:eventList.scrollHeight;}
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
let lastUsersView='';
function renderUsers() {
  const view=JSON.stringify([active,selected()?.users,(active?network(active.id).avatarRevision:null),$('user-search').value,config.settings.mediaEnabled,config.settings.showAvatars]);
  if(view===lastUsersView)return;lastUsersView=view;
  const list = $('user-list'); list.replaceChildren(); const c = selected(), n = active && network(active.id), query = fold($('user-search').value);
  const rank = user => { const i = n.prefixes.indexOf(user[0]); return i < 0 ? 999 : i; };
  const users = [...(c?.users || [])].sort((a,b) => rank(a) - rank(b) || a.localeCompare(b));
  $('user-count').textContent = String(users.length);
  if (!users.length) { list.append(el('div','empty-users',c?.kind === 'channel' ? 'Los usuarios aparecerán al entrar en la sala.' : 'Selecciona una sala para ver sus usuarios.')); return; }
  for (const user of users.filter(user => fold(user).includes(query))) {
    const bare = bareNick(user,n), b = el('button','user-button' + (rank(user) < 999 ? ' operator' : ''));
    b.setAttribute('aria-label',statusPrefix(user,n)+bare);
    const picture=el('span','user-avatar',bare.slice(0,2).toUpperCase()),photo=avatarFor(active.id,bare);if(photo){const img=el('img');img.src=photo;img.alt=bare;picture.replaceChildren(img);}b.append(picture,el('span','user-name',statusPrefix(user,n)+bare));
    b.setAttribute('aria-label',user); b.title = 'Doble clic para abrir un privado con ' + bare;
    const id = active.id; let profileTimer; b.onclick=()=>{clearTimeout(profileTimer);profileTimer=setTimeout(()=>window.openDreamsUser?.(id,bare),220);}; b.ondblclick = () => {clearTimeout(profileTimer);choose(id,bare);}; b.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); choose(id,bare); } };
    b.oncontextmenu = e => userMenu(e,id,c,bare); list.append(b);
  }
}
function statusPrefix(user,n){let i=0;while(i<user.length&&n.prefixes.includes(user[i]))i++;return user.slice(0,i);}
function bareNick(user,n) { let i = 0; while (i < user.length && n.prefixes.includes(user[i])) i++; return user.slice(i).split("!")[0]; }
function renderHeader() {
  applyConversationUsers();
  const own=profile(active?.id)?.ownNickColor||config.settings.ownNickColor||'#c0adf1',mention=profile(active?.id)?.mentionHighlightColor||config.settings.mentionHighlightColor||'#7650aa',bg=getComputedStyle($('messages')).backgroundColor;
  $('messages').style.setProperty('--room-own',DreamsFormatting.readableColor(own,bg));$('messages').style.setProperty('--mention-border',mention);$('messages').style.setProperty('--mention-background','color-mix(in srgb, '+mention+' 26%, '+bg+')');
  document.documentElement.style.setProperty('--own-nick-color',profile(active?.id)?.ownNickColor||config.settings.ownNickColor||'#c0adf1');
  applyComposerStyle();
  const p = profile(active?.id||selectedNetworkId||config.profiles[0]?.id), n = p && network(p.id), c = selected();
  const connection = n?.state !== 'disconnected' && n?.connection || p;
  $('conversation-title').textContent = c ? c.name === '*' ? p.name : c.kind==='queries'?'WHOIS / WHO':c.name : 'Bienvenido a HexDreams IRC';
  $('channel-symbol').textContent = c ? c.name === '*' ? '◈' : /^[#&+!]/.test(c.name) ? '#' : '◌' : '✦';
  $('conversation-subtitle').hidden = !config.settings.showTopic || c?.kind !== 'channel' || !c.topic;
  const topicDivider=$('topic-height-resizer');if(topicDivider)topicDivider.hidden = $('conversation-subtitle').hidden;
  $('channel-modes').hidden = !c?.modes; $('channel-modes').textContent = c?.modes || '';
  $('server-button').disabled = !p;
  DreamsFormatting.render($('conversation-subtitle'), c ? c.kind==='queries'?'Resultados de consultas al servidor · Historial':c.topic || (c.name === '*' ? `${connection.host}:${connection.port} · ${connection.tls ? 'TLS' : 'Sin TLS'}` : /^[#&+!]/.test(c.name) ? p.name + ' · Sala IRC' : p.name + ' · Mensaje privado') : 'Un lugar para todas tus conversaciones.');
  $('connection-button').disabled = !p;
  $('connection-button').textContent = n?.state === 'connected' ? 'Desconectar' : n?.state === 'connecting' ? 'Cancelar' : 'Conectar';
  $('join-button').disabled = n?.state !== 'connected';
  const canSend = n?.state === 'connected' && c && (c.name === '*' || !/^[#&+!]/.test(c.name) || c.joined);
  $('message-input').disabled = !canSend; $('send-button').disabled = !canSend;
  for (const button of document.querySelectorAll('.format-bar button')) button.disabled = !canSend;
  $('message-input').placeholder = !c ? 'Selecciona una conversación…' : !canSend ? 'Conecta la red y entra en la sala para escribir…' : c.kind==='queries'?'Consulta: /whois nick o /who nick':c.name === '*' ? 'Escribe un comando, por ejemplo /join #general' : `Mensaje a ${c.name}…`;
  $('composer-context').textContent = c ? `${n.nick || p.nick} · ${n.state === 'connected' ? 'Conectado' : n.state === 'connecting' ? 'Conectando…' : 'Desconectado'}` : 'Conecta una red para empezar a conversar';
  $('transport-label').textContent = p ? (connection.tls ? n.state === 'connected' ? '◈ TLS verificado' : '◈ TLS activado' : '⚠ Conexión sin cifrar') : 'IRC · Tu próximo espacio';
  const connected = [...networks.values()].filter(n => n.state === 'connected').length;
  const ownAvatar=document.querySelector('.sidebar-footer>.avatar');const selfPhoto=n?avatarFor(p.id,n.nick):null;if(selfPhoto){const img=el('img');img.src=selfPhoto;img.alt='Tu foto en '+p.name;ownAvatar.replaceChildren(img);}else ownAvatar.textContent='H';
  $('self-nick').textContent = n?.nick || 'Tu espacio IRC'; $('connection-summary').textContent = connected ? `${connected} ${connected === 1 ? 'red conectada' : 'redes conectadas'}` : 'Sin conexión';
  for (const id of ['global-status','footer-dot']) $(id).className = 'status-dot' + (connected ? ' online' : n?.state === 'connecting' ? ' connecting' : '');
  $('footer-info').textContent = p ? `${connection.host}:${connection.port} · Usuarios: ${c?.users.length || 0} · ${connection.tls ? 'TLS' : 'TCP'}` : 'HexDreams IRC ' + appVersion;
  $('first-unread').disabled = !c?.firstUnreadId;
  $('new-messages').hidden = !c || c.follow || !c.unread;
  $('footer-status').textContent = n?.state === 'connecting' ? `Conectando a ${p.name}…` : connected ? `${connected} ${connected === 1 ? 'red conectada' : 'redes conectadas'}${p ? ' · ' + p.name : ''}` : 'Listo para conectar';
}
function render(preserveScroll = false) { renderSidebar(); renderTabs(); renderHeader(); renderMessages(preserveScroll); renderUsers();window.loadDreamsAvatars?.();window.refreshDreamsUserPhoto?.(); }
function scheduleRender() { if (!framePending) { framePending = true; requestAnimationFrame(() => { framePending = false; render(true); }); } }
function conversationShowsUsers(c=selected()){return !!c&&c.kind!=='server'&&(c.showUsers??config.settings.showUsers)!==false;}
function applyConversationUsers(){const visible=conversationShowsUsers(),sizes=DreamsWorkspace.panelSizes(innerWidth,{...config.settings,showUsers:visible});document.documentElement.style.setProperty('--sidebar-width',sizes.left+'px');document.documentElement.style.setProperty('--users-width',sizes.right+'px');$('users-panel').hidden=$('users-resizer').hidden=!visible;$('users-toggle').disabled=selected()?.kind==='server'||!selected();$('users-toggle').setAttribute('aria-pressed',String(visible));$('users-toggle').setAttribute('aria-label',(visible?'Ocultar':'Mostrar')+' usuarios');}
function togglePanel(key) { if(key==='showUsers'&&selected()){if(selected().kind==='server')return;selected().showUsers=!conversationShowsUsers();applyConversationUsers();render();return;}config.settings[key] = !config.settings[key]; applySettings(); persist().catch(() => {}); }
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
  const all=[...network(active.id).conversations.values()],channels=[...all.filter(c=>c.kind==='channel'),...all.filter(c=>c.kind==='private').sort((a,b)=>a.name.localeCompare(b.name,'es',{sensitivity:'base'})),...all.filter(c=>c.kind==='queries')]; if (!channels.length) return;
  const i = channels.findIndex(c => fold(c.name) === fold(active.target));
  choose(active.id,channels[i < 0 ? direction > 0 ? 0 : channels.length - 1 : (i + direction + channels.length) % channels.length].name);
}
function toggleMessageSelection(id,row) {
  if (selectedMessages.has(id)) selectedMessages.delete(id); else selectedMessages.add(id);
  row.classList.toggle('selected',selectedMessages.has(id)); $('selection-count').textContent = selectedMessages.size ? `${selectedMessages.size} seleccionados · Ctrl+C` : '';
}
async function copyText(text) { const result = await api.copy(text); if (result?.error) throw new Error(result.error); }
function printable(m) { if(m.eventType)return m.time+' '+stripFormatting(m.text)+(m.reason?' · '+stripFormatting(m.reason):'');return `${m.time} ${m.nick ? '<' + m.nick + '> ' : ''}${stripFormatting(m.text)}`; }
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
    ...(c.kind==='channel'?[{label:'Mover pestaña a la izquierda',disabled:index<=0,action:()=>move(-1)},{label:'Mover pestaña a la derecha',disabled:index>=sameKind.length-1,action:()=>move(1)}]:[]),
    ...(c.kind === 'channel' ? [
      { label:'Entrar de nuevo en el canal',disabled:c.joined || network(id).state !== 'connected',action:() => sendCommand(id,'*','/join ' + c.name) },
      { label:'Editar topic',disabled:!c.joined,action:() => askAction('Editar topic','Nuevo topic',c.topic,value => sendCommand(id,c.name,'/topic ' + value)) }
    ] : [{ label:'WHOIS',disabled:network(id).state !== 'connected',action:async () => { await sendCommand(id,c.name,'/whois ' + c.name); } }]),
    null,{ label:c.kind === 'channel' ? 'Cerrar canal' : 'Cerrar privado',action:() => closeConversation(id,c.name) }
  ]);
}
function userMenu(event,id,c,nick) {
  const n = network(id), connected = n.state === 'connected';
  const own = c.users.find(user => fold(bareNick(user,n)) === fold(n.nick)) || '';
  const ownSymbols = statusPrefix(own,n);
  const hasMode = modes => [...ownSymbols].some(symbol => modes.includes(n.prefixModes[n.prefixes.indexOf(symbol)]));
  const operator = connected && hasMode('oaq'), moderator = connected && hasMode('hoaq');
  contextMenu.show(event,nick,[
    { label:'Abrir privado',action:() => choose(id,nick) },
    ...(api.advanced?[{label:'Ignorar usuario',action:()=>sendCommand(id,c.name,'/ignore '+nick)},{label:'Dejar de ignorar',action:()=>sendCommand(id,c.name,'/unignore '+nick)}]:[]),
    ...(api.advanced&&(n.capabilities?.includes('draft/metadata-2')||config.settings.avatarUrlTemplate)?[{label:'Cargar avatar publicado',action:async()=>{const r=await api.advanced('avatar.preview',{network:id,nick});if(r?.error)throw new Error(r.error);if(r.image){n.avatars||={};n.avatars[fold(nick)]=r.image;n.avatarRevision=(n.avatarRevision||0)+1;lastMessageView='';render();}else if(r.pending)notify('Avatar solicitado. Vuelve a elegir Cargar avatar cuando llegue la respuesta.');}}]:[]),
    { label:'WHOIS',disabled:!connected,action:async () => { await sendCommand(id,c.name,'/whois ' + nick); } },
    { label:'WHO',disabled:!connected,action:async () => { await sendCommand(id,c.name,'/who ' + nick); } },
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
function effectiveComposerSettings(){const p=profile(active?.id),s={...config.settings};if(p?.textColor)s.textColor=p.textColor;if(p?.textStyle){s.composerBold=p.textStyle.includes('bold');s.composerItalic=p.textStyle.includes('italic');s.composerUnderline=p.textStyle.includes('underline');}return s;}
function composeText(text){const s=effectiveComposerSettings(),colorIndex=s.textColor?DreamsFormatting.colors.findIndex(c=>c.toLowerCase()===s.textColor.toLowerCase()):s.composerColor,prefix=(s.composerBold?'\x02':'')+(s.composerItalic?'\x1d':'')+(s.composerUnderline?'\x1f':'')+(Number.isInteger(colorIndex)&&colorIndex>=0?'\x03'+String(colorIndex).padStart(2,'0'):s.textColor?'\x04'+s.textColor.slice(1):'');if(!prefix)return text;const wrap=value=>value.split('\n').map(line=>prefix+line+'\x0f').join('\n');if(text.startsWith('/')){const m=/^(\/(?:me)\s+|\/(?:msg|notice)\s+\S+\s+)([\s\S]*)$/i.exec(text);return m?m[1]+wrap(m[2]):text;}return wrap(text);}
function applyComposerStyle(){const s=effectiveComposerSettings(),i=$('message-input');i.style.color=s.textColor?DreamsFormatting.readableColor(s.textColor,getComputedStyle(document.querySelector('.composer-input')).backgroundColor):Number.isInteger(s.composerColor)?DreamsFormatting.readableColor(DreamsFormatting.colors[s.composerColor],getComputedStyle(document.querySelector('.composer-input')).backgroundColor):'';i.style.fontWeight=s.composerBold?'700':'';i.style.fontStyle=s.composerItalic?'italic':'';i.style.textDecoration=s.composerUnderline?'underline':'';for(const b of document.querySelectorAll('[data-format]'))b.setAttribute('aria-pressed',String(b.dataset.format==='color'?!!s.textColor||Number.isInteger(s.composerColor):!!s[{bold:'composerBold',italic:'composerItalic',underline:'composerUnderline'}[b.dataset.format]]));}
function previewFormat(){applyComposerStyle();$('format-preview').hidden=true;}
document.querySelectorAll('[data-format]').forEach(button=>button.onclick=event=>{const type=button.dataset.format;if(type==='color'){contextMenu.show(event,'Color permanente para escribir',[{label:'Sin color',action:()=>{config.settings.composerColor=null;const p=profile(active?.id);if(p)delete p.textColor;previewFormat();persist().catch(()=>{});}},...DreamsFormatting.colors.map((color,i)=>({label:'Color '+String(i).padStart(2,'0'),color,action:()=>{config.settings.composerColor=i;const p=profile(active?.id);if(p)p.textColor=color;applySettings();previewFormat();persist().catch(()=>{});$('message-input').focus();}}))]);}else{const key={bold:'composerBold',italic:'composerItalic',underline:'composerUnderline'}[type];const current=effectiveComposerSettings();config.settings[key]=!current[key];const p=profile(active?.id);if(p?.textStyle){current[key]=config.settings[key];p.textStyle=[current.composerBold?'bold':'',current.composerItalic?'italic':'',current.composerUnderline?'underline':''].filter(Boolean).join('-')||'normal';}previewFormat();persist().catch(()=>{});$('message-input').focus();}});
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
let editingPhoto="";
function updatePhotoPreview(){const img=$("profile-photo-preview");img.hidden=!editingPhoto;if(editingPhoto)img.src=editingPhoto;else img.removeAttribute("src");}
$("profile-photo-choose").onclick=async()=>{try{if(!api.advanced)throw new Error("Selector de fotos no disponible.");const r=await api.advanced("identity.photo");if(r.error)throw new Error(r.error);if(r.image){editingPhoto=r.image;updatePhotoPreview();}}catch(e){$("network-error").textContent=e.message;}};
$("profile-photo-remove").onclick=()=>{editingPhoto="";updatePhotoPreview();};
function openNetwork(id) {
  const p = id && profile(id); $('network-form').reset(); $('profile-id').value = p?.id || '';
  $('network-dialog-title').textContent = p ? 'Editar red' : 'Añadir una red';
  for (const key of ['name','host','nick','port','alternateNick']) $('profile-' + key).value = p?.[key] ?? (key === 'port' ? 6697 : '');
  $('profile-publishPhoto').checked=p?.publishPhoto!==false;$('profile-photoUrl').value=p?.photoUrl||'https://chat-avatars.chateagratis.net/avatar/Chat/{Nick}.png';$('profile-username').value=p?.username||p?.nick||'';$('profile-realName').value=p?.realName||'HexDreams IRC';$('profile-commandDelay').value=p?.commandDelay||1000;editingPhoto=p?.photo||'';updatePhotoPreview();$('profile-commands').value=(p?.commands||[]).join('\n');
  if(p&&api.advanced){const currentId=p.id,initialCommands=$('profile-commands').value;api.advanced('network.commands.get',{network:p.id}).then(r=>{if($('profile-id').value===currentId&&$('profile-commands').value===initialCommands&&r.commands)$('profile-commands').value=r.commands.join('\n');}).catch(e=>notify(e.message,true));}
  for(const key of ['ownNickColor','textColor'])$('profile-'+key).value=p?.[key]||config.settings.ownNickColor||'#c0adf1';$('profile-textStyle').value=p?.textStyle||'normal';$('profile-customText').checked=!!(p?.textColor||p?.textStyle);
  $('profile-channels').value = p?.channels.join(', ') || ''; $('profile-tls').checked = p?.tls ?? true; $('profile-password').value = ''; $('network-error').textContent = '';
  if (!$('network-dialog').open) $('network-dialog').showModal(); $('profile-name').focus();
}
async function toggleConnection(id = active?.id||selectedNetworkId||config.profiles[0]?.id) {
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
  help: () => info('Comandos y atajos', ['/join #sala · /part · /nick apodo · /me acción', '/msg apodo mensaje · /whois apodo · /topic texto · /quit', 'Para enviar un mensaje que empieza por /, escribe // al principio.', 'Ctrl+N: nueva red · Ctrl+J: entrar en sala · Ctrl+U: ocultar usuarios · Ctrl+,: configuración.', 'Las salas y privados se abren desde el árbol izquierdo. Arrastra el borde izquierdo de la conversación para ajustar la barra lateral.']),
  about: () => info('HexDreams IRC', ['Versión ' + (appVersion) + ' · Cliente IRC para Windows.', 'Cliente de escritorio con IRCv3, autenticación SASL, historial opcional, DCC, cifrado y scripts .hex.', 'Las funciones dependen de las capacidades de cada servidor. Revisa Herramientas para configurarlas.'])
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
  const p = { ...profile(id), id, name: $('profile-name').value.trim() || host, host, port: Number($('profile-port').value), nick, tls: $('profile-tls').checked, channels,username:$("profile-username").value.trim()||nick,realName:$("profile-realName").value.replace(/\r?\n/g,' '),alternateNick:$('profile-alternateNick').value.trim()||nick+'_',photoUrl:$('profile-photoUrl').value.trim(),photo:editingPhoto,publishPhoto:$('profile-publishPhoto').checked,commandDelay:Number($("profile-commandDelay").value),commands:[],ownNickColor:$('profile-ownNickColor').value,textColor:$('profile-customText').checked?$('profile-textColor').value:undefined,textStyle:$('profile-customText').checked?$('profile-textStyle').value:undefined };
  const previousProfiles=[...config.profiles];
  const previous = config.profiles.findIndex(p => p.id === id); if (previous < 0) config.profiles.push(p); else config.profiles[previous] = p;
  const password = $('profile-password').value;
  try { const commands=$('profile-commands').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);if(api.advanced){const r=await api.advanced('network.commands.save',{network:id,commands});if(r.error)throw new Error(r.error);p.commands=r.publicCommands||[];}else p.commands=commands;await persist(); } catch (e) { config.profiles=previousProfiles;$('network-error').textContent = e.message; return; }
  window.resetDreamsAvatars?.();if(api.advanced){try{const r=await api.advanced('identity.publish',{network:id});if(r?.error)notify(r.error,true);else if(r?.unsupported)notify('Esta red no admite publicar fotos mediante METADATA.');}catch(e){notify(e.message,true);}}if (password) passwords.set(id, password); $('profile-password').value = '';
  if (network(id).state === 'disconnected') network(id).nick = nick;
  $('network-dialog').close(); choose(id, previous>=0&&active?.id===id?active.target:'*'); if ($('settings-dialog').open) renderProfiles();
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
  const result = await api.send({ id,target,text:composeText(text) });
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
  else if (['ArrowUp','ArrowDown'].includes(e.key) && (e.ctrlKey || !e.target.value || c.historyIndex >= 0) && c.history.length) {
    e.preventDefault(); if (c.historyIndex < 0) c.historyDraft = e.target.value;
    c.historyIndex = e.key === 'ArrowUp' ? Math.min(c.history.length-1,c.historyIndex + 1) : Math.max(-1,c.historyIndex - 1);
    e.target.value = c.historyIndex < 0 ? c.historyDraft || '' : c.history[c.history.length - 1 - c.historyIndex]; c.draft = e.target.value; previewFormat();
  }
});
$('search').addEventListener('input',renderSidebar); $('user-search').addEventListener('input',renderUsers);
$('network-select').onchange = e => { const id = e.target.value;if(id==='__add_network__'){e.target.value=active?.id||config.profiles[0]?.id||id;openNetwork();return;} const n = network(id); const target = n.lastTarget && n.conversations.has(fold(n.lastTarget)) ? n.lastTarget : '*'; if (active) network(active.id).lastTarget = active.target; choose(id,target); };
$('private-sort').onchange = e => { config.settings.privateSort = e.target.value; renderSidebar(); persist().catch(() => {}); };
$('message-search').oninput = () => renderMessages();
$('settings-search').oninput = filterSettings;
$('new-messages').onclick = goLatest;
$('messages').addEventListener('scroll',() => {
  const list = $('messages'), c = selected(); if (!c || $('message-search').value) return;
  c.scrollTop = list.scrollTop; c.follow = list.scrollHeight - list.scrollTop - list.clientHeight < 70;
  if (c.follow) { c.unread = 0; c.mentions = 0; $('new-messages').hidden = true; }
});
for (const key of ['compact','timestamps','showPrivates','showUsers','showTopic','showEvents','eventShowHost','autoScroll']) $('setting-' + key).onchange = () => { config.settings[key] = $('setting-' + key).checked;if(key==='showUsers'&&selected())delete selected().showUsers;applySettings(); render(); persist().catch(() => {}); };
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
      if(event.state==='disconnected')n.ircOper=false;
      if(event.state==='connected'&&!active&&id===(selectedNetworkId||config.profiles[0]?.id))choose(id,'*',false);
      if (event.state === 'disconnected') {n.conversations.clear();n.lastTarget='*';if(active?.id===id){active=null;workspace.active=null;$('message-input').value='';selectedMessages.clear();}window.closeDreamsNetworkWindows?.(id);persist().catch(()=>{});}
      break;
    case 'problem': addMessage(id, '*', { event: true, error: true, text: event.text }); notify(event.text, true); break;
    case 'server': addMessage(id,event.target||'*',{event:true,text:event.text,error:event.error,time:event.time||new Date().toISOString()}); break;
    case 'query': conversation(id,event.target);if(event.whois)window.openDreamsWhois?.(id,event.whois,{request:false});break;
    case 'modes': conversation(id,event.target).modes = event.text; break;
    case 'message': addMessage(id, event.target && event.target !== '*' ? event.target : '*', event); break;
    case 'users': if(event.prefixes)n.prefixes=event.prefixes;if(event.prefixModes)n.prefixModes=event.prefixModes;conversation(id,event.target).users=event.users.map(user=>statusPrefix(user,n)+bareNick(user,n));break;
    case 'oper-state':n.ircOper=event.oper;break;
    case 'topic': conversation(id, event.target).topic = event.text; break;
    case 'channel': {
      if (!n.conversations.has(fold(event.target)) && event.action !== 'join') break;
      const c = conversation(id, event.target);
      if (event.own) { c.joined = event.action === 'join'; if (!c.joined) c.users = []; }
      const verb = { join: 'ha entrado en la sala', part: 'ha salido de la sala', quit: 'se ha desconectado', kick: 'ha sido expulsado' }[event.action];
      addMessage(id, event.target, { event: true,eventType:event.action,nick:event.nick,ident:event.ident||'',host:event.host||'',reason:(event.by?'Por '+event.by+' · ':'')+(event.reason||''),own:event.own, activity:config.settings.highlightEvents!==false, text: event.nick + ' ' + verb });
      if (event.own && event.action === 'join') choose(id,event.target,false);
      break;
    }
    case 'room-event':addMessage(id,event.target,{event:true,text:event.text,eventType:'sanction',activity:config.settings.highlightEvents!==false});break;
    case 'clones': addMessage(id,event.target,{event:true,eventType:'clones',nicks:event.nicks,host:event.host,activity:config.settings.showClones!==false&&config.settings.highlightEvents!==false,text:'Posibles clones (mismo host): '+event.nicks.join(', ')});break;
    case 'nick': {
      for(const c of n.conversations.values())if(c.kind==='channel'&&((event.targets||[]).some(t=>fold(t)===fold(c.name))||c.users.some(u=>[fold(event.old),fold(event.nick)].includes(fold(bareNick(u,n))))))addMessage(id,c.name,{event:true,eventType:'nick',oldNick:event.old,nick:event.nick,own:event.own,activity:config.settings.highlightEvents!==false,text:event.old+' → '+event.nick+' cambió de nick'});
      if (event.own) n.nick = event.nick;
      for(const c of n.conversations.values())c.users=c.users.map(user=>fold(bareNick(user,n))===fold(event.old)?statusPrefix(user,n)+event.nick:user);
      if(fold(event.old)!==fold(event.nick)&&n.userStates?.[fold(event.old)]){n.userStates[fold(event.nick)]=n.userStates[fold(event.old)];delete n.userStates[fold(event.old)];}
      if(n.avatars){delete n.avatars[fold(event.old)];delete n.avatars[fold(event.nick)];n.avatarRevision=(n.avatarRevision||0)+1;}
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
    workspace = new DreamsWorkspace.Workspace(config.profiles,{}); networks = workspace.networks; active = null;workspace.active=null;selectedNetworkId=config.profiles[0]?.id||null;
    appVersion = result.version || '0.4.0';
    if (active) $('message-input').value = selected().draft;
    applySettings(); previewFormat();render();
    if (result.warnings?.length) notify(result.warnings.join(' '), true);
  } catch (error) { notify('No se pudo iniciar la interfaz: ' + error.message, true); }
})();
