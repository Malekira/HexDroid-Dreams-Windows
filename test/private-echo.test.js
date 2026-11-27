'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {IrcClient}=require('../src/irc');
for(const labeled of [false,true])test('a suppressed addon reply stays hidden after the server echo '+(labeled?'with label':'without label'),()=>{
 const c=new IrcClient({host:'localhost',port:6667,tls:false,nick:'Me',channels:[]}),messages=[],wire=[];c.ready=true;c.capabilities.add('echo-message');if(labeled)c.capabilities.add('labeled-response');c.sendRaw=line=>wire.push(line);c.on('message',m=>messages.push(m));
 c.sendMessage('Alice','Espera por favor',false,{noEcho:true,clientId:'reply-id'});assert.equal(messages.length,0);
 c.receive(Buffer.from((labeled?'@label=reply-id ':'')+':Me!u@h PRIVMSG Alice :Espera por favor\r\n'));assert.equal(messages.length,0);assert.equal(c.pendingEcho.size,0);
 c.sendMessage('Alice','Aceptado',false,{clientId:'normal-id'});assert.equal(messages.length,1);
 c.receive(Buffer.from((labeled?'@label=normal-id ':'')+':Me!u@h PRIVMSG Alice :Aceptado\r\n'));assert.equal(messages.at(-1).text,'Aceptado');assert.equal(messages.at(-1).pending,false);
});

test('held replies stay silent for existing queries and a rejection cannot reopen a closed query',()=>{
 const {prepare}=require('../src/scripts/mirc/host'),client={ready:true},fields={buffer:'Alice',queries:['Alice'],suppressPrivateEcho:true};
 assert.equal(prepare([{type:'msg',text:'Alice wait'}],fields,client)[0].noEcho,true);
 const actions=prepare([{type:'close',text:'Alice'},{type:'msg',text:'Alice rejected'}],{buffer:'Alice',queries:['Alice']},client);assert.equal(actions[1].noEcho,true);
});
