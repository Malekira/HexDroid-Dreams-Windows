const{test}=require('node:test'),assert=require('node:assert/strict');const{Runtime}=require('../src/services/runtime');
function fixture(settings={},focused=true){let sounds=0,events=[];const window={isFocused:()=>focused,setOverlayIcon(){},flashFrame(){}};const context={getConfig:()=>({settings:{notifications:true,mentionSound:true,privateSound:true,notifyWhileFocused:true,notifyInCurrentRoom:true,...settings},workspace:{networks:[]}}),getWindow:()=>window,activeConversation:{id:'net',target:'#room'},sessions:{get:()=>({nick:'Me'})},electron:{shell:{beep:()=>sounds++},app:{setBadgeCount(){}},nativeImage:{createFromPath:()=>({})},Notification:{isSupported:()=>false}},emit:(...e)=>events.push(e),badge:0};return{context,sounds:()=>sounds,events};}
test('Mention sound and visual attention work even while viewing the same room',()=>{const f=fixture();Runtime.prototype.notify.call(f.context,'net',{nick:'Alice',target:'#room',text:'Me: hola'});assert.equal(f.sounds(),1);assert.ok(f.events.some(e=>e[1]==='attention'));});
test('Focused-window, current-room, mute and sound preferences are respected',()=>{for(const settings of [{notifyWhileFocused:false},{notifyInCurrentRoom:false},{notifications:false}]){const f=fixture(settings);Runtime.prototype.notify.call(f.context,'net',{target:'#room',text:'Me hola'});assert.equal(f.sounds(),0);}const f=fixture({mentionSound:false});Runtime.prototype.notify.call(f.context,'net',{target:'#room',text:'Me hola'});assert.equal(f.sounds(),0);const background=fixture({notifyWhileFocused:false},false);Runtime.prototype.notify.call(background.context,'net',{target:'#room',text:'Me hola'});assert.equal(background.sounds(),1);});
test('Silencing an individual user suppresses their sound and visual notification in rooms',()=>{const f=fixture({mutedUsers:{net:['Alice']}});Runtime.prototype.notify.call(f.context,'net',{nick:'ALICE',target:'#room',text:'Me: hola'});assert.equal(f.sounds(),0);assert.equal(f.events.length,0);});
test('Notify alerts are silent initially and honor sound and offline preferences',async()=>{const f=fixture();await Runtime.prototype.receive.call(f.context,'net','presence',{nick:'Alice',online:true,initial:true});assert.equal(f.sounds(),0);await Runtime.prototype.receive.call(f.context,'net','presence',{nick:'Alice',online:false,initial:false});assert.equal(f.sounds(),1);assert.ok(f.events.some(e=>e[1]==='presence-alert'));const quiet=fixture({notifyPresenceSound:false});await Runtime.prototype.receive.call(quiet.context,'net','presence',{nick:'Alice',online:true,initial:false});assert.equal(quiet.sounds(),0);});
test('Bell records mentions and NOTICE even when focused alerts are disabled; read and clear are explicit',async()=>{
 const f=fixture({notifyWhileFocused:false,notifyInCurrentRoom:false});
 Runtime.prototype.notify.call(f.context,'net',{nick:'Alice',target:'#room',text:'Me: hola',time:'2026-11-06T00:00:00Z'});
 Runtime.prototype.notify.call(f.context,'net',{nick:'Service',target:'#room',text:'NOTICE sin mencionar',notice:true});
 Runtime.prototype.notify.call(f.context,'net',{nick:'Alice',target:'#room',text:'Sin mención'});
 assert.equal(f.context.notificationLog.length,2);assert.deepEqual(f.context.notificationLog.map(e=>e.kind),['mention','notice']);assert.equal(f.sounds(),0);
 const rows=await Runtime.prototype.action.call(f.context,'notifications.list');assert.equal(rows.length,2);
 await Runtime.prototype.action.call(f.context,'notifications.read',{keys:[rows[0].key]});assert.equal(rows[0].read,true);assert.equal(rows[1].read,false);
 await Runtime.prototype.action.call(f.context,'notifications.clear');assert.equal(f.context.notificationLog.length,0);
});
test('Bell is bounded and ignores historical or own messages',()=>{
 const f=fixture({notifications:false});for(let i=0;i<510;i++)Runtime.prototype.notify.call(f.context,'net',{nick:'Alice',target:'#room',text:'Me '+i});
 assert.equal(f.context.notificationLog.length,500);assert.equal(f.context.notificationLog[0].text,'Me 10');
 for(const extra of [{own:true},{historical:true}])Runtime.prototype.notify.call(f.context,'net',{nick:'Alice',target:'#room',text:'Me hola',...extra});assert.equal(f.context.notificationLog.length,500);
});
test('Disabling outgoing typing blocks active TAGMSG without changing received messages',async()=>{
 const f=fixture({sendTyping:false});let sent=[];f.context.sessions.get=()=>({sendTyping:(...args)=>sent.push(args)});
 await Runtime.prototype.action.call(f.context,'typing',{network:'net',target:'#room',state:'active'});assert.deepEqual(sent,[]);
 await Runtime.prototype.action.call(f.context,'typing',{network:'net',target:'#room',state:'done'});assert.deepEqual(sent,[['#room','done']]);
});
