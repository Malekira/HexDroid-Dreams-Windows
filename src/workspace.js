(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DreamsWorkspace = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const plain=typeof module==='object'&&module.exports?require('./formatting').plain:text=>globalThis.DreamsFormatting?.plain(text)??text;
  const fold = s => String(s).toLowerCase().replace(/[\[\]\\^]/g, c => ({ '[':'{', ']':'}', '\\':'|', '^':'~' })[c]);
  const kind = name => name === '*' ? 'server' : name==='*consultas*'?'queries': /^[#&+!]/.test(name) ? 'channel' : 'private';
  function sanitizeWorkspace(input, profiles = []) {
    const output = { networks: [], active: null };
    for (const p of profiles) {
      const saved = Array.isArray(input?.networks) ? input.networks.find(n => n?.id === p.id) : null;
      const conversations = [], seen = new Set();
      for (const entry of Array.isArray(saved?.conversations) ? saved.conversations.slice(0, 500) : []) {
        if (!entry || typeof entry.name !== 'string' || !entry.name || entry.name.length > 200 || /[\s\0\r\n:,]/.test(entry.name) || entry.name === '*') continue;
        const key = fold(entry.name); if (seen.has(key)) continue; seen.add(key);
        conversations.push({ name: entry.name, muted: entry.muted === true });
      }
      const lastTarget = saved?.lastTarget === '*' || conversations.some(c => fold(c.name) === fold(saved?.lastTarget)) ? saved.lastTarget : '*';
      output.networks.push({ id: p.id, conversations, lastTarget });
    }
    if (input?.active && typeof input.active.target === 'string') {
      const n = output.networks.find(n => n.id === input.active.id);
      if (n && (input.active.target === '*' || n.conversations.some(c => fold(c.name) === fold(input.active.target)))) output.active = { id: n.id, target: input.active.target };
    }
    return output;
  }
  class Workspace {
    constructor(profiles = [], saved = {}) {
      this.profiles = profiles; this.networks = new Map(); this.active = null;
      const state = sanitizeWorkspace(saved, profiles);
      for (const n of state.networks) { this.network(n.id).lastTarget = n.lastTarget; for (const c of n.conversations) this.conversation(n.id, c.name).muted = c.muted; }
      this.active = state.active || (profiles[0] ? { id: profiles[0].id, target: '*' } : null);
    }
    network(id) {
      if (!this.networks.has(id)) this.networks.set(id, { state:'disconnected', nick:this.profiles.find(p => p.id === id)?.nick || '', prefixes:'@+', prefixModes:'ov', conversations:new Map() });
      return this.networks.get(id);
    }
    conversation(id, name = '*') {
      const n = this.network(id), key = fold(name);
      if (!n.conversations.has(key)) n.conversations.set(key, { name, kind:kind(name), messages:[], users:[], topic:'', modes:'', unread:0, mentions:0, joined:false, muted:false, draft:'', scrollTop:0, follow:true, history:[], historyIndex:-1 });
      return n.conversations.get(key);
    }
    choose(id, target) { this.active = { id, target }; const c = this.conversation(id, target); this.network(id).lastTarget = target; c.unread = 0; c.mentions = 0;c.activityUntil=0;c.mentionUntil=0; return c; }
    addMessage(id, target, message) {
      const n = this.network(id), c = this.conversation(id, target);
      const existing=c.messages.find(m=>(message.messageId&&m.messageId===message.messageId)||(message.clientId&&m.clientId===message.clientId));
      if(existing){c.revision=(c.revision||0)+1;Object.assign(existing,message,{id:existing.id});return existing;}
      const nick = fold(n.nick), words = fold(plain(message.text || '')).split(/[^\p{L}\p{N}_\-{}|~]+/u);
      const mention = !message.own && !message.event && !!nick && words.includes(nick);
      const m = { time:new Date().toISOString(), ...message, mention, id: `${Date.now()}-${++Workspace.sequence}` };
      c.messages.push(m); if (c.messages.length > 600) c.messages.splice(0, c.messages.length - 600);
      if(!m.own&&!m.historical&&(!m.event||m.activity)){c.activityUntil=Date.now()+4000;if(m.mention)c.mentionUntil=Date.now()+4000;}
      if ((!m.event||m.activity) && !m.own && !m.historical && (!this.active || this.active.id !== id || fold(this.active.target) !== fold(target) || !c.follow)) {
        if (!c.unread) c.firstUnreadId = m.id;
        c.unread++; if (mention) c.mentions++;
      }
      return m;
    }
    move(id, name, before) {
      const n = this.network(id), c = n.conversations.get(fold(name)), target = n.conversations.get(fold(before));
      if (!c || !target || c === target || c.kind !== target.kind) return false;
      const entries = [...n.conversations.entries()].filter(([key]) => key !== fold(name));
      entries.splice(entries.findIndex(([key]) => key === fold(before)), 0, [fold(name), c]); n.conversations = new Map(entries); return true;
    }
    serialize() {
      return sanitizeWorkspace({ active:this.active, networks:[...this.networks].map(([id,n]) => ({ id, lastTarget:n.lastTarget, conversations:[...n.conversations.values()].filter(c => c.kind !== 'server').map(c => ({ name:c.name, muted:c.muted })) })) }, this.profiles);
    }
  }
  Workspace.sequence = 0;
  function panelSizes(width, settings) {
    let left = settings.showPrivates === false ? 0 : settings.sidebarWidth;
    let right = settings.showUsers === false ? 0 : settings.usersWidth;
    const budget = Math.max(0, width - 360 - (left ? 5 : 0) - (right ? 5 : 0));
    if (left + right > budget) {
      const ratio = budget / (left + right); left = Math.floor(left * ratio); right = Math.floor(right * ratio);
    }
    return { left, right };
  }
  return { Workspace, fold, kind, sanitizeWorkspace, panelSizes };
});
