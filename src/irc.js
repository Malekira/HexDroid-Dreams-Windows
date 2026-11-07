'use strict';
const net = require('node:net');
const tls = require('node:tls');
const { EventEmitter } = require('node:events');

function parseLine(line) {
  let rest = line, tags = {}, prefix = '';
  if (rest.startsWith('@')) {
    const end = rest.indexOf(' ');
    if (end < 0) return null;
    for (const item of rest.slice(1, end).split(';')) {
      const [key, ...parts] = item.split('=');
      tags[key] = parts.join('=').replace(/\\([:s\\rn])/g, (_, c) => ({ ':': ';', s: ' ', '\\': '\\', r: '\r', n: '\n' })[c]);
    }
    rest = rest.slice(end + 1);
  }
  if (rest.startsWith(':')) {
    const end = rest.indexOf(' ');
    if (end < 0) return null;
    prefix = rest.slice(1, end); rest = rest.slice(end + 1);
  }
  const trailing = rest.indexOf(' :');
  const params = (trailing < 0 ? rest : rest.slice(0, trailing)).trim().split(/ +/);
  const command = params.shift()?.toUpperCase();
  if (!command) return null;
  if (trailing >= 0) params.push(rest.slice(trailing + 2));
  return { tags, prefix, nick: prefix.split('!')[0], command, params };
}
function fold(s) { return String(s).toLowerCase().replace(/[\[\]\\^]/g, c => ({ '[': '{', ']': '}', '\\': '|', '^': '~' })[c]); }
function token(value, name) {
  if (typeof value !== 'string' || !value || /[\s\0\r\n:,]/.test(value) || value.length > 200) throw new Error(`${name} no válido.`);
  return value;
}
function cleanText(text) {
  if (typeof text !== 'string' || /[\0\r\n]/.test(text)) throw new Error('El mensaje debe ocupar una sola línea.');
  return text;
}
const { validateProfile } = require('./services/profiles');

class IrcClient extends EventEmitter {
  constructor(profile, password = '') {
    super(); this.profile = validateProfile(profile); this.nick = profile.nick;
    this.password = cleanText(password); if (Buffer.byteLength(this.password, 'utf8') > 490) throw new Error('Contraseña del servidor demasiado larga.'); this.socket = null; this.ready = false;
    this.buffer = ''; this.members = new Map(); this.prefixes = '@+'; this.prefixModes = 'ov';
  }
  connect() {
    if (this.socket) throw new Error('La red ya está conectando o conectada.');
    const options = { host: this.profile.host, port: this.profile.port };
    this.emit('status', { state: 'connecting', text: 'Conectando…' });
    const connected = () => {
      this.socket.setTimeout(0);
      if (this.password) this.sendRaw(`PASS ${this.password}`);
      this.password = '';
      this.sendRaw(`NICK ${this.nick}`); this.sendRaw(`USER ${this.nick} 0 * :HexDreams IRC`);
      this.registrationTimer = setTimeout(() => this.fail('El servidor no completó el registro IRC en 30 segundos.'), 30000);
      this.registrationTimer.unref();
    };
    this.socket = this.profile.tls
      ? tls.connect({ ...options, servername: net.isIP(options.host) ? undefined : options.host, rejectUnauthorized: true }, connected)
      : net.createConnection(options, connected);
    this.socket.setEncoding('utf8'); this.socket.setTimeout(20000);
    this.socket.on('timeout', () => this.fail('Se agotó el tiempo de conexión.'));
    this.socket.on('data', data => this.receive(data));
    this.socket.on('error', e => this.emit('problem', e.message));
    this.socket.on('close', () => {
      clearTimeout(this.registrationTimer); clearTimeout(this.closeTimer);
      this.socket = null; this.ready = false; this.members.clear();
      this.emit('status', { state: 'disconnected', text: 'Desconectado' });
    });
  }
  fail(message) { this.emit('problem', message); this.socket?.destroy(); }
  receive(data) {
    this.buffer += data;
    if (this.buffer.length > 131072) return this.fail('Respuesta del servidor demasiado grande.');
    let index;
    while ((index = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, index).replace(/\r$/, ''); this.buffer = this.buffer.slice(index + 1);
      const m = parseLine(line); if (m) this.handle(m);
    }
  }
  sendRaw(line) {
    cleanText(line);
    if (!this.socket || this.socket.destroyed || !this.socket.writable) throw new Error('La red no está conectada.');
    if (Buffer.byteLength(line, 'utf8') > 510) throw new Error('Mensaje demasiado largo para IRC (máximo 510 bytes por línea).');
    this.socket.write(line + '\r\n');
  }
  sendMessage(target, text, action = false) {
    if (!this.ready) throw new Error('Espera a que termine la conexión.');
    token(target, 'Destino'); cleanText(text);
    if (!text.trim()) return;
    this.sendRaw(`PRIVMSG ${target} :${action ? '\x01ACTION ' + text + '\x01' : text}`);
    this.emit('message', { target, nick: this.nick, text, action, own: true, time: new Date().toISOString() });
  }
  join(channel) { token(channel, 'Sala'); if (!/^[#&+!]/.test(channel)) throw new Error('La sala debe empezar por #.'); this.sendRaw(`JOIN ${channel}`); }
  userList(channel) {
    const group = this.members.get(fold(channel));
    this.emit('users', { target: channel, users: group ? [...group.values()].sort((a,b) => a.localeCompare(b)) : [], prefixes:this.prefixes, prefixModes:this.prefixModes });
  }
  handle(m) {
    const { command: c, params: p, nick } = m;const mask=/^[^!]+!([^@]*)@(.+)$/.exec(m.prefix||''),identity=mask?{ident:mask[1],host:mask[2]}:{};
    if (c === 'PING') { this.sendRaw(`PONG :${p.at(-1) || ''}`); return; }
    if (c === '001') {
      this.nick = p[0]; this.ready = true; clearTimeout(this.registrationTimer);
      this.emit('status', { state: 'connected', text: `Conectado como ${this.nick}`, nick: this.nick });
      this.emit('nick', { old: this.profile.nick, nick: this.nick, own: true });
      for (const channel of this.profile.channels) this.join(channel);
    }
    if (c === '005') {
      for (const item of p) {
        const match = /^PREFIX=\(([^)]+)\)(.+)$/.exec(item);
        if (match) { this.prefixModes = match[1]; this.prefixes = match[2]; }
      }
    }
    if (c === 'PRIVMSG' || c === 'NOTICE') {
      let text = p[1] || '', action = false;
      if (text.startsWith('\x01ACTION ') && text.endsWith('\x01')) { text = text.slice(8, -1); action = true; }
      else if (text.startsWith('\x01')) return; // Do not display or execute CTCP requests.
      const target = fold(p[0]) === fold(this.nick) ? nick : p[0];
      this.emit('message', { target, nick, text, action, notice: c === 'NOTICE', own: false, time: m.tags.time || new Date().toISOString() });
    } else if (c === 'JOIN') {
      const channel = p[0]; if (!channel) return;
      const key = fold(channel); const own = fold(nick) === fold(this.nick);
      if (own) this.members.set(key, new Map());
      if (!this.members.has(key)) this.members.set(key, new Map());
      this.members.get(key).set(fold(nick), nick); this.userList(channel);
      this.emit('channel', { target: channel, nick, action: 'join', own,...identity });
      if (own) this.sendRaw(`MODE ${channel}`);
    } else if (c === '353') {
      const channel = p[2]; if (!channel) return;
      const key = fold(channel); if (!this.members.has(key)) this.members.set(key, new Map());
      for (const user of (p[3] || '').split(' ').filter(Boolean)) {
        const bare = this.bareNick(user); let i=0;while(i<user.length&&this.prefixes.includes(user[i]))i++;this.members.get(key).set(fold(bare), user.slice(0,i)+bare);
      }
      this.userList(channel);
    } else if (c === 'PART' || c === 'KICK') {
      const channel = p[0], who = c === 'KICK' ? p[1] : nick; if (!channel || !who) return;
      const own = fold(who) === fold(this.nick);
      this.members.get(fold(channel))?.delete(fold(who)); if (!own) this.userList(channel);
      this.emit('channel', { target: channel, nick: who, action: c === 'KICK' ? 'kick' : 'part', own,...(c==='PART'?identity:{}),reason:p[c==='KICK'?2:1]||'' });
      if (own) this.members.delete(fold(channel));
    } else if (c === 'QUIT') {
      for (const [channel, members] of this.members) if (members.delete(fold(nick))) {
        this.userList(channel); this.emit('channel', { target: channel, nick, action: 'quit', own: false,...identity,reason:p[0]||'' });
      }
    } else if (c === 'NICK') {
      const next = p[0]; if (!next) return;
      const own = fold(nick) === fold(this.nick),targets=[]; if (own) this.nick = next;
      for (const [channel, members] of this.members) if (members.has(fold(nick))) {
        targets.push(channel);const old = members.get(fold(nick)); members.delete(fold(nick));
        members.set(fold(next), old.match(/^[~&@%+]*/)[0] + next); this.userList(channel);
      }
      this.emit('nick', { old: nick, nick: next, own,targets });
    } else if (c === 'MODE' && this.members.has(fold(p[0]))) {
      // Refresh NAMES after privilege changes instead of guessing multi-mode arguments.
      this.sendRaw(`NAMES ${p[0]}`);
      this.sendRaw(`MODE ${p[0]}`);
    } else if (c === '324') {
      this.emit('modes', { target:p[1], text:p.slice(2).join(' ') });
    } else if (c === 'TOPIC' || c === '332') {
      this.emit('topic', { target: c === '332' ? p[1] : p[0], text: p.at(-1) || '' });
    } else if (c === 'ERROR') {
      this.fail(p.at(-1) || 'El servidor cerró la conexión.');
    } else if (/^4\d\d$|^5\d\d$/.test(c)) {
      this.emit('problem', p.slice(1).join(' '));
    } else if (!['353','366','005','001'].includes(c)) {
      this.emit('server', { text: p.slice(/^\d+$/.test(c) ? 1 : 0).join(' ') });
    }
  }
  bareNick(user) { let i = 0; while (this.prefixes.includes(user[i]) && i < user.length) i++; return user.slice(i).split('!')[0]; }
  disconnect() {
    if (!this.socket) return;
    if (this.socket.writable && !this.socket.destroyed) { try { this.sendRaw('QUIT :Hasta pronto'); } catch {} this.socket.end(); }
    else this.socket.destroy();
    this.closeTimer = setTimeout(() => this.socket?.destroy(), 1500); this.closeTimer.unref();
  }
}
module.exports = { IrcClient:require('./services/advanced-irc')(IrcClient,{parseLine,fold,token,cleanText}), parseLine, fold, validateProfile, cleanText, token };
