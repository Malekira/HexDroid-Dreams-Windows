'use strict';
const crypto=require('node:crypto');
const {fold,token}=require('../irc');
const LINES=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const FINAL=new Set(['won','lost','draw','declined','cancelled','disconnected','expired','disabled','unavailable']);
function result(board){for(const line of LINES)if(board[line[0]]&&line.every(i=>board[i]===board[line[0]]))return board[line[0]];return board.every(Boolean)?'draw':null;}
const other=mark=>mark==='X'?'O':'X';
function computerMove(board,mark){
 const memo=new Map(),order=[4,0,2,6,8,1,3,5,7];
 function score(b,turn){const end=result(b);if(end)return end==='draw'?0:end===turn?1:-1;const key=b.map(x=>x||'-').join('')+turn;if(memo.has(key))return memo.get(key);let best=-2;for(const cell of order)if(!b[cell]){b[cell]=turn;best=Math.max(best,-score(b,other(turn)));b[cell]=null;if(best===1)break;}memo.set(key,best);return best;}
 let choice=-1,best=-2;const b=board.slice();for(const cell of order)if(!b[cell]){b[cell]=mark;const value=-score(b,other(mark));b[cell]=null;if(value>best){best=value;choice=cell;}}return choice;
}
function encode(packet){return Buffer.from(JSON.stringify(packet)).toString('base64url');}
function decode(text){
 if(typeof text!=='string'||! /^[A-Za-z0-9_-]{1,360}$/.test(text))return null;
 try{const p=JSON.parse(Buffer.from(text,'base64url').toString('utf8'));if(!p||Array.isArray(p)||p.v!==1||!['invite','accept','decline','move','end'].includes(p.t)||typeof p.id!=='string'||! /^[a-f0-9]{32}$/.test(p.id)||Object.keys(p).some(k=>!['v','t','id','n','c'].includes(k)))return null;
 if(p.t==='move'){if(!Number.isInteger(p.n)||p.n<1||p.n>9||!Number.isInteger(p.c)||p.c<0||p.c>8)return null;}else if('n'in p||'c'in p)return null;return p;}catch{return null;}
}
class TicTacToe {
 constructor({client,enabled,send,emit,now=()=>Date.now(),id=()=>crypto.randomBytes(16).toString('hex'),protectedTarget=()=>false,tick=true}){
  Object.assign(this,{client,enabled,send,emit,now,id,protectedTarget});this.games=new Map();this.lobbies=new Map();this.rates=new Map();this.invites=new Map();
  if(tick){this.timer=setInterval(()=>this.expire(),10000);this.timer.unref();}
 }
 owner(id){if(!this.enabled().some(s=>s.id===id))throw Error('Activá el addon Ta-Te-Ti desde Scripts.');return id;}
 ready(network){const client=this.client(network);if(!client?.ready||client.startupPending)throw Error('Esperá a que termine la conexión de esta red.');return client;}
 nick(value){if(typeof value!=='string'||value.length>64||/^[#&+!*:@]/.test(value)||/[\s,\0\r\n\x01]/.test(value))throw Error('Escribí un nick válido.');token(value,'Nick');return value;}
 publish(owner,focus=false,selected){this.emit({owner,enabled:this.enabled().some(s=>s.id===owner),network:this.lobbies.get(owner)||'',focus,selected,games:[...this.games.values()].filter(g=>g.owner===owner).map(g=>this.view(g))});}
 view(g){return {id:g.id,network:g.network,peer:g.peer,solo:g.solo,mark:g.mark,board:g.board.slice(),status:g.status,ply:g.ply,myTurn:g.status==='playing'&&g.mark===(g.ply%2?'O':'X')};}
 open(owner,network,peer=''){this.owner(owner);this.lobbies.set(owner,network||'');this.publish(owner,true);if(peer)this.invite(owner,network,peer);return {ok:true};}
 trim(){if(this.games.size<20)return;for(const [id,g]of this.games)if(FINAL.has(g.status)){this.games.delete(id);if(this.games.size<20)return;}throw Error('Terminá alguna partida antes de abrir otra.');}
 create(owner,network,peer,mark,solo,status,id=this.id()){
  this.trim();const g={id,owner,network,peer,mark,solo,status,board:Array(9).fill(null),ply:0,updated:this.now()};this.games.set(id,g);return g;
 }
 wire(network,peer,p){
  this.ready(network);if(this.protectedTarget(network,peer))throw Error('Este protocolo de juego no está disponible en un privado cifrado.');
  const now=this.now(),r=this.rates.get(network)||{tokens:6,time:now};r.tokens=Math.min(6,r.tokens+(now-r.time)/700);r.time=now;this.rates.set(network,r);if(r.tokens<1)throw Error('Esperá un momento antes de enviar otra acción.');
  r.tokens--;this.send(network,peer,'HDTTT '+encode(p));
 }
 packet(g,t,extra={}){this.wire(g.network,g.peer,{v:1,t,id:g.id,...extra});}
 pair(network,peer){return [...this.games.values()].some(g=>!g.solo&&g.network===network&&fold(g.peer)===fold(peer)&&!FINAL.has(g.status));}
 invite(owner,network,peer){
  this.owner(owner);peer=this.nick(peer);const client=this.ready(network);if(fold(peer)===fold(client.nick))throw Error('Para jugar solo, elegí Contra la computadora.');if(this.pair(network,peer))throw Error('Ya hay una partida o invitación con ese nick.');
  const g=this.create(owner,network,peer,'X',false,'inviting');try{this.packet(g,'invite');}catch(e){this.games.delete(g.id);throw e;}this.publish(owner,true,g.id);return this.view(g);
 }
 solo(owner,network){this.owner(owner);const g=this.create(owner,network||'','Computadora','X',true,'playing');this.publish(owner,true,g.id);return this.view(g);}
 get(owner,id){this.owner(owner);const g=this.games.get(id);if(!g||g.owner!==owner)throw Error('La partida ya no está disponible.');return g;}
 accept(owner,id){const g=this.get(owner,id);if(g.status!=='invited')throw Error('La invitación ya no está pendiente.');this.packet(g,'accept');g.status='playing';g.updated=this.now();this.publish(owner,true,id);return {ok:true};}
 finish(g){const end=result(g.board);if(end)g.status=end==='draw'?'draw':end===g.mark?'won':'lost';g.updated=this.now();}
 move(owner,id,cell){
  const g=this.get(owner,id);if(!Number.isInteger(cell)||cell<0||cell>8||g.board[cell]||g.status!=='playing'||g.mark!==(g.ply%2?'O':'X'))throw Error('Esa jugada no está disponible.');
  if(!g.solo)this.packet(g,'move',{n:g.ply+1,c:cell});g.board[cell]=g.mark;g.ply++;this.finish(g);
  if(g.solo&&g.status==='playing'){const choice=computerMove(g.board,other(g.mark));g.board[choice]=other(g.mark);g.ply++;this.finish(g);}
  this.publish(owner,false,id);return {ok:true};
 }
 end(owner,id){const g=this.get(owner,id);if(!FINAL.has(g.status)){if(!g.solo){try{this.packet(g,g.status==='invited'?'decline':'end');}catch{}}g.status=g.status==='invited'?'declined':'cancelled';g.updated=this.now();}this.publish(owner,false,id);return {ok:true};}
 rematch(owner,id){const g=this.get(owner,id);if(!FINAL.has(g.status))throw Error('Terminá primero la partida actual.');return g.solo?this.solo(owner,g.network):this.invite(owner,g.network,g.peer);}
 receive(network,data){
  if(data.command!=='HDTTT')return false;
  if(!data.notice||data.historical)return true;const client=this.client(network);if(!client?.ready||client.startupPending||fold(data.target)!==fold(client.nick)||fold(data.nick)===fold(client.nick))return true;
  const p=decode(data.args);if(!p)return true;try{this.nick(data.nick);}catch{return true;}
  let g=this.games.get(p.id);
  if(p.t==='invite'){
   if(g||this.pair(network,data.nick))return true;
   const owner=this.enabled()[0]?.id;if(!owner)return true;
   const now=this.now(),key=network+'\0'+fold(data.nick),times=(this.invites.get(key)||[]).filter(t=>now-t<60000);if(times.length>=6||[...this.games.values()].filter(g=>g.network===network&&g.status==='invited').length>=3)return true;
   times.push(now);this.invites.set(key,times);if(this.invites.size>200)this.invites.delete(this.invites.keys().next().value);
   try{g=this.create(owner,network,data.nick,'O',false,'invited',p.id);}catch{return true;}
   this.lobbies.set(owner,network);this.publish(owner,false,g.id);return true;
  }
  if(!g||g.solo||g.network!==network||fold(g.peer)!==fold(data.nick)||!this.enabled().some(s=>s.id===g.owner)||FINAL.has(g.status))return true;
  if(p.t==='accept'&&g.status==='inviting'){g.status='playing';g.updated=this.now();}
  else if(p.t==='decline'&&g.status==='inviting')g.status='declined';
  else if(p.t==='end')g.status='cancelled';
  else if(p.t==='move'&&g.status==='playing'&&p.n===g.ply+1&&other(g.mark)===(g.ply%2?'O':'X')&&!g.board[p.c]){g.board[p.c]=other(g.mark);g.ply++;this.finish(g);}
  else return true;
  this.publish(g.owner,false,g.id);return true;
 }
 disconnect(network,peer,status='disconnected'){for(const g of this.games.values())if(!g.solo&&g.network===network&&(!peer||fold(peer)===fold(g.peer))&&!FINAL.has(g.status)){g.status=status;this.publish(g.owner,false,g.id);}}
 nickChange(network,old,nick,own){if(own)this.disconnect(network);else this.disconnect(network,old);}
 expire(){const now=this.now();for(const g of this.games.values())if(!g.solo&&!FINAL.has(g.status)&&now-g.updated>(['invited','inviting'].includes(g.status)?90000:600000)){g.status='expired';this.publish(g.owner,false,g.id);}for(const [key,times]of this.invites)if(times.every(t=>now-t>=60000))this.invites.delete(key);}
 prune(){const owners=new Set([...this.lobbies.keys(),...[...this.games.values()].map(g=>g.owner)]);for(const g of this.games.values())if(!this.enabled().some(s=>s.id===g.owner)&&!FINAL.has(g.status)){if(!g.solo){try{this.packet(g,'end');}catch{}}g.status='disabled';}for(const owner of owners)this.publish(owner);}

 list(owner){this.owner(owner);return [...this.games.values()].filter(g=>g.owner===owner).map(g=>this.view(g));}
 close(){clearInterval(this.timer);for(const g of this.games.values())if(!g.solo&&!FINAL.has(g.status)){try{this.packet(g,'end');}catch{}}this.games.clear();this.rates.clear();this.invites.clear();}
}
module.exports={TicTacToe,result,computerMove,encode,decode,FINAL};
