'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {IrcClient}=require('../src/irc'),{Runtime}=require('../src/services/runtime');
function client(){const c=new IrcClient({host:'localhost',port:6667,nick:'Me',tls:false,channels:[],notifyNicks:['Alice']}),events=[];c.on('connection-error',e=>events.push(e));c.sendRaw=line=>c.presence.observe(line);return{c,events};}
test('G/Z/K-line errors preserve the actual reason and registration rejection code',()=>{
 for(const reason of ['G-lined: prueba de red','Z-lined: prueba de IP','K-lined: política local']){const {c,events}=client(),states=[];c.on('status',e=>states.push(e));c.receive(Buffer.from(':s 465 Me :'+reason+'\r\n'));assert.equal(events[0].reason,reason);assert.equal(events[0].code,'465');assert.equal(events[0].stage,'connect');assert.equal(states.at(-1).reason,reason);c.presence.stop();c.clones.stop();}
 const {c,events}=client();c.ready=true;c.receive(Buffer.from('ERROR :Closing Link: K-lined por política\r\n'));assert.equal(events[0].stage,'disconnect');assert.ok(events[0].reason.includes('K-lined'));c.presence.stop();c.clones.stop();
});
test('Server ban NOTICE is visible even without a joined room and manual disconnect is not an error',()=>{
 const {c,events}=client();c.receive(Buffer.from(':s NOTICE Me :You are G-lined: motivo remoto\r\n'));assert.equal(events.length,1);assert.equal(events[0].fatal,false);c.disconnect();c.fail('error de cierre manual');assert.equal(events.length,1);c.presence.stop();c.clones.stop();
});
test('Notify background numerics are tagged while presence events and manual ISON remain available',()=>{
 const {c}=client(),server=[],presence=[];c.ready=true;c.on('server',e=>server.push(e));c.on('presence',e=>presence.push(e));c.presence.poll();c.receive(Buffer.from(':s 303 Me :Alice\r\n'));assert.equal(server.at(-1).routinePresence,true);assert.equal(presence.at(-1).online,true);
 c.sendRaw('ISON Alice');c.receive(Buffer.from(':s 303 Me :Alice\r\n'));assert.notEqual(server.at(-1).routinePresence,true);
 c.receive(Buffer.from(':s 731 Me :Alice\r\n'));assert.equal(server.at(-1).routinePresence,true);assert.equal(presence.at(-1).online,false);c.presence.stop();c.clones.stop();
});
test('Runtime keeps NUMERIC script hooks but omits routine Notify replies from logs and Status',async()=>{
 const seen=[],emitted=[],logs=[],context={getConfig:()=>({settings:{},profiles:[]}),scripts:{event:async(name,f)=>{seen.push([name,f]);return{text:f.text};}},writeTextLog:(...args)=>logs.push(args),emit:(...args)=>emitted.push(args)};
 await Runtime.prototype.receive.call(context,'a','server',{code:'303',text:'Alice Bob',routinePresence:true});assert.equal(seen[0][0],'NUMERIC');assert.equal(logs.length,0);assert.equal(emitted.length,0);
 await Runtime.prototype.receive.call(context,'a','server',{code:'303',text:'Manual ISON'});assert.equal(emitted.length,1);
 await Runtime.prototype.receive.call(context,'a','connection-error',{reason:'ECONNREFUSED localhost',stage:'connect'});assert.equal(context.notificationLog[0].kind,'connection');assert.ok(emitted.at(-1)[2].text.includes('ECONNREFUSED'));assert.equal(require('../src/status-filters').visible({critical:true,error:true},{errors:false}),true);
});
test('Unexpected socket closure reports an honest generic reason when the server gives none',async()=>{
 const net=require('node:net'),server=net.createServer(socket=>{socket.on('error',()=>{});socket.write(':s 001 Me :Welcome\r\n');setTimeout(()=>socket.destroy(),30);});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const c=new IrcClient({host:'127.0.0.1',port:server.address().port,nick:'Me',tls:false,channels:[]}),errors=[];c.on('connection-error',e=>errors.push(e));const closed=new Promise(resolve=>c.on('status',e=>{if(e.state==='disconnected')resolve(e);}));
 try{c.connect();const state=await closed;assert.ok(state.reason.includes('sin indicar el motivo'));assert.equal(errors.length,1);assert.equal(errors[0].stage,'disconnect');assert.ok(!/G-line|Z-line/.test(state.reason));}finally{c.disconnect();c.presence.stop();c.clones.stop();server.close();}
});
test('A system notification failure cannot hide the connection diagnosis',async()=>{
 const events=[],context={getConfig:()=>({settings:{},profiles:[]}),getWindow:()=>({isFocused:()=>false}),electron:{Notification:class{static isSupported(){return true;}show(){throw Error('OS notifications unavailable');}}},writeTextLog:()=>{},emit:(...e)=>events.push(e)};
 await Runtime.prototype.receive.call(context,'a','connection-error',{reason:'Z-lined: prueba',stage:'connect'});assert.ok(events.some(e=>e[1]==='connection-error'&&e[2].text.includes('Z-lined')));assert.equal(context.notificationLog.length,1);
});
