'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {TicTacToe,result,computerMove,encode,decode}=require('../src/games/tictactoe');
function pair(){
 let time=10000,serial=0,on=true;const q=[],events=[],clients={A:{nick:'Alice',ready:true},B:{nick:'Bob',ready:true}};
 function service(who){return new TicTacToe({tick:false,now:()=>time,id:()=>String(++serial).padStart(32,'0'),client:()=>clients[who],enabled:()=>on?[{id:'addon'}]:[],emit:e=>events.push([who,e]),send:(network,peer,body)=>q.push({from:who,network,peer,args:body.slice(6)})});}
 const a=service('A'),b=service('B');function drain(){while(q.length){const m=q.shift(),target=m.from==='A'?b:a;target.receive(m.network,{command:'HDTTT',notice:true,nick:clients[m.from].nick,target:m.peer,args:m.args});}}
 const advance=ms=>{time+=ms;};const start=()=>{const g=a.invite('addon','net','Bob');drain();b.accept('addon',g.id);drain();return g.id;};return {a,b,q,events,clients,drain,advance,start,disable:()=>{on=false;}};
}
test('local game runs offline and minimax never loses for any human move sequence',()=>{
 const ai={ready:false};const s=new TicTacToe({tick:false,client:()=>ai,enabled:()=>[{id:'addon'}],send:()=>assert.fail('solo must not send'),emit:()=>{}});
 const g=s.solo('addon','');s.move('addon',g.id,0);assert.equal(s.games.get(g.id).ply,2);
 let terminals=0;function walk(board){if(result(board)){assert.notEqual(result(board),'X');terminals++;return;}for(let i=0;i<9;i++)if(!board[i]){const next=board.slice();next[i]='X';if(!result(next))next[computerMove(next,'O')]='O';walk(next);}}walk(Array(9).fill(null));assert.ok(terminals>100);
});
test('invite requires acceptance, both clients synchronize legal moves, win and rematch consent',()=>{
 const p=pair(),id=p.start();assert.equal(p.a.games.get(id).status,'playing');assert.equal(p.b.games.get(id).mark,'O');
 for(const [client,cell]of [[p.a,0],[p.b,3],[p.a,1],[p.b,4],[p.a,2]]){p.advance(800);client.move('addon',id,cell);p.drain();}
 assert.deepEqual(p.a.games.get(id).board,p.b.games.get(id).board);assert.equal(p.a.games.get(id).status,'won');assert.equal(p.b.games.get(id).status,'lost');assert.throws(()=>p.a.move('addon',id,8),/disponible/);
 p.advance(800);const next=p.a.rematch('addon',id);p.drain();assert.equal(p.b.games.get(next.id).status,'invited');assert.equal(p.a.games.get(next.id).status,'inviting');
});
test('occupied cells, wrong turns, duplicates, forged peers, other networks and old sequences are rejected',()=>{
 const p=pair(),id=p.start();assert.throws(()=>p.b.move('addon',id,0),/disponible/);p.advance(800);p.a.move('addon',id,0);const original=p.q[0];p.drain();
 const data={command:'HDTTT',notice:true,nick:'Alice',target:'Bob',args:original.args};p.b.receive('net',data);assert.equal(p.b.games.get(id).ply,1);
 for(const [network,nick,n,c]of [['net','Mallory',2,1],['other','Alice',2,1],['net','Alice',9,1],['net','Alice',2,0]]){p.b.receive(network,{...data,nick,args:encode({v:1,t:'move',id,n,c})});assert.equal(p.b.games.get(id).ply,1);}
 assert.throws(()=>p.a.move('addon',id,1),/disponible/);
});
test('decline, cancellation, disconnection, nick changes, expiry and disable stop play',()=>{
 const p=pair(),invite=p.a.invite('addon','net','Bob');p.drain();p.b.end('addon',invite.id);p.drain();assert.equal(p.a.games.get(invite.id).status,'declined');p.advance(1000);
 const id=p.start();p.a.end('addon',id);p.drain();assert.equal(p.b.games.get(id).status,'cancelled');p.advance(1000);
 const id2=p.start();p.a.disconnect('net');assert.equal(p.a.games.get(id2).status,'disconnected');p.b.nickChange('net','Alice','A2',false);assert.equal(p.b.games.get(id2).status,'disconnected');p.advance(1000);
 const id3=p.a.invite('addon','net','Bob').id;p.drain();p.advance(91000);p.a.expire();p.b.expire();assert.equal(p.a.games.get(id3).status,'expired');
 const id4=p.start();p.disable();p.a.prune();assert.equal(p.a.games.get(id4).status,'disabled');assert.throws(()=>p.a.move('addon',id4,1),/Activá/);
});
test('protocol is bounded, private NOTICE only, no historical replays and no automatic start',()=>{
 const p=pair(),id='a'.repeat(32),base={command:'HDTTT',notice:true,nick:'Alice',target:'Bob',args:encode({v:1,t:'invite',id})};
 for(const patch of [{notice:false},{historical:true},{target:'#room'},{args:'x'.repeat(1000)},{args:encode({v:1,t:'invite',id,extra:'bad'})}]){assert.equal(p.b.receive('net',{...base,...patch}),true);assert.equal(p.b.games.size,0);}
 p.b.receive('net',base);assert.equal(p.b.games.get(id).status,'invited');assert.throws(()=>p.b.move('addon',id,1),/disponible/);
 assert.equal(p.b.receive('net',{command:'VERSION'}),false);assert.equal(decode(encode({v:1,t:'move',id,n:1,c:9})),null);
});
test('invitation and network send limits prevent floods and startup always takes priority',()=>{
 const p=pair();p.clients.A.startupPending=true;assert.throws(()=>p.a.invite('addon','net','Bob'),/conexión/);assert.equal(p.q.length,0);p.clients.A.startupPending=false;
 for(let i=0;i<6;i++)p.a.invite('addon','net','Player'+i);assert.throws(()=>p.a.invite('addon','net','Player7'),/Esperá/);assert.equal(p.a.games.size,6);assert.throws(()=>p.a.invite('addon','net','Alice'),/solo/);
 for(let i=0;i<10;i++)p.b.receive('net',{command:'HDTTT',notice:true,nick:'Alice',target:'Bob',args:encode({v:1,t:'invite',id:i.toString(16).padStart(32,'0')})});assert.equal(p.b.games.size,1);
});
test('all winning lines, draw and valid packet round trips',()=>{for(const line of [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]){const b=Array(9).fill(null);line.forEach(i=>b[i]='O');assert.equal(result(b),'O');}assert.equal(result(['X','O','X','X','O','O','O','X','X']),'draw');assert.equal(result(Array(9).fill(null)),null);});
test('addon command becomes a UI/send protected action and Runtime consumes game CTCP before private filters',async()=>{
 const fs=require('node:fs'),{HexVM}=require('../src/scripts/interpreter'),{Runtime}=require('../src/services/runtime'),vm=new HexVM();vm.install([{id:'addon',permissions:['ui','send'],source:fs.readFileSync('extras/TaTeTi_HexDreams_v1.hex','utf8')}]);
 const actions=vm.alias('tateti',{network:'net'},['Bob']).actions;assert.equal(actions[0].type,'game.tictactoe');assert.equal(actions[0].args[0],'Bob');
 let received=false;await Runtime.prototype.receive.call({closed:false,games:{receive:()=>{received=true;return true;}}},'net','ctcp',{command:'HDTTT'});assert.equal(received,true);
 let opened;Runtime.prototype.scriptAction.call({games:{open:(...args)=>{opened=args;}}},actions[0],{script:'addon',network:'net'});assert.deepEqual(opened,['addon','net','Bob']);
});
test('disabling a finished game updates the window, and shutdown notifies the active opponent',()=>{
 const p=pair(),id=p.start();p.a.end('addon',id);p.drain();p.disable();p.a.prune();assert.equal(p.events.at(-1)[1].enabled,false);
 const next=pair(),active=next.start();next.a.close();next.drain();assert.equal(next.b.games.get(active).status,'cancelled');
});
test('network absence does not send or mutate a move and unavailable peers get a terminal result',()=>{
 const p=pair(),id=p.start();p.clients.A.ready=false;assert.throws(()=>p.a.move('addon',id,0),/conexión/);assert.equal(p.a.games.get(id).ply,0);p.a.disconnect('net','Bob','unavailable');assert.equal(p.a.games.get(id).status,'unavailable');
});
test('scripts require both UI and send permission to launch the game action',async t=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{ScriptManager}=require('../src/scripts/manager'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'tateti-permissions-')),delivered=[];
 const manager=new ScriptManager(dir,{host:async a=>delivered.push(a)});t.after(()=>{manager.close();fs.rmSync(dir,{recursive:true,force:true});});
 const id=manager.install('game.hex',fs.readFileSync('extras/TaTeTi_HexDreams_v1.hex','utf8'));await manager.configure(id,{enabled:true});manager.scripts.find(s=>s.id===id).permissions=['ui'];await manager.alias('tateti',{network:'n'},[]);assert.equal(delivered.length,0);
 manager.scripts.find(s=>s.id===id).permissions=['ui','send'];await manager.alias('tateti',{network:'n'},[]);assert.equal(delivered[0].type,'game.tictactoe');
});

test('IRC marks historical game envelopes so the game cannot replay old invitations',()=>{
 const {IrcClient}=require('../src/irc'),c=new IrcClient({host:'localhost',port:6667,tls:false,nick:'Me',channels:[]}),seen=[];c.on('ctcp',x=>seen.push(x));c.batches.set('history',{type:'chathistory'});c.receive(Buffer.from('@batch=history :Alice!u@h NOTICE Me :\x01HDTTT abc\x01\r\n'));assert.equal(seen[0].historical,true);
});

test('two peers agree on a draw, and object or array identifiers are rejected',()=>{
 const p=pair(),id=p.start();for(const [client,cell]of [[p.a,0],[p.b,1],[p.a,2],[p.b,4],[p.a,3],[p.b,5],[p.a,7],[p.b,6],[p.a,8]]){p.advance(800);client.move('addon',id,cell);p.drain();}assert.equal(p.a.games.get(id).status,'draw');assert.equal(p.b.games.get(id).status,'draw');
 assert.equal(decode(encode({v:1,t:'invite',id:['a'.repeat(32)]})),null);
});
