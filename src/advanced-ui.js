"use strict";
// All content from IRC and scripts is rendered as text or a closed widget tree.
(() => {
  if (!api.advanced) return;
  let section = "networks",
    state = {},
    busy = false;
  const dialog = $("settings-dialog"),
    nav = document.querySelector(".settings-nav"),
    body = el("section", "advanced-content"),
    feedback = $("settings-feedback");
  dialog.classList.add("advanced-dialog");
  body.hidden = true;
  document.querySelector(".settings-content").append(body);
  const baseOpenSettings = openSettings;
  openSettings = function (key = "networks") {
    body.hidden = true;
    baseOpenSettings(key);
  };
  const groups = {};
  const existing = [...nav.querySelectorAll("button[data-section]")];
  nav.replaceChildren();
  nav.setAttribute("aria-label", "Árbol de configuración");
  for (const [key, label] of Object.entries({
    net: "Redes e identidad",
    look: "Apariencia",
    tools: "Herramientas",
  })) {
    const group = el("details", "settings-group"),
      summary = el("summary", "", label),
      children = el("div", "settings-children");
    group.open = true;
    group.append(summary, children);
    nav.append(group);
    groups[key] = children;
  }
  for (const button of existing) {
    groups[
      button.dataset.section === "networks"
        ? "net"
        : ["appearance", "chat", "layout"].includes(button.dataset.section)
          ? "look"
          : "tools"
    ].append(button);
  }
  nav.addEventListener("keydown", (e) => {
    const nodes = [...nav.querySelectorAll("button,summary")].filter(
        (n) => n.getClientRects().length,
      ),
      i = nodes.indexOf(document.activeElement);
    let next;
    if (e.key === "ArrowDown") next = nodes[Math.min(i + 1, nodes.length - 1)];
    if (e.key === "ArrowUp") next = nodes[Math.max(i - 1, 0)];
    if (e.key === "Home") next = nodes[0];
    if (e.key === "End") next = nodes.at(-1);
    if (next) {
      e.preventDefault();
      next.focus();
    }
  });
  const names = {
    networks: "Autenticación y proxy",
    history: "Historial",
    general:"Configuración general",away:"Configuración de Away",notice:"Configuración de NOTICE",notifications:"Configuración de notificaciones",highlight:"Configuración de resaltado",sound:"Configuración de sonido",
    palette:"Colores del entorno",
    dcc: "Transferencias DCC",
    crypto: "Cifrado",
    scripts: "Scripts .hex",
    backup: "Respaldos",
    media: "Multimedia",
  };
  for (const [key, label] of Object.entries(names)) {
    const b = el("button", "secondary", label);
    b.onclick = () => {
      open(key);
    };
    b.dataset.advancedSection = key;
    groups[
      key === "networks" || key === "crypto"
        ? "net"
        : ["notifications","palette","media"].includes(key)
          ? "look"
          : "tools"
    ].append(b);
  }
  function button(label, action, parent = body) {
    const b = el("button", "secondary", label);
    b.type = "button";
    b.onclick = () => run(action);
    parent.append(b);
    return b;
  }
  function input(label, value = "", type = "text", parent = body) {
    if(type==="color"&&/^#[a-f\d]{3}$/i.test(value||""))value="#"+value.slice(1).split("").map(c=>c+c).join("");
    const l = el("label", "advanced-field", label),
      i = el(type === "textarea" ? "textarea" : "input");
    if (type !== "textarea") i.type = type;
    if (type === "checkbox") i.checked = !!value;
    else i.value = value ?? "";
    l.append(i);
    parent.append(l);
    return i;
  }
  function select(label, options, value, parent = body) {
    const l = el("label", "advanced-field", label),
      s = el("select");
    s.setAttribute("aria-label", label);
    for (const [v, text] of options) {
      const o = el("option", "", text);
      o.value = v;
      s.append(o);
    }
    s.value = value;
    l.append(s);
    parent.append(l);
    return s;
  }
  function note(text, parent = body) {
    parent.append(el("p", "note", text));
  }
  async function run(action) {
    if (busy) return;
    busy = true;
    feedback.textContent = "Procesando…";
    try {
      const result = await action();
      if (result?.error) throw new Error(result.error);
      feedback.textContent = result?.cancelled ? "Cancelado." : "Listo.";
      return result;
    } catch (e) {
      feedback.textContent = e.message;
    } finally {
      busy = false;
    }
  }
  async function call(name, data = {}) {
    const r = await api.advanced(name, data);
    if (r?.error) throw new Error(r.error);
    return r;
  }
  const context = () => ({ network: active?.id, target: active?.target });
  function requireContext() {
    if (!active) throw new Error("Selecciona una red y una conversación.");
    return context();
  }
  async function settings(values) {
    Object.assign(config.settings, values);
    await persist();
    const r = await api.load();
    if (r?.error) throw new Error(r.error);
    config.settings = r.settings;
    applyTheme();
    applySettings();
    render();
  }
  function applyTheme() {
    let theme = config.settings.theme || "dark";
    if (theme === "system")
      theme = matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark";
    document.documentElement.dataset.theme = theme;
    for(const key of ['bg','sidebar','surface','raised','border','text','muted','accent']){document.documentElement.style.removeProperty('--'+key);if(config.settings.customColors?.[key])document.documentElement.style.setProperty('--'+key,config.settings.customColors[key]);}
    if(themeButton){themeButton.textContent=theme==='light'?'☾':'☀';themeButton.setAttribute('aria-label',theme==='light'?'Cambiar a tema oscuro':'Cambiar a tema claro');}
  }
  async function show() {
    body.replaceChildren();
    feedback.textContent = "";
    try {
      state = await call("status");
    } catch (e) {
      feedback.textContent = e.message;
      return;
    }
    note(names[section]);
    if (section === "appearance") {
      button("Abrir ajustes de letra, colores y paneles", () => {
        dialog.close();
        openSettings("appearance");
      });
    } else if (section === "networks") {
      const p = active && profile(active.id);
      if (!p) {
        note("Añade y selecciona una red primero.");
        return;
      }
      note(
        "Red seleccionada: " +
          p.name +
          ". Los cambios se aplican al reconectar.",
      );
      button("Editar identidad, foto y comandos de esta red", () =>
        openNetwork(p.id),
      );
      const sasl = select(
          "SASL",
          [
            ["none", "Desactivado"],
            ["PLAIN", "PLAIN (requiere TLS)"],
            ["SCRAM-SHA-256", "SCRAM-SHA-256 (requiere TLS)"],
            ["EXTERNAL", "EXTERNAL (certificado de cliente)"],
          ],
          p.sasl || "none",
        ),
        saslUsername = input("Cuenta SASL", p.saslUsername || p.nick),
        password = input("Contraseña SASL nueva", "", "password"),
        serverPassword = input("Contraseña del servidor nueva", "", "password"),
        remember = input(
          "Guardar credenciales con protección del sistema",
          false,
          "checkbox",
        );
      note(
        state.secureStorage
          ? "Almacén seguro disponible. Los campos de contraseña nunca muestran el valor guardado."
          : "Almacén seguro no disponible. Las contraseñas solo podrán mantenerse durante la sesión.",
      );
      remember.disabled = !state.secureStorage;
      const recoverNick = input(
          "Recuperar el apodo principal",
          p.recoverNick,
          "checkbox",
        ),
        favorite = input("Red favorita", p.favorite, "checkbox"),
        tofu = input(
          "Fijar el primer certificado TLS válido (TOFU)",
          p.tofu,
          "checkbox",
        );
      const alternateNick = input(
          "Apodo alternativo",
          p.alternateNick || p.nick + "_",
        ),
        encoding = input("Codificación", p.encoding || "utf8"),
        autoReconnect = input(
          "Reconectar automáticamente",
          p.autoReconnect,
          "checkbox",
        ),
        autoConnect = input("Conectar al iniciar", p.autoConnect, "checkbox"),
        delay = input(
          "Retraso inicial de reconexión (segundos)",
          p.reconnectDelay || 5,
          "number",
        ),
        commandDelay = input(
          "Separación entre comandos (ms)",
          p.commandDelay || 1000,
          "number",
        );
      const proxyHost = input(
          "Servidor SOCKS (vacío para conexión directa)",
          p.proxy?.host || "",
        ),
        proxyPort = input("Puerto SOCKS", p.proxy?.port || 1080, "number"),
        proxyType = select(
          "Versión SOCKS",
          [
            ["5", "SOCKS5"],
            ["4", "SOCKS4"],
          ],
          String(p.proxy?.type || 5),
        ),
        proxyUser = input("Usuario del proxy nuevo"),
        proxyPassword = input("Contraseña del proxy nueva", "", "password"),
        bouncer = input("Identificador de red soju", p.bouncerNetwork || "");
      button("Guardar configuración avanzada", async () => {
        const updated = {
          ...p,
          sasl: sasl.value,
          saslUsername: saslUsername.value,
          alternateNick: alternateNick.value,
          encoding: encoding.value,
          autoReconnect: autoReconnect.checked,
          autoConnect: autoConnect.checked,
          reconnectDelay: Number(delay.value),
          commandDelay: Number(commandDelay.value),
          proxy: proxyHost.value
            ? {
                host: proxyHost.value,
                port: Number(proxyPort.value),
                type: Number(proxyType.value),
              }
            : undefined,
          bouncerNetwork: bouncer.value,
          recoverNick: recoverNick.checked,
          favorite: favorite.checked,
          tofu: tofu.checked,
        };
        const next = {
          ...config,
          workspace: workspace.serialize(),
          profiles: config.profiles.map((x) => (x.id === p.id ? updated : x)),
        };
        const r = await api.save(next);
        if (r?.error) throw new Error(r.error);
        config = r;
        render();
        return { ok: true };
      });
      const keys = input(
          "Claves de canales (una línea: #canal clave)",
          "",
          "textarea",
        ),
        secretCommands = input(
          "Comandos protegidos tras conectar (uno por línea)",
          "",
          "textarea",
        );
      button("Conectar con estas credenciales", async () => {
        const credentials = {};
        for (const [key, field] of Object.entries({
          saslPassword: password,
          serverPassword,
          proxyUser,
          proxyPassword,
        }))
          if (field.value) credentials[key] = field.value;
        if (keys.value.trim())
          credentials.channelKeys = Object.fromEntries(
            keys.value
              .trim()
              .split("\n")
              .map((line) => line.trim().split(/\s+/)),
          );
        if (secretCommands.value.trim())
          credentials.commands = secretCommands.value.trim().split("\n");
        return call("network.connect", {
          network: p.id,
          credentials,
          remember: remember.checked,
        });
      });
      button("Subir red en la lista", async () => {
        const index = config.profiles.findIndex((x) => x.id === p.id);
        if (index > 0) {
          [config.profiles[index - 1], config.profiles[index]] = [
            config.profiles[index],
            config.profiles[index - 1],
          ];
          await persist();
          render();
        }
      });
      button("Bajar red en la lista", async () => {
        const index = config.profiles.findIndex((x) => x.id === p.id);
        if (index < config.profiles.length - 1) {
          [config.profiles[index + 1], config.profiles[index]] = [
            config.profiles[index],
            config.profiles[index + 1],
          ];
          await persist();
          render();
        }
      });
      if (network(p.id).capabilities?.includes("soju.im/bouncer-networks"))
        button("Consultar redes del bouncer soju", () =>
          call("bouncer.list", { network: p.id }),
        );
      const certPass = input(
        "Frase de paso del certificado PFX (si corresponde)",
        "",
        "password",
      );
      button("Importar CA o certificado cliente PFX", () =>
        call("tls.import", { network: p.id, passphrase: certPass.value }),
      );
      button("Olvidar credenciales guardadas", () =>
        call("secrets.forget", { network: p.id }),
      );
    } else if (section === "history") {
      const fields={};for(const[key,label]of Object.entries({textLogRooms:'Guardar historial en TXT por sala (mensajes y eventos)',textLogPrivates:'Guardar historial en TXT por PV',textLogStatus:'Guardar historial de status de red',textLogQueries:'Guardar historial de WHOIS/WHO'}))fields[key]=input(label,config.settings.textLogsEnabled!==false&&config.settings[key]!==false,'checkbox');
      const roomRows=input('Recargar últimas filas de salas',config.settings.historyRoomRows??(config.settings.historyEnabled?300:0),'number'),privateRows=input('Recargar últimas filas de PV',config.settings.historyPrivateRows??(config.settings.historyEnabled?300:0),'number');
      roomRows.min=privateRows.min='0';roomRows.max=privateRows.max='600';roomRows.step=privateRows.step='1';note('0 no recarga. Máximo 600 filas por conversación. Elegir filas activa el guardado para recarga y búsqueda; el TXT se configura por separado.');
      const days=input('Tiempo de conservación (días)',config.settings.textLogDays||0,'number'),max=input('Límite por archivo (MB)',config.settings.textLogMaxMB||0,'number');days.min=max.min='0';
      note('0 conserva indefinidamente y no limita el tamaño. Con límite de tamaño se conservan las líneas más recientes; la retención elimina los archivos sin actividad durante ese tiempo.');
      const folder=el('p','note','Carpeta de historial TXT: …');body.append(folder);call('logs.text.status').then(r=>folder.textContent='Carpeta de historial TXT: '+r.directory);
      note('Seleccionar otra ruta cambia el destino de los nuevos logs; no mueve los archivos anteriores.');
      button('Seleccionar ruta',async()=>{const r=await call('logs.text.folder');if(r.directory)folder.textContent='Carpeta de historial TXT: '+r.directory;});
      button('Abrir historial',()=>window.openDreamsHistory());
      button('Guardar preferencias',()=>settings({...Object.fromEntries(Object.entries(fields).map(([key,field])=>[key,field.checked])),historyRoomRows:Math.max(0,Math.min(600,Math.floor(Number(roomRows.value)||0))),historyPrivateRows:Math.max(0,Math.min(600,Math.floor(Number(privateRows.value)||0))),historyEnabled:config.settings.historyEnabled||Number(roomRows.value)>0||Number(privateRows.value)>0,textLogsEnabled:true,textLogDays:Number(days.value),textLogMaxMB:Number(max.value)}));
    } else if(section==='palette'){
      window.renderDreamsThemeManager?.(body);
      const fields={};for(const[key,label]of Object.entries({bg:'Fondo de conversación',sidebar:'Fondo de paneles',surface:'Ventanas y controles',raised:'Superficies destacadas',border:'Bordes',text:'Texto normal',muted:'Texto secundario',accent:'Color de selección'}))fields[key]=input(label,config.settings.customColors?.[key]||getComputedStyle(document.documentElement).getPropertyValue('--'+key).trim(),'color');
      button('Guardar colores del entorno',()=>settings({customColors:Object.fromEntries(Object.entries(fields).map(([key,field])=>[key,field.value]))}));button('Restaurar colores del tema',()=>settings({customColors:{}}));
    } else if (['general','away','notice','notifications','highlight','sound'].includes(section)) {
      window.renderDreamsChatPreferences(body,section,settings);
    } else if (section === "crypto") {
      const c = requireContext();
      note("Conversación seleccionada: " + c.target);
      const status = await call("crypto.status", c);
      note(
        "Cifrado actual: " +
          status.scheme +
          (status.fingerprint ? " · " + status.fingerprint : ""),
      );
      const scheme = select(
          "Esquema",
          [
            ["none", "Sin cifrado"],
            ["AGM", "AGM (AES-256-GCM)"],
            ["FiSH", "FiSH CBC"],
            ["AGE", "AGE (identidades y ratchet)"],
          ],
          status.scheme,
        ),
        key = input(
          "Clave compartida en Base64 (vacío genera una nueva)",
          "",
          "password",
        );
      note(
        "AGM y FiSH requieren la misma clave en ambos extremos. AGE necesita que el otro cliente active AGE. Verifica las huellas por otro medio.",
      );
      button("Aplicar cifrado", async () => {
        const r = await call("crypto.configure", {
          ...c,
          scheme: scheme.value,
          key: key.value,
        });
        if (r.fingerprint) note("Huella de la clave: " + r.fingerprint);
        return r;
      });
      for (const pin of status.pins || []) {
        note(
          `${pin.nick}: ${pin.fingerprint} · ${pin.verified ? "verificada" : "pendiente de verificación externa"}`,
        );
        if (!pin.verified)
          button("Marcar huella verificada: " + pin.nick, () =>
            call("crypto.verify", { ...c, fingerprint: pin.fingerprint }),
          );
      }
      if (["AGM", "FiSH"].includes(status.scheme))
        button("Copiar clave compartida", () => call("crypto.export", c));
      for (const pin of status.pendingPins || [])
        button("Revisar cambio de identidad: " + pin.nick, () =>
          call("crypto.confirm", {
            ...c,
            nick: pin.nick,
            fingerprint: pin.fingerprint,
          }),
        );
      if (status.pendingMessages)
        note(status.pendingMessages + " mensajes esperando sesión AGE.");
    } else if (section === "dcc") {
      note(
        "DCC conecta directamente con otra persona. La dirección anunciada debe ser accesible; puede requerir configurar puertos en tu router. No se aceptan archivos automáticamente.",
      );
      const address = input(
          "Tu IP anunciada (IPv4 o IPv6)",
          config.settings.dccAddress,
        ),
        bind = input("IP local de escucha", config.settings.dccBind),
        min = input(
          "Primer puerto (0 = automático)",
          config.settings.dccPortMin,
          "number",
        ),
        max = input("Último puerto", config.settings.dccPortMax, "number"),
        size = input(
          "Tamaño máximo de archivo en MB",
          config.settings.dccMaxBytes / 1048576,
          "number",
        ),
        direct = input(
          "Permitir DCC directo incluso al usar proxy",
          config.settings.dccAllowDirect,
          "checkbox",
        );
      const autoAccept = input(
          "Aceptar automáticamente archivos sin TLS de remitentes autorizados",
          config.settings.dccAutoAccept,
          "checkbox",
        ),
        allowlist = input(
          "Apodos autorizados (separados por comas)",
          (config.settings.dccAllowlist || []).join(", "),
        );
      note(
        "Un apodo puede ser suplantado. Comprueba quién está detrás antes de autorizar la aceptación automática.",
      );
      button("Elegir carpeta de descargas DCC", () => call("dcc.folder"));
      button("Guardar preferencias DCC", () =>
        settings({
          dccAddress: address.value,
          dccBind: bind.value,
          dccPortMin: Number(min.value),
          dccPortMax: Number(max.value),
          dccMaxBytes: Number(size.value) * 1048576,
          dccAllowDirect: direct.checked,
          dccAutoAccept: autoAccept.checked,
          dccAllowlist: allowlist.value
            .split(",")
            .map((n) => n.trim())
            .filter(Boolean),
        }),
      );
      const secure = input(
          "Usar TLS (certificado público previamente intercambiado)",
          false,
          "checkbox",
        ),
        passive = input("Envío pasivo inverso", false, "checkbox");
      button("Enviar archivo al privado seleccionado", () =>
        call("dcc.send", {
          ...requireContext(),
          secure: secure.checked,
          passive: passive.checked,
        }),
      );
      button("Abrir DCC CHAT con el privado seleccionado", () =>
        call("dcc.chat", { ...requireContext(), secure: secure.checked }),
      );
      button("Exportar mi certificado DCC", () => call("dcc.certificate"));
      button("Importar certificado del privado seleccionado", () =>
        call("dcc.trust", requireContext()),
      );
      for (const t of state.transfers) {
        const card = el("section", "advanced-card");
        body.append(card);
        note(
          `${t.nick} · ${t.name} · ${t.kind} · ${t.state} · ${t.bytes}/${t.size ?? "?"} bytes · ${t.speed} B/s${t.error ? " · " + t.error : ""}`,
          card,
        );
        if (
          ["offered", "failed", "cancelled"].includes(t.state) &&
          t.direction === "receive"
        ) {
          button("Aceptar", () => call("dcc.accept", { id: t.id }), card);
          if (t.resumable)
            button(
              "Reanudar",
              () => call("dcc.accept", { id: t.id, resume: true }),
              card,
            );
          button("Rechazar", () => call("dcc.reject", { id: t.id }), card);
        }
        if (
          ["active", "offered", "connecting", "resume-wait"].includes(t.state)
        )
          button("Cancelar", () => call("dcc.cancel", { id: t.id }), card);
        if (t.kind.endsWith("CHAT") && t.state === "active") {
          const message = input("Mensaje DCC", "", "text", card);
          button(
            "Enviar",
            () => call("dcc.message", { id: t.id, text: message.value }),
            card,
          );
        }
      }
      button("Actualizar transferencias", () => show());
    } else if (section === "scripts") {
      note(
        "Los scripts se importan desactivados. Al activarlos reciben automáticamente todos los permisos disponibles.",
      );
      button("Importar archivo .hex", async () => {
        await call("script.import");
        await show();
      });
      for(const script of state.scripts){const card=el('section','advanced-card script-card');body.append(card);note(script.name,card);const enabled=input('Activado',script.enabled,'checkbox',card);enabled.onchange=()=>run(()=>call('script.configure',{id:script.id,enabled:enabled.checked}));button('Ayuda',()=>window.openDreamsScriptHelp(script.id),card);button('Eliminar',async()=>{await call('script.remove',{id:script.id});await show();},card);}
      note("Motor: " + (state.scriptRunning ? "en ejecución" : "detenido"));
      for (const item of state.debug) note(`${item.time} · ${item.text}`);
    } else if (section === "backup") {
      note('Elige qué apartados exportar o restaurar en una ventana aparte.');
      button('Exportar configuración',()=>window.openDreamsBackup('export'));
      button('Importar configuración',()=>window.openDreamsBackup('import'));
    } else if (section === "media") {
      const enabled=input('Activar multimedia',config.settings.mediaEnabled!==false,'checkbox'),avatars=input('Mostrar miniaturas en la lista de usuarios y perfiles',config.settings.showAvatars!==false,'checkbox'),automatic=input('Cargar automáticamente fotos desde mi plantilla',config.settings.autoAvatars===true,'checkbox'),template=input('URL común de fotos (usa {nick} o {nickLower})',config.settings.avatarUrlTemplate||'');
      const messageAvatars=input('Mostrar miniaturas junto a los mensajes',config.settings.showMessageAvatars!==false,'checkbox');
      note('Ejemplo: https://tu-servidor/fotos/{nickLower}.jpg. Al activar la carga automática, ese sitio verá tu IP y los nicks consultados. Con proxy se mantienen bloqueadas las descargas directas.');
      button('Guardar configuración multimedia',async()=>{await settings({showMessageAvatars:messageAvatars.checked,mediaEnabled:enabled.checked,showAvatars:avatars.checked,autoAvatars:automatic.checked,avatarUrlTemplate:template.value.trim()});for(const n of networks.values()){n.avatars={};n.avatarRevision=(n.avatarRevision||0)+1;}avatarRequests.clear();avatarQueue.length=0;await call('avatars.sync');render();});
      if (active && network(active.id).filehost)
        button("Subir archivo al filehost de la red", async () => {
          const r = await call("filehost.upload", requireContext());
          if (r.url) {
            note(r.url);
            button("Compartir enlace en la conversación seleccionada", () =>
              api.send({ id: active.id, target: active.target, text: r.url }),
            );
          }
          return r;
        });
      if (active && network(active.id).networkIcon)
        button("Cargar icono publicado por la red", async () => {
          const r = await call("network.icon", requireContext());
          if (r.image) {
            const img = el("img");
            img.src = r.image;
            img.alt = "Icono de red";
            img.width = 64;
            body.append(img);
          }
          return r;
        });

    }
  }
  window.openDreamsAdvanced=key=>open(key);
  function open(key) {
    if(key==="palette"){openSettings("appearance");return;}
    section = key || section;
    baseOpenSettings("__advanced__");
    body.hidden = false;
    for (const b of nav.querySelectorAll("button"))
      b.classList.toggle("selected", b.dataset.advancedSection === section);
    run(async()=>{await show();window.dispatchEvent(new CustomEvent("dreams-settings-rendered",{detail:section}));});
  }
  $("settings-search").addEventListener("input", () => {
    const q = $("settings-search").value.toLowerCase();
    for (const l of body.querySelectorAll(".advanced-field"))
      l.hidden = !l.textContent.toLowerCase().includes(q);
  });
  const top = document.querySelector(".settings-top");
  top.addEventListener("click", (e) => {
    e.stopImmediatePropagation();
    openSettings("networks");
  });
  const themeButton=el('button','theme-toggle','☀');themeButton.id='theme-toggle';themeButton.type='button';themeButton.onclick=()=>run(()=>settings({theme:document.documentElement.dataset.theme==='light'?'dark':'light'}));document.querySelector('.network-picker').after(themeButton);
  const baseApplySettings=applySettings;applySettings=function(){baseApplySettings();applyComposerStyle();applyTheme();};
  const typing = el("span", "typing-status");
  document.querySelector(".composer").prepend(typing);
  let typingTimer,
    lastTyping = 0;
  $("message-input").addEventListener("input", () => {
    if (config.settings.sendTyping !== false && active && $("message-input").value.trim() && Date.now() - lastTyping > 4000) {
      lastTyping = Date.now();
      call("typing", { ...context(), state: "active" }).catch(() => {});
    }
  });
  api.onEvent((event) => {
    if (event.type === "preferences") {
      Object.assign(config.settings,event.patch||{ignoredUsers:event.settings.ignoredUsers});
      applySettings();
    }
    if (event.type === "features")
      Object.assign(network(event.id), {
        realNameLimit: event.realNameLimit,
        filehost: event.filehost,
        networkIcon: event.networkIcon,
      });
    if (event.type === "capabilities")
      network(event.id).capabilities = event.capabilities;
    if (event.type === "bouncer")
      addMessage(event.id, "*", {
        event: true,
        text: "soju: " + event.params.join(" "),
      });
    if (event.type === "navigate") choose(event.id, event.target);
    if (event.type === "security")
      notify(
        event.text ||
          `${event.subtype}: ${event.target || event.nick || "cifrado"}`,
      );
    if (event.type === "script-launchers") renderLaunchers(event.launchers);
    if (event.type === "script-error") notify("Script: " + event.text, true);
    if (event.type === "dcc-chat") {
      addMessage(event.network, "*", {
        event: true,
        text: `DCC ${event.nick}: ${event.text}`,
      });
      render();
    }
    if (event.type === "delivery") {
      lastMessageView = "";
      for (const c of networks.get(event.id)?.conversations.values() || [])
        for (const m of c.messages)
          if (m.clientId === event.clientId) Object.assign(m, event);
      render();
    }
    if (event.type === "reaction") {
      const c = conversation(event.id, event.target),
        m = c.messages.find((m) => m.messageId === event.messageId);
      if (m) {
        m.reactions ||= {};
        const nicks = new Set(m.reactions[event.emoji] || []);
        event.remove ? nicks.delete(event.nick) : nicks.add(event.nick);
        m.reactions[event.emoji] = [...nicks];
        lastMessageView = "";
        render();
      }
    }
    if (event.type === "redact") {
      for (const c of networks.get(event.id)?.conversations.values() || [])
        c.messages = c.messages.filter((m) => m.messageId !== event.messageId);
      render();
    }
    if(event.type==='status'&&event.state==='connected'){const n=network(event.id);n.avatarEpoch=(n.avatarEpoch||0)+1;n.avatars={};n.userStates={};n.avatarRevision=(n.avatarRevision||0)+1;}
    if(event.type==='user-state'){
      const n=network(event.id),key=fold(event.nick);n.userStates||={};const old=n.userStates[key]||{};n.userStates[key]={...old,...event,metadata:event.avatarVersion!==undefined?(event.metadata||{}):{...old.metadata,...event.metadata}};
      if(event.avatarVersion!==undefined){if(n.avatars)delete n.avatars[key];n.avatarRevision=(n.avatarRevision||0)+1;scheduleRender();}
    }
    if (
      event.type === "typing" &&
      event.id === active?.id &&
      fold(event.target) === fold(active?.target)
    ) {
      typing.textContent =
        event.state === "done" ? "" : event.nick + " está escribiendo…";
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => (typing.textContent = ""), 6000);
    }
    if (
      event.type === "dcc" &&
      event.state === "offered" &&
      event.direction === "receive"
    )
      notify(
        "Oferta " +
          event.kind +
          " de " +
          event.nick +
          ". Revísala en Herramientas → DCC.",
      );
    if (event.type === "script-ui") {
      if (event.subtype === "toast") notify(event.text);
      else showScript(event);
    }
  });
  const launcherArea = el("span", "script-launchers");
  document.querySelector(".menubar nav").append(launcherArea);
  function renderLaunchers(items) {
    launcherArea.replaceChildren();
    for (const item of items || []) {
      button(
        item.label,
        () => call("script.launcher", { ...context(), id: item.id }),
        launcherArea,
      );
    }
  }
  setTimeout(
    () =>
      call("status")
        .then((r) => renderLaunchers(r.launchers))
        .catch(() => {}),
    500,
  );
  const scriptViews = new Map();
  function showScript(event) {
    const key = event.script + "|" + (event.fields?.network || "") + "|" + (event.viewId || "");
    let item = scriptViews.get(key);
    if (!item) {
      const d = el("dialog", "script-view"),
        content = el("div", "form-content"),
        end = el("button", "secondary", "Cerrar");
      d.append(content, end);
      document.body.append(d);
      item = { d, content, event };
      scriptViews.set(key, item);
      end.onclick = () => d.close();
      d.addEventListener("close", () => {
        scriptViews.delete(key);
        d.remove();
        const e = item.event;
        call("script.signal", { network: e.fields?.network, target: e.fields?.buffer,
          script: e.script, signal: "view_closed", args: [e.viewId || ""] }).catch(() => {});
      });
    }
    item.event = event;
    // Las vistas de un script pueden actualizarse con cada PV sin perder el texto
    // que la persona está escribiendo en un formulario abierto.
    const existing = new Map(
      [...item.content.querySelectorAll("[data-hex-field]")].map(n =>
        [n.dataset.hexField, n.type === "checkbox" || n.type === "radio" ? n.checked : n.value])
    );
    item.content.replaceChildren();
    const runAction = (action, args, form = false) => run(async () => {
      const additions = form
        ? [...item.content.querySelectorAll("[data-hex-field]")]
            .filter(n => n.type !== "radio" || n.checked)
            .map(n => n.type === "checkbox" ? String(n.checked) : n.type === "radio" ? n.value : n.value)
        : [];
      await call("script.signal", { network: item.event.fields?.network,
        target: item.event.fields?.buffer, script: item.event.script,
        signal: action, args: [...args, ...additions] });
    });
    function tree(nodes, parent, depth = 0) {
      if (depth > 40) return;
      for (const node of (nodes || []).slice(0, 2000)) {
        const props = node.props || {},
          editable = ["input", "textarea", "checkbox", "radio"].includes(node.type),
          n = editable
            ? el("label", "hex-field")
            : el(node.type === "button" ? "button" : "div", "hex-" + node.type, node.text);
        if (node.type === "image") n.textContent = "[Imagen: " + node.text + "]";
        if (editable) {
          const control = el(node.type === "textarea" ? "textarea" : "input");
          if (node.type !== "textarea") control.type =
            node.type === "input" ? "text" : node.type;
          control.dataset.hexField = props.name || "";
          control.setAttribute("aria-label", node.text || props.name || "");
          if (node.type === "radio") {
            control.name = "hex-" + key + "-" + props.name;
            control.value = props.value || "";
            control.checked = existing.has(props.name + ":" + control.value)
              ? existing.get(props.name + ":" + control.value)
              : props.value === props.current;
            control.dataset.hexField = props.name + ":" + control.value;
          } else if (node.type === "checkbox") {
            control.checked = existing.has(props.name)
              ? existing.get(props.name) : props.value === "true";
          } else {
            control.value = existing.has(props.name)
              ? existing.get(props.name) : (props.value || "");
            control.maxLength = node.type === "textarea" ? 2000 : 500;
          }
          n.append(el("span", "", node.text), control);
          n.classList.add("hex-" + node.type);
        }
        if (node.type === "button")
          n.onclick = () => runAction(node.action, node.args || [],
            // Los formularios se envían solo cuando el botón lo solicita.
            node.action === "pv.save" || node.action === "pv.manualadd");
        for (const [prop, css] of Object.entries({ color: "color", bg: "backgroundColor" }))
          if (/^#[a-f\d]{3,8}$/i.test(props[prop] || "")) n.style[css] = props[prop];
        for (const [prop, css, max] of [
          ["pad", "padding", 32], ["gap", "gap", 24],
          ["radius", "borderRadius", 32], ["textsize", "fontSize", 36]])
          if (props[prop] !== undefined && Number.isFinite(Number(props[prop])))
            n.style[css] = Math.max(0, Math.min(max, Number(props[prop]))) + "px";
        if (props.bold) n.style.fontWeight = "700";
        if (props.weight && Number.isFinite(Number(props.weight)))
          n.style.flex = String(Math.max(0, Math.min(10, Number(props.weight))));
        if (props.fill) n.style.width = "100%";
        parent.append(n);
        tree(node.children, n, depth + 1);
      }
    }
    tree(event.tree || event.view || event.nodes, item.content);
    if (!item.content.childNodes.length)
      note(event.text || "Vista del script", item.content);
    if (!item.d.open) item.d.showModal();
  }
  window.previewDreamsMedia = async (url) => {
    try {
      const result = await call("media.preview", { url });
      if (result.cancelled) return;
      const popup = el("dialog", "image-dialog"),
        head = el("header", "dialog-header"),
        title = el("h2", "", "Imagen"),
        close = el("button", "icon-button", "×"),
        content = el("div", "form-content");
      close.onclick = () => {
        popup.close();
        popup.remove();
      };
      head.append(title, close);
      if (result.image) {
        const image = el("img");
        image.src = result.image;
        image.alt = "Imagen solicitada";
        content.append(image);
      } else
        note(
          result.title || "El enlace no contiene una imagen compatible.",
          content,
        );
      popup.append(head, content);
      document.body.append(popup);
      popup.showModal();
    } catch (e) {
      notify(e.message, true);
    }
  };
  const avatarRequests=new Map(),avatarQueue=[];let avatarRunning=0;
  function drainAvatars(){while(avatarRunning<3&&avatarQueue.length){const task=avatarQueue.shift(),n=network(task.id);if(config.settings.mediaEnabled===false||!config.settings.autoAvatars||(config.settings.showAvatars===false&&config.settings.showMessageAvatars===false)||task.epoch!==(n.avatarEpoch||0)||task.version!==(n.userStates?.[fold(task.nick)]?.avatarVersion||0))continue;avatarRunning++;call('avatar.load',{network:task.id,nick:task.nick}).then(r=>{if(r.image&&task.epoch===(n.avatarEpoch||0)&&task.version===(n.userStates?.[fold(task.nick)]?.avatarVersion||0)&&config.settings.avatarUrlTemplate===task.template&&(profile(task.id)?.photoUrl||'')===task.photoUrl&&config.settings.mediaEnabled!==false&&(config.settings.showAvatars!==false||config.settings.showMessageAvatars!==false)){n.avatars||={};n.avatars[fold(task.nick)]=r.image;n.avatarRevision=(n.avatarRevision||0)+1;scheduleRender();}}).catch(()=>{}).finally(()=>{avatarRunning--;drainAvatars();});}}
  window.resetDreamsAvatars=()=>{avatarRequests.clear();for(const n of networks.values()){n.avatarEpoch=(n.avatarEpoch||0)+1;n.avatars={};n.avatarRevision=(n.avatarRevision||0)+1;}};
  window.loadDreamsAvatars=()=>{if(!active||config.settings.mediaEnabled===false||(config.settings.showAvatars===false&&config.settings.showMessageAvatars===false)||!config.settings.autoAvatars)return;const n=network(active.id),c=selected(),names=new Set([n.nick,...(config.settings.showAvatars!==false?c?.users||[]:[]).map(user=>bareNick(user,n)),...(c?.messages||[]).slice(-100).map(m=>m.nick).filter(Boolean)]);for(const nick of names){const version=n.userStates?.[fold(nick)]?.avatarVersion||0,epoch=n.avatarEpoch||0,key=active.id+'|'+fold(nick)+'|'+version+'|'+epoch+'|'+config.settings.avatarUrlTemplate+'|'+(profile(active.id)?.photoUrl||'');if(Date.now()-(avatarRequests.get(key)||0)<60000)continue;if(avatarQueue.length>=200)break;avatarRequests.set(key,Date.now());if(avatarRequests.size>1000)avatarRequests.delete(avatarRequests.keys().next().value);avatarQueue.push({id:active.id,nick,version,epoch,template:config.settings.avatarUrlTemplate,photoUrl:profile(active.id)?.photoUrl||''});}drainAvatars();};
  api.onEvent(event=>{if(event.type==='attention'&&event.flash){const workspace=document.querySelector('.workspace');workspace.classList.remove('mention-flash');void workspace.offsetWidth;workspace.classList.add('mention-flash');setTimeout(()=>workspace.classList.remove('mention-flash'),2200);}if(event.type==='attention'){const c=conversation(event.id,event.target);c.mentionUntil=Date.now()+4000;renderTabs();}});
  const historyLoaded = new WeakSet(), originalChoose = choose;
  choose = function (id, target,...rest) {
    if(active && config.settings.sendTyping!==false)call("typing",{...context(),state:"done"}).catch(()=>{});
    lastTyping=0;typing.textContent="";clearTimeout(typingTimer);
    originalChoose(id,target,...rest);call("read",{network:id,target}).catch(()=>{});
    const n=network(id),c=n.conversations.get(fold(target)),limit=c?.kind==='channel'?(config.settings.historyRoomRows??300):c?.kind==='private'?(config.settings.historyPrivateRows??300):0;
    if(!c||!config.settings.historyEnabled||!limit||historyLoaded.has(c))return;
    historyLoaded.add(c);
    const identity=m=>m.messageId?'server:'+m.messageId:m.clientId?'client:'+m.clientId:JSON.stringify([m.nick||'',m.text||'',Number(new Date(m.time)),!!m.event,!!m.action]);
    call("history.search",{network:id,target,limit}).then(rows=>{
      if(networks.get(id)!==n||n.conversations.get(fold(target))!==c)return;
      const live=[...c.messages],counts=new Map();for(const m of live){const key=identity(m);counts.set(key,(counts.get(key)||0)+1);}
      const saved={unread:c.unread,mentions:c.mentions,firstUnreadId:c.firstUnreadId,activityUntil:c.activityUntil,mentionUntil:c.mentionUntil};c.messages=[];
      for(const m of rows){const key=identity(m),count=counts.get(key)||0;if(count){counts.set(key,count-1);continue;}workspace.addMessage(id,target,{...m,historical:true,own:!!m.own,action:!!m.action});}
      for(const m of live){const inserted=workspace.addMessage(id,target,{...m,historical:true});Object.assign(inserted,m);if(!Object.hasOwn(m,'historical'))delete inserted.historical;}
      Object.assign(c,saved);c.revision=(c.revision||0)+1;render(true);
    }).catch(e=>{historyLoaded.delete(c);notify(e.message,true);});
  };
  matchMedia("(prefers-color-scheme: light)").addEventListener(
    "change",
    applyTheme,
  );
  setTimeout(applyTheme, 300);
})();
