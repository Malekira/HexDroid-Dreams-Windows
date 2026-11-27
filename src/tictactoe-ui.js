'use strict';
(()=>{
 let panel=null,owner='',games=[],selectedId='',enabled=true;
 const labels={inviting:'Invitación enviada. Esperando respuesta…',invited:'Te invitaron a jugar. ¿Aceptás?',playing:'',won:'¡Ganaste!',lost:'Ganó tu rival.',draw:'¡Empate!',declined:'La invitación fue rechazada.',cancelled:'Partida cancelada.',disconnected:'Se perdió la conexión o cambió el nick. Invitá de nuevo.',expired:'La invitación o partida venció por inactividad.',disabled:'El addon está desactivado.',unavailable:'Ese nick no está disponible en esta red.'};
 const current=()=>games.find(g=>g.id===selectedId);
 async function act(action,data={}){try{panel.error.textContent='';const r=await api.advanced('game.tictactoe.'+action,{owner,network:panel.network.value,game:selectedId,...data});if(r?.error)throw Error(r.error);}catch(e){panel.error.textContent=e.message;}}
 function create(){
  const root=el('dialog','script-view tictactoe-dialog'),header=el('header','dialog-header'),title=el('h2','','Ta-Te-Ti'),close=el('button','secondary','×'),body=el('div','ttt-body');close.setAttribute('aria-label','Ocultar Ta-Te-Ti');header.append(title,close);root.append(header,body);root.tabIndex=-1;root.setAttribute('aria-label','Ta-Te-Ti');document.body.append(root);close.onclick=()=>root.close();
  const lobby=el('details','ttt-lobby'),lobbyTitle=el('summary','','Nuevo juego'),setup=el('div','ttt-setup'),networkLabel=el('label','','Red'),net=el('select'),solo=el('button','secondary','Contra la computadora'),peer=el('input'),invite=el('button','secondary','Invitar'),opponents=el('div','ttt-opponents');net.setAttribute('aria-label','Red de la partida');networkLabel.append(net);peer.placeholder='Nick del rival';peer.setAttribute('aria-label','Nick del rival');peer.maxLength=64;opponents.append(peer,invite);setup.append(networkLabel,solo,opponents);lobby.open=true;lobby.append(lobbyTitle,setup);
  const selector=el('select'),heading=el('p','ttt-heading'),status=el('p','ttt-status'),board=el('div','ttt-board'),buttons=[];selector.setAttribute('aria-label','Partida');board.setAttribute('role','group');board.setAttribute('aria-label','Tablero de Ta-Te-Ti');status.setAttribute('role','status');
  for(let i=0;i<9;i++){const b=el('button','ttt-cell','');b.onclick=()=>act('move',{cell:i});buttons.push(b);board.append(b);}
  const controls=el('div','ttt-actions'),accept=el('button','primary','Aceptar invitación'),decline=el('button','secondary','Rechazar'),end=el('button','secondary','Terminar'),again=el('button','secondary','Revancha'),error=el('p','form-error');controls.append(accept,decline,end,again);error.setAttribute('role','alert');body.append(lobby,selector,heading,status,board,controls,error);
  panel={root,body,lobby,drawnGame:null,network:net,peer,selector,heading,status,board,buttons,accept,decline,end,again,error,solo,invite};
  solo.onclick=()=>act('solo');invite.onclick=()=>act('invite',{nick:peer.value.trim()});peer.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();invite.click();}};accept.onclick=()=>act('accept');decline.onclick=()=>act('end');end.onclick=()=>act('end');again.onclick=()=>act('rematch');selector.onchange=()=>{selectedId=selector.value;draw();};net.onchange=()=>draw();
  let drag=null;header.style.cursor='move';header.style.touchAction='none';header.onpointerdown=e=>{if(e.button!==0||e.target.closest('button'))return;const r=root.getBoundingClientRect();drag={x:e.clientX,y:e.clientY,left:r.left,top:r.top};header.setPointerCapture(e.pointerId);e.preventDefault();};header.onpointermove=e=>{if(!drag)return;const r=root.getBoundingClientRect();Object.assign(root.style,{margin:'0',transform:'none',left:Math.max(0,Math.min(innerWidth-r.width,drag.left+e.clientX-drag.x))+'px',top:Math.max(0,Math.min(innerHeight-r.height,drag.top+e.clientY-drag.y))+'px'});};for(const event of ['pointerup','pointercancel','lostpointercapture'])header.addEventListener(event,()=>{drag=null;});
  root.addEventListener('pointerdown',()=>window.raiseDreamsAddonWindow?.(root));root.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();root.close();}};
 }
 function draw(){
  if(!panel)return;const g=current(),net=panel.network,old=net.value,options=config.profiles.map(p=>[p.id,p.name]);if(!options.length)options.push(['','Sin red · juego local']);
  if(net.dataset.signature!==JSON.stringify(options)){net.dataset.signature=JSON.stringify(options);net.replaceChildren(...options.map(([value,name])=>{const o=el('option','',name);o.value=value;return o;}));net.value=old||active?.id||selectedNetworkId||options[0][0];}
  panel.selector.replaceChildren(...games.map(g=>{const o=el('option','',g.peer+' · '+(g.solo?'Solo':profile(g.network)?.name||'Red')+' · '+(labels[g.status]||'En juego'));o.value=g.id;return o;}));panel.selector.value=selectedId;panel.selector.hidden=games.length<2;
  const available=enabled&&!!net.value&&network(net.value).state==='connected';panel.invite.disabled=!available;panel.peer.disabled=!enabled;panel.solo.disabled=!enabled;
  if(panel.drawnGame!==g?.id){panel.lobby.open=!g;panel.drawnGame=g?.id;}
  panel.heading.textContent=g?(g.solo?'Vos (X) contra la computadora (O)':g.peer+' · Vos: '+g.mark+' · '+(profile(g.network)?.name||'Red')):'Elegí computadora o invitá a otro usuario de HexDreams.';
  panel.status.textContent=g?(g.status==='playing'?(g.myTurn?'Tu turno: '+g.mark:'Turno de '+g.peer+' ('+(g.mark==='X'?'O':'X')+')'):labels[g.status]||g.status):'Los dos jugadores necesitan el addon activo para jugar por IRC.';
  panel.buttons.forEach((b,i)=>{const mark=g?.board[i]||'';b.textContent=mark;b.disabled=!enabled||!g?.myTurn||!!mark;b.dataset.mark=mark;b.setAttribute('aria-label','Fila '+(Math.floor(i/3)+1)+', columna '+(i%3+1)+': '+(mark||'vacía'));});
  panel.accept.hidden=!g||g.status!=='invited';panel.decline.hidden=panel.accept.hidden;panel.accept.disabled=!enabled;panel.decline.disabled=!enabled;
  panel.end.hidden=!g||!['playing','inviting'].includes(g.status);panel.again.hidden=!g||['playing','inviting','invited','disabled'].includes(g.status);panel.again.disabled=!enabled;panel.end.disabled=!enabled;panel.again.textContent=g?.solo?'Jugar otra vez':'Invitar a revancha';
 }
 window.addEventListener('resize',()=>{if(!panel?.root.open||panel.root.style.transform!=='none')return;const r=panel.root.getBoundingClientRect();panel.root.style.left=Math.max(0,Math.min(r.left,innerWidth-r.width))+'px';panel.root.style.top=Math.max(0,Math.min(r.top,innerHeight-r.height))+'px';});
 api.onEvent(e=>{
  if(e.type==='tictactoe'){
   if(!panel)create();owner=e.owner;games=e.games||[];enabled=e.enabled!==false;
   if(e.selected&&(e.focus||!current()||games.find(g=>g.id===e.selected)?.status==='invited'))selectedId=e.selected;
   if(!current())selectedId=games.at(-1)?.id||'';draw();if(e.network&&config.profiles.some(p=>p.id===e.network)){panel.network.value=e.network;draw();}
   if(!panel.root.open&&(e.focus||games.some(g=>g.status==='invited'))){const previous=document.activeElement;panel.root.show();window.raiseDreamsAddonWindow?.(panel.root);if(!e.focus&&previous?.isConnected)previous.focus();}
   if(e.focus){window.raiseDreamsAddonWindow?.(panel.root);panel.root.focus();}
  }else if(e.type==='status'&&panel)draw();
 });
})();
