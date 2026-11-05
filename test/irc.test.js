'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const tls = require('node:tls');
const fs = require('node:fs');
const path = require('node:path');
const { once } = require('node:events');
const { IrcClient, parseLine, fold, validateProfile } = require('../src/irc');
const profile = { host: '127.0.0.1', port: 6667, nick: 'Dreamer', tls: false, channels: ['#dreams'] };
async function waitFor(predicate, timeout = 3000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (predicate()) return; await new Promise(r => setTimeout(r, 10)); }
  assert.fail('No se recibió el evento esperado');
}
test('IRC parser handles tags, prefixes, trailing text and case mapping', () => {
  const m = parseLine('@time=2026-11-05T12:00:00Z;label=a\\sb\\:c :Alice!user@host PRIVMSG #dreams :hello : world');
  assert.equal(m.nick, 'Alice'); assert.equal(m.tags.label, 'a b;c');
  assert.deepEqual(m.params, ['#dreams', 'hello : world']);
  assert.equal(parseLine('PING :server').params[0], 'server');
  assert.equal(parseLine(':broken'), null); assert.equal(fold('[Nick]\\^'), '{nick}|~');
});
test('Profile validation rejects command injection and invalid ports', () => {
  assert.throws(() => validateProfile({ ...profile, nick: 'test\r\nOPER admin password' }));
  assert.throws(() => validateProfile({ ...profile, host: 'irc.example.com path' }));
  assert.throws(() => validateProfile({ ...profile, port: 0 }));
  assert.throws(() => validateProfile({ ...profile, channels: ['not-a-channel'] }));
  assert.equal(validateProfile(profile).tls, false);
});
test('Local IRC workflow registers, joins, answers PING, receives users, chats and disconnects', async t => {
  let peer, buffer = ''; const received = [];
  const server = net.createServer(socket => {
    peer = socket; socket.setEncoding('utf8');
    socket.on('data', data => {
      buffer += data;
      let end;
      while ((end = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 2); received.push(line);
        if (line.startsWith('USER ')) socket.write(':local 001 Dreamer :Welcome\r\nPING :keepalive\r\n');
        if (line === 'JOIN #dreams') {
          socket.write(':Dreamer!u@host JOIN :#dreams\r\n:local 353 Dreamer = #dreams :@Alice +Bob Dreamer\r\n');
          socket.write(':local 332 Dreamer #dreams :Welcome to Dreams\r\n:Alice!u@host PRIVMSG #dreams :Hel');
          setTimeout(() => { if (!socket.destroyed) socket.write('lo Dreams\r\n:Bob!u@host PRIVMSG Dreamer :private hello\r\n'); }, 15);
        }
      }
    });
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const client = new IrcClient({ ...profile, port: server.address().port });
  t.after(() => { client.socket?.destroy(); peer?.destroy(); server.close(); });
  const events = [], problems = [];
  for (const type of ['status','message','users','channel','topic','nick']) client.on(type, data => events.push({ type, ...data }));
  client.on('problem', p => problems.push(p)); client.connect();
  await waitFor(() => events.some(e => e.type === 'message' && e.text === 'private hello'));
  assert.ok(received.includes('NICK Dreamer')); assert.ok(received.includes('USER Dreamer 0 * :HexDroid Dreams'));
  assert.ok(received.includes('PONG :keepalive'));
  assert.ok(events.some(e => e.type === 'users' && e.users.includes('@Alice')));
  assert.ok(events.some(e => e.type === 'topic' && e.text === 'Welcome to Dreams'));
  assert.ok(events.some(e => e.type === 'message' && e.text === 'Hello Dreams' && e.target === '#dreams'));
  assert.ok(events.some(e => e.type === 'message' && e.text === 'private hello' && e.target === 'Bob'));
  client.sendMessage('#dreams', 'Hola 👋'); client.sendMessage('Alice', 'saluda', true);
  assert.throws(() => client.sendMessage('#dreams', 'bad\r\nOPER root secret'));
  assert.throws(() => client.sendMessage('#dreams', 'é'.repeat(300)), /demasiado largo/);
  await waitFor(() => received.includes('PRIVMSG Alice :\x01ACTION saluda\x01'));
  assert.ok(received.includes('PRIVMSG #dreams :Hola 👋'));
  peer.write(':Bob!u@host NICK :Bobby\r\n:Alice!u@host PART #dreams :bye\r\n');
  await waitFor(() => events.some(e => e.type === 'nick' && e.nick === 'Bobby'));
  assert.ok(events.some(e => e.type === 'users' && e.users.includes('+Bobby') && !e.users.includes('@Alice')));
  client.disconnect(); await waitFor(() => client.socket === null);
  assert.ok(received.includes('QUIT :Hasta pronto')); assert.deepEqual(problems, []);
});
test('TLS refuses an untrusted certificate instead of silently disabling verification', async t => {
  const server = tls.createServer({ key: fs.readFileSync(path.join(__dirname, 'fixtures/server.key')), cert: fs.readFileSync(path.join(__dirname, 'fixtures/server.crt')) });
  server.on('tlsClientError', () => {}); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const client = new IrcClient({ ...profile, port: server.address().port, tls: true });
  t.after(() => { client.socket?.destroy(); server.close(); });
  const problem = once(client, 'problem'); client.connect();
  const [message] = await problem;
  assert.match(message, /self.signed|certificate/i);
  await waitFor(() => client.socket === null); assert.equal(client.ready, false);
});
