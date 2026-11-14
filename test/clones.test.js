const {test}=require('node:test'),assert=require('node:assert/strict');
const {IrcClient,parseLine}=require('../src/irc');
test('Clone candidates require a shared visible host in the same room, update after nick changes and reset on PART',t=>{
 const c=new IrcClient({host:'localhost',port:6667,nick:'Me',tls:false,channels:[],avatarDiscovery:false});c.ready=true;c.sendRaw=()=>{};t.after(()=>c.clones.stop());const events=[];c.on('clones',e=>events.push(e));
 const line=text=>c.handle(parseLine(text));line(':Me!me@self JOIN :#one');line(':Alice!a@shared.example JOIN :#one');line(':Bob!b@shared.example JOIN :#two');c.clones.check();assert.equal(events.length,0);
 line(':Bob!b@shared.example JOIN :#one');c.clones.check();assert.equal(events.length,1);assert.deepEqual(events[0].nicks,['Alice','Bob']);assert.equal(events[0].target,'#one');c.clones.check();assert.equal(events.length,1);
 line(':Alice!a@shared.example NICK :Alicia');c.clones.check();assert.deepEqual(events.at(-1).nicks,['Alicia','Bob']);
 line(':Bob!b@shared.example PART #one :bye');c.clones.check();const count=events.length;line(':Bob!b@shared.example JOIN :#one');c.clones.check();assert.equal(events.length,count+1);
 line(':Alicia!a@shared.example CHGHOST a separate.example');c.clones.check();assert.equal(c.clones.previous.size,0);
});
