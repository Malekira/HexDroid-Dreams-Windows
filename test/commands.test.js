const { test } = require('node:test');
const assert = require('node:assert/strict');
const { executeInput } = require('../src/commands');
function client() { return { ready:true,nick:'Dreamer',lines:[],messages:[],sendRaw(line){this.lines.push(line);},sendMessage(target,text,action){this.messages.push({target,text,action});},join(name){this.lines.push('JOIN '+name);},disconnect(){this.ready=false;} }; }
test('Context moderation and WHOIS commands use actual IRC lines', () => {
  const c = client(); for (const text of ['/whois Alice','/who Alice','/voice Alice','/op Alice','/kick Alice reason','/invite Bob']) executeInput(c,'#room',text);
  assert.deepEqual(c.lines,['WHOIS Alice','WHO Alice','MODE #room +v Alice','MODE #room +o Alice','KICK #room Alice :reason','INVITE Bob #room']);
});
test('Multiline sends separate valid IRC messages and rejects oversized input before sending anything', () => {
  const c = client(); executeInput(c,'#room','first\nsecond'); assert.equal(c.messages.length,2);
  c.messages = []; assert.throws(() => executeInput(c,'#room','valid\n'+'é'.repeat(300)),/demasiado larga/); assert.equal(c.messages.length,0);
  assert.throws(() => executeInput(c,'#room','/raw PRIVMSG #room :text\r\nOPER x y')); assert.equal(c.lines.length,0);
});
test('Query opens a private locally and raw remains available without faking unsupported capabilities', () => {
  const c = client(), events = []; executeInput(c,'*','/query Alice',(type,data) => events.push({type,...data}));
  assert.deepEqual(events,[{type:'query',target:'Alice'}]); assert.equal(c.lines.length,0);
  executeInput(c,'*','/raw HELP'); assert.equal(c.lines[0],'HELP');
  assert.throws(() => executeInput(c,'Alice','/kick Bob'),/Selecciona una sala/);
});
test('Login, nick and identify work directly without raw',()=>{
 const lines=[],messages=[],client={ready:true,nick:'Me',sendRaw:line=>lines.push(line),sendMessage:(target,text)=>messages.push({target,text})};executeInput(client,'*','/login account password');executeInput(client,'*','/nick NewNick');executeInput(client,'*','/identify account password');assert.deepEqual(lines,['LOGIN account password','NICK NewNick']);assert.deepEqual(messages,[{target:'NickServ',text:'IDENTIFY account password'}]);assert.throws(()=>executeInput(client,'*','/identify'),/Uso/);
});
test('/j and /join accept room names with and without a channel prefix',()=>{const c=client();for(const command of ['/j sala','/j #sala','/join sala','/join &local'])executeInput(c,'*',command);assert.deepEqual(c.lines,['JOIN #sala','JOIN #sala','JOIN #sala','JOIN &local']);assert.throws(()=>executeInput(c,'*','/j'));});
