"use strict";
(() => {
  const call = async (name, data) => {
    if (!api.advanced) throw new Error("Función no disponible.");
    const r = await api.advanced(name, data);
    if (r?.error) throw new Error(r.error);
    return r;
  };
  const run = (fn) =>
    Promise.resolve()
      .then(fn)
      .catch((e) => notify(e.message, true));
  const tools = document.querySelector(".chat-tools"),
    topic = $("conversation-subtitle");
  const toggle = el("button", "small-button");
  toggle.id = "topic-toggle";
  toggle.type = "button";
  tools.append(toggle);
  const divider = el("div", "topic-height-resizer");
  divider.id = "topic-height-resizer";
  divider.tabIndex = 0;
  divider.setAttribute("role", "separator");
  divider.setAttribute("aria-label", "Altura del topic");
  divider.setAttribute("aria-orientation", "horizontal");
  divider.setAttribute("aria-valuemin", "32");
  divider.setAttribute("aria-valuemax", "320");
  document.querySelector(".chat-heading").after(divider);
  function topicSettings() {
    const shown = config.settings.showTopic !== false;
    document.body.classList.toggle("topic-hidden", !shown);
    toggle.textContent = shown ? "▴ Topic" : "▾ Topic";
    toggle.setAttribute(
      "aria-label",
      shown ? "Ocultar topic" : "Mostrar topic",
    );
    toggle.setAttribute("aria-pressed", String(shown));
    divider.hidden =
      !shown || selected()?.kind !== "channel" || !selected()?.topic;
    topic.style.height = Number.isFinite(config.settings.topicHeight)
      ? config.settings.topicHeight + "px"
      : "";
    divider.setAttribute(
      "aria-valuenow",
      String(
        Number.isFinite(config.settings.topicHeight)
          ? config.settings.topicHeight
          : Math.round(topic.getBoundingClientRect().height) || 32,
      ),
    );
  }
  const originalApply = applySettings;
  applySettings = function () {
    originalApply();
    topicSettings();
  };
  toggle.onclick = () => {
    config.settings.showTopic = config.settings.showTopic === false;
    applySettings();
    renderHeader();
    persist().catch((e) => notify(e.message, true));
  };
  let dragging = false;
  divider.onpointerdown = (event) => {
    dragging = true;
    divider.setPointerCapture(event.pointerId);
    document.body.classList.add("dragging-topic");
    event.preventDefault();
  };
  divider.onpointermove = (event) => {
    if (!dragging) return;
    config.settings.topicHeight = Math.round(
      Math.max(
        32,
        Math.min(320, event.clientY - topic.getBoundingClientRect().top),
      ),
    );
    topicSettings();
  };
  function finish() {
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove("dragging-topic");
    persist().catch((e) => notify(e.message, true));
  }
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
    divider.addEventListener(event, finish);
  divider.ondblclick = () => {
    config.settings.topicHeight = null;
    topicSettings();
    persist().catch((e) => notify(e.message, true));
  };
  divider.onkeydown = (event) => {
    if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const height =
      config.settings.topicHeight ?? topic.getBoundingClientRect().height;
    config.settings.topicHeight =
      event.key === "Home"
        ? 32
        : event.key === "End"
          ? 320
          : Math.max(
              32,
              Math.min(320, height + (event.key === "ArrowUp" ? -10 : 10)),
            );
    topicSettings();
    persist().catch((e) => notify(e.message, true));
  };
  const dialog = el("dialog", "feature-dialog");
  dialog.id = "notify-dialog";
  const header = el("header", "dialog-header"),
    title = el("h2", "", "Notify · Usuarios en línea"),
    close = el("button", "icon-button", "×");
  close.type = "button";
  close.setAttribute("aria-label", "Cerrar Notify");
  close.onclick = () => dialog.close();
  header.append(title, close);
  const body = el("div", "form-content");
  dialog.append(header, body);
  document.body.append(dialog);
  const trigger = el("button", "small-button", "Notify");
  trigger.id = "notify-button";
  trigger.type = "button";
  trigger.setAttribute("aria-label", "Notify: usuarios en línea");
  tools.append(trigger);
  let notifyNetwork = null;
  const states = new Map(),
    currentNicks = new Map(),
    nickHistory = new Map();
  window.dreamsNotifyNames = id => NotifyPolicy.names(config,profile(id)||{});
  window.getDreamsNotifyRows = list => NotifyPolicy.entries(config).filter(r=>list==='all'||r.list===list||r.list==='all').flatMap(row=>{
    const observers=config.profiles.filter(p=>NotifyPolicy.applies(config,row,p)&&network(p.id).state==='connected');
    const online=observers.filter(p=>(states.get(p.id)||{})[fold(row.nick)]===true);
    const byServer=new Map();for(const p of online){const key=p.host.toLowerCase().replace(/\.$/,'');if(!byServer.has(key)||p.id===active?.id)byServer.set(key,p);}
    const matches=online.length?[...byServer.values()]:[observers[0]||profile(row.list)||profile(active?.id)||config.profiles[0]];
    return matches.filter(Boolean).map(p=>({...row,network:p.id,networkName:p.name,host:p.host,currentNick:(currentNicks.get(p.id)||{})[fold(row.nick)]||row.nick,online:online.length?true:observers.length&&observers.every(p=>(states.get(p.id)||{})[fold(row.nick)]===false)?false:null}));
  });
  window.getDreamsNotify = id => window.getDreamsNotifyRows('all').filter(r=>NotifyPolicy.applies(config,r,profile(id)||{}));
  async function saveEntries(rows){if(rows.length>2000)throw Error('Notify admite hasta 2000 entradas.');const previous=config.settings.notifyEntries;config.settings.notifyEntries=NotifyPolicy.sanitize(rows);try{await persist();}catch(e){config.settings.notifyEntries=previous;throw e;}if(api.advanced&&config.profiles[0])await call('presence.sync',{network:config.profiles[0].id});renderList();}
  window.removeDreamsNotifyEntry=(list,nick)=>saveEntries(NotifyPolicy.entries(config).filter(r=>!(r.list===list&&fold(r.nick)===fold(nick))));
  function action(parent, text, fn) {
    const b = el("button", "secondary", text);
    b.type = "button";
    b.onclick = () => run(fn);
    parent.append(b);
    return b;
  }
  window.followDreamsUser = async (id,nick) => {
    const rows=NotifyPolicy.entries(config),exists=rows.some(r=>r.list===id&&fold(r.nick)===fold(nick));
    await saveEntries(exists?rows.filter(r=>!(r.list===id&&fold(r.nick)===fold(nick))):[...rows,{nick,list:id,scope:'connection'}]);
    notify(nick+(exists?' se quitó de Notify.':' se agregó a Notify.'));
  };

  function renderList() {
    window.renderDreamsNotify?.();
    const list = $("notify-list");
    if (!list) return;
    list.replaceChildren();
    const people=window.getDreamsNotifyRows(notifyNetwork).sort((a,b)=>a.nick.localeCompare(b.nick,'es'));
    if(!people.length)list.append(el('p','muted','Agregá apodos a esta lista.'));
    for(const person of people){
      const {nick,online}=person,target=person.currentNick;
      const row=el('div','notify-row');
      const status=(online===true?'En línea':online===false?'Desconectado':'Sin confirmar')+' · '+(profile(person.list)?.name||'Todas')+(online?' · '+person.networkName+' ('+person.host+')':'');
      const name = el(
          "button",
          "notify-profile-name",
          target === nick ? nick : nick + " → " + target,
        ),
        label = el("span", "notify-status" + (online ? " online" : ""), status);
      label.title=status;
      name.type="button";
      name.title="Abrir perfil de "+target;
      name.onclick=()=>{dialog.close();window.openDreamsUser?.(person.network,target);};
      row.append(name, label);
      const actions = el("div", "notify-row-actions");
      row.append(actions);
      action(actions, "Abrir privado", () => {
        dialog.close();
        choose(person.network, target);
      });
      action(actions, "WHOIS", () => {
        dialog.close();
        window.openDreamsWhois(person.network, target);
      });
      action(actions, "Quitar", async () => {
        await saveEntries(NotifyPolicy.entries(config).filter(r=>!(r.list===person.list&&fold(r.nick)===fold(nick))));
      });
      const scope=scopeSelect(person.scope);scope.disabled=person.list==='all';scope.onchange=()=>run(()=>saveEntries(NotifyPolicy.entries(config).map(r=>r.list===person.list&&fold(r.nick)===fold(nick)?{...r,scope:scope.value}:r)));actions.prepend(scope);
      list.append(row);
    }
    const changes = nickHistory.get(notifyNetwork) || [];
    if (changes.length) {
      const history = el("section", "notify-nick-history");
      history.append(el("strong", "", "Cambios de nick"));
      for (const item of changes.slice().reverse())
        history.append(el("p", "", item.old + " → " + item.newNick));
      list.append(history);
    }
  }
  function option(text, key) {
    const label = el("label", "checkbox-label"),
      input = el("input");
    input.type = "checkbox";
    input.checked = config.settings[key] !== false;
    input.setAttribute("aria-label", text);
    input.onchange = () => {
      config.settings[key] = input.checked;
      persist().catch((e) => notify(e.message, true));
    };
    label.append(input, document.createTextNode(text));
    body.append(label);
  }
  function scopeSelect(value='connection'){const select=el('select');select.setAttribute('aria-label','Compartir Notify');for(const [v,text]of [['connection','Solo esta conexión'],['server','Mismo servidor'],['all','Todos los servidores']]){const o=el('option','',text);o.value=v;select.append(o);}select.value=value;return select;}
  function listSelect(value){const select=el('select');select.setAttribute('aria-label','Lista de Notify');for(const p of [...config.profiles,{id:'all',name:'Todas'}]){const o=el('option','',p.name);o.value=p.id;select.append(o);}select.value=value;return select;}
  async function openNotify() {
    if (!active) {
      notify("Añadí una red primero.", true);
      return;
    }
    notifyNetwork = config.settings.notifyFilter==='active'?active.id:config.settings.notifyFilter||active.id;
    title.textContent = "Notify";
    body.replaceChildren();
    const form = el("form", "notify-add"),
      input = el("input");
    input.placeholder = "Nick a seguir";
    input.setAttribute("aria-label", "Nick para Notify");
    input.maxLength = 40;
    input.required = true;
    const add = el("button", "primary", "Añadir");
    add.type = "submit";
    const listChoice=listSelect(notifyNetwork),scope=scopeSelect();
    listChoice.onchange=()=>{notifyNetwork=listChoice.value;scope.disabled=notifyNetwork==='all';renderList();};
    scope.disabled=notifyNetwork==='all';
    form.append(input,listChoice,scope,add);
    form.onsubmit = (event) => {
      event.preventDefault();
      run(async () => {
        const nick = input.value.trim();
        if (!nick || new TextEncoder().encode(nick).length>80 || /^[#&+!~@%]|[\s\x00-\x1f:,]/.test(nick))
          throw new Error("Escribí un nick sin espacios.");
        const rows=NotifyPolicy.entries(config).filter(r=>!(r.list===listChoice.value&&fold(r.nick)===fold(nick)));
        await saveEntries([...rows,{nick,list:listChoice.value,scope:listChoice.value==='all'?'all':scope.value}]);
        input.value = "";
        renderList();
      });
    };
    body.append(form);
    const list = el("div", "notify-list");
    list.id = "notify-list";
    body.append(list);
    option("Avisar cambios de conexión", "notifyPresence");
    option("Avisar también desconexiones", "notifyPresenceOffline");
    option("Avisar cambios de nick", "notifyNickChanges");
    option("Sonido de Notify", "notifyPresenceSound");
    body.append(
      el(
        "p",
        "note",
        "Elegí la lista y dónde comprobarla. Mismo servidor compara la dirección configurada. Sin una conexión disponible, el estado queda sin confirmar.",
      ),
    );
    if (!dialog.open) dialog.showModal();
    renderList();
    if (api.advanced) {
      for(const observer of config.profiles){
      const id = observer.id,
        rows = await call("presence.status", { network: id });
      currentNicks.set(
        id,
        Object.fromEntries(
          rows.map((row) => [fold(row.nick), row.currentNick || row.nick]),
        ),
      );
      states.set(
        id,
        Object.fromEntries(rows.map((row) => [fold(row.nick), row.online])),
      );
      renderList();
      }
    }
  }
  trigger.onclick = () => run(openNotify);
  window.addDreamsNotifyUser = () =>
    run(async () => {
      await openNotify();
      body.querySelector(".notify-add input")?.focus();
    });
  if (api.advanced)
    api.onEvent((event) => {
      if(event.privateOnly&&(event.type==="presence"||event.type==="presence-nick"))return;
      if (event.type === "presence-nick") {
        const names = currentNicks.get(event.id) || {},
          state = states.get(event.id) || {};
        for (const watched of event.watched || [event.nick]) {
          names[fold(watched)] = event.newNick;
          state[fold(watched)] = true;
        }
        currentNicks.set(event.id, names);
        states.set(event.id, state);
        const history = nickHistory.get(event.id) || [];
        history.push({ old: event.old, newNick: event.newNick });
        nickHistory.set(event.id, history.slice(-50));
        window.renderDreamsNotify?.();
        if (dialog.open) renderList();
      }
      if (event.type === "presence") {
        const names = currentNicks.get(event.id) || {};
        names[fold(event.nick)] = event.online
          ? event.currentNick || event.nick
          : event.nick;
        currentNicks.set(event.id, names);
        const current = states.get(event.id) || {};
        current[fold(event.nick)] = event.online;
        states.set(event.id, current);
        window.renderDreamsNotify?.();
        if (dialog.open) renderList();
      }
      if (event.type === "presence-alert") notify(event.text);
      if (event.type === "status" && event.state === "disconnected") {
        currentNicks.delete(event.id);
        states.delete(event.id);
        window.renderDreamsNotify?.();
        if (dialog.open) renderList();
      }
    });
  topicSettings();
})();
