"use strict";
// All content from IRC and scripts is rendered as text or a closed widget tree.
(() => {
  if (!api.advanced) return;
  let section = "networks",
    state = {},
    busy = false;
  const dialog = el("dialog", "advanced-dialog"),
    header = el("header", "dialog-header"),
    title = el("h2", "", "Configuración completa"),
    close = el("button", "icon-button", "×");
  close.type = "button";
  close.onclick = () => dialog.close();
  header.append(title, close);
  const nav = el("nav", "advanced-nav"),
    body = el("div", "advanced-content"),
    feedback = el("p", "note");
  feedback.setAttribute("role", "status");
  dialog.append(header, nav, body, feedback);
  document.body.append(dialog);
  const names = {
    appearance: "Apariencia y disposición",
    networks: "Red y autenticación",
    history: "Historial",
    notifications: "Notificaciones y tema",
    dcc: "Transferencias DCC",
    crypto: "Cifrado",
    scripts: "Scripts .hex",
    backup: "Respaldos",
    media: "Multimedia",
  };
  for (const [key, label] of Object.entries(names)) {
    const b = el("button", "secondary", label);
    b.onclick = () => {
      section = key;
      run(show);
    };
    nav.append(b);
  }
  function button(label, action, parent = body) {
    const b = el("button", "secondary", label);
    b.type = "button";
    b.onclick = () => run(action);
    parent.append(b);
    return b;
  }
  function input(label, value = "", type = "text", parent = body) {
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
      const username = input("Usuario IRC", p.username || p.nick),
        realName = input("Nombre real", p.realName || "HexDroid Dreams"),
        sasl = select(
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
        commands = input(
          "Comandos tras conectar (uno por línea, sin contraseñas)",
          (p.commands || []).join("\n"),
          "textarea",
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
          username: username.value,
          realName: realName.value,
          sasl: sasl.value,
          saslUsername: saslUsername.value,
          alternateNick: alternateNick.value,
          encoding: encoding.value,
          autoReconnect: autoReconnect.checked,
          autoConnect: autoConnect.checked,
          reconnectDelay: Number(delay.value),
          commandDelay: Number(commandDelay.value),
          commands: commands.value
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
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
      const enabled = input(
          "Guardar historial local",
          config.settings.historyEnabled,
          "checkbox",
        ),
        days = input(
          "Retener durante días",
          config.settings.historyDays ?? 30,
          "number",
        );
      const protocol = input(
        "Registro de protocolo cifrado (sin contenido de mensajes)",
        config.settings.protocolLogging,
        "checkbox",
      );
      protocol.disabled = !state.secureStorage;
      note("0 días conserva indefinidamente.");
      button("Cambiar carpeta de historial", () => call("history.folder"));
      note(
        "El historial guarda el contenido de las conversaciones en este equipo. Está desactivado por defecto.",
      );
      button("Guardar preferencias", () =>
        settings({
          historyEnabled: enabled.checked,
          historyDays: Number(days.value),
          protocolLogging: protocol.checked,
        }),
      );
      const query = input("Texto a buscar"),
        nick = input("Filtrar apodo (opcional)"),
        all = input("Buscar en todas las redes", true, "checkbox"),
        results = el("div", "history-results");
      body.append(results);
      button("Buscar", async () => {
        const rows = await call("history.search", {
          text: query.value,
          nick: nick.value,
          ...(!all.checked ? context() : {}),
          limit: 500,
        });
        results.replaceChildren();
        for (const m of rows) {
          const row = el(
            "p",
            "",
            `${new Date(m.time).toLocaleString()} ${m.network} ${m.target} <${m.nick}> ${m.text}`,
          );
          if (profile(m.network))
            button(
              "Abrir conversación",
              () => {
                dialog.close();
                choose(m.network, m.target);
              },
              row,
            );
          results.append(row);
        }
        note(`${rows.length} resultados (máximo 500 por búsqueda).`, results);
      });
      button("Exportar resultados a TXT", () =>
        call("history.export", {
          text: query.value,
          nick: nick.value,
          ...(!all.checked ? context() : {}),
        }),
      );
      button("Exportar resultados a ZIP", () =>
        call("history.export", {
          zip: true,
          text: query.value,
          nick: nick.value,
          ...(!all.checked ? context() : {}),
        }),
      );
      button("Ver diagnóstico de protocolo", async () => {
        const rows = await call("protocol.read");
        results.replaceChildren();
        for (const r of rows)
          note(`${r.time} ${r.direction} ${r.line}`, results);
      });
      button("Pedir historial al servidor", () =>
        call("history.server", requireContext()),
      );
      button("Eliminar historial local", () => call("history.clear"));
    } else if (section === "notifications") {
      const theme = select(
          "Tema",
          [
            ["dark", "Oscuro"],
            ["light", "Claro"],
            ["system", "Sistema"],
            ["matrix", "Matrix"],
          ],
          config.settings.theme || "dark",
        ),
        enabled = input(
          "Notificar privados y menciones",
          config.settings.notifications,
          "checkbox",
        ),
        preview = input(
          "Mostrar contenido en la notificación",
          config.settings.notificationPreview,
          "checkbox",
        ),
        sound = input(
          "Sonido de notificación",
          config.settings.notificationSound,
          "checkbox",
        ),
        flash = input(
          "Destacar la ventana",
          config.settings.flashOnMention,
          "checkbox",
        );
      const minimize = input(
          "Minimizar a la bandeja",
          config.settings.minimizeToTray,
          "checkbox",
        ),
        closeTray = input(
          "Cerrar ventana mantiene conexiones en la bandeja",
          config.settings.closeToTray,
          "checkbox",
        ),
        highlights = input(
          "Palabras destacadas (separadas por comas)",
          (config.settings.highlightWords || []).join(", "),
        );
      button("Guardar", () =>
        settings({
          minimizeToTray: minimize.checked,
          closeToTray: closeTray.checked,
          highlightWords: highlights.value
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean),
          theme: theme.value,
          notifications: enabled.checked,
          notificationPreview: preview.checked,
          notificationSound: sound.checked,
          flashOnMention: flash.checked,
        }),
      );
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
        "Los scripts se importan desactivados y se ejecutan en un intérprete aislado. Concede solo los permisos que necesiten.",
      );
      button("Importar archivo .hex", async () => {
        await call("script.import");
        await show();
      });
      for (const script of state.scripts) {
        const card = el("section", "advanced-card");
        body.append(card);
        note(script.name, card);
        const enabled = input("Habilitado", script.enabled, "checkbox", card),
          checks = {};
        for (const permission of [
          "read",
          "intercept",
          "send",
          "raw",
          "http",
          "ui",
          "persist",
          "crypto",
        ])
          checks[permission] = input(
            permission,
            script.permissions.includes(permission),
            "checkbox",
            card,
          );
        const domains = input(
          "Dominios HTTPS autorizados (separados por comas)",
          script.domains.join(", "),
          "text",
          card,
        );
        button(
          "Aplicar permisos",
          () =>
            call("script.configure", {
              id: script.id,
              enabled: enabled.checked,
              permissions: Object.keys(checks).filter((k) => checks[k].checked),
              domains: domains.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            }),
          card,
        );
        button(
          "Eliminar",
          async () => {
            await call("script.remove", { id: script.id });
            await show();
          },
          card,
        );
      }
      note("Motor: " + (state.scriptRunning ? "en ejecución" : "detenido"));
      for (const item of state.debug) note(`${item.time} · ${item.text}`);
    } else if (section === "backup") {
      const secrets = input(
          "Incluir credenciales y claves cifradas",
          false,
          "checkbox",
        ),
        password = input(
          "Frase de paso (mínimo 12 caracteres para exportar secretos)",
          "",
          "password",
        );
      note(
        "La importación requiere confirmación y reemplaza las redes y preferencias. Conserva un respaldo antes de restaurar.",
      );
      button("Exportar respaldo", () =>
        call("backup.export", {
          includeSecrets: secrets.checked,
          password: password.value,
        }),
      );
      button("Importar respaldo", async () => {
        const r = await call("backup.import", { password: password.value });
        if (r.reload) location.reload();
        return r;
      });
    } else if (section === "media") {
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
      const url = input("URL HTTPS para vista previa"),
        preview = el("div", "media-preview");
      body.append(preview);
      note(
        "Las vistas previas solo se descargan al solicitarlas y requieren confirmación.",
      );
      button("Cargar vista previa", async () => {
        const r = await call("media.preview", { url: url.value });
        preview.replaceChildren();
        if (r.image) {
          const img = el("img");
          img.src = r.image;
          img.alt = "Vista previa solicitada";
          preview.append(img);
          button(
            "Guardar imagen",
            () => call("media.save", { cacheId: r.cacheId }),
            preview,
          );
        } else if (r.title) note(r.title, preview);
        return r;
      });
      button("Abrir en navegador", () => call("link.open", { url: url.value }));
    }
  }
  function open(key) {
    section = key || section;
    if (!dialog.open) dialog.showModal();
    run(show);
  }
  const optionSearch = input("Buscar opciones", "", "search", dialog);
  dialog.insertBefore(optionSearch.parentElement, nav);
  optionSearch.oninput = () => {
    const q = optionSearch.value.toLowerCase();
    for (const b of nav.children)
      b.hidden = !b.textContent.toLowerCase().includes(q);
    for (const l of body.querySelectorAll(".advanced-field"))
      l.hidden = !l.textContent.toLowerCase().includes(q);
  };
  const top = document.querySelector(".settings-top");
  top.addEventListener("click", (e) => {
    e.stopImmediatePropagation();
    open();
  });
  const menu = document.querySelector(".menubar nav");
  const launch = el("button", "advanced-launch", "Herramientas");
  launch.onclick = () => open();
  menu.append(launch);
  const settingsNav =
    document.querySelector(".settings-nav") ||
    document.querySelector("#settings-dialog nav");
  if (settingsNav)
    button(
      "Configuración completa",
      () => {
        document.getElementById("settings-dialog").close();
        open();
      },
      settingsNav,
    );
  const typing = el("span", "typing-status");
  document.querySelector(".composer").prepend(typing);
  let typingTimer,
    lastTyping = 0;
  $("message-input").addEventListener("input", () => {
    if (active && Date.now() - lastTyping > 4000) {
      lastTyping = Date.now();
      call("typing", { ...context(), state: "active" }).catch(() => {});
    }
  });
  api.onEvent((event) => {
    if (event.type === "preferences") {
      config.settings = event.settings;
      applySettings();
    }
    if (event.type === "features")
      Object.assign(network(event.id), {
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
    if (event.type === "user-state") {
      network(event.id).userStates ||= {};
      network(event.id).userStates[fold(event.nick)] = {
        ...network(event.id).userStates[fold(event.nick)],
        ...event,
      };
    }
    if (event.type === "typing" && event.id === active?.id) {
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
  function showScript(event) {
    const d = el("dialog", "script-view"),
      content = el("div", "form-content"),
      end = el("button", "secondary", "Cerrar");
    end.onclick = () => {
      d.close();
      d.remove();
    };
    d.append(content, end);
    document.body.append(d);
    function tree(nodes, parent, depth = 0) {
      if (depth > 40) return;
      for (const item of (nodes || []).slice(0, 2000)) {
        const n = el(
          item.type === "button" ? "button" : "div",
          "hex-" + item.type,
          item.text,
        );
        if (item.type === "image")
          n.textContent = "[Imagen: " + item.text + "]";
        if (item.type === "button")
          n.onclick = () =>
            run(() =>
              call("script.signal", {
                network: event.fields?.network,
                target: event.fields?.buffer,
                script: event.script,
                signal: item.action,
                args: item.args,
              }),
            );
        if (/^#[a-f\d]{3,8}$/i.test(item.props?.color))
          n.style.color = item.props.color;
        parent.append(n);
        tree(item.children, n, depth + 1);
      }
    }
    tree(event.tree || event.view || event.nodes, content);
    if (!content.childNodes.length)
      note(event.text || "Vista del script", content);
    d.showModal();
  }
  const historyLoaded = new Set(),
    originalChoose = choose;
  choose = function (id, target) {
    originalChoose(id, target);
    call("read", { network: id, target }).catch(() => {});
    const key = id + "\0" + fold(target);
    if (!config.settings.historyEnabled || historyLoaded.has(key)) return;
    historyLoaded.add(key);
    call("history.search", { network: id, target, limit: 300 })
      .then((rows) => {
        const c = conversation(id, target),
          live = [...c.messages];
        c.messages = [];
        for (const message of rows)
          workspace.addMessage(id, target, {
            ...message,
            historical: true,
            own: !!message.own,
            action: !!message.action,
          });
        for (const message of live) workspace.addMessage(id, target, message);
        render();
      })
      .catch((e) => notify(e.message, true));
  };
  matchMedia("(prefers-color-scheme: light)").addEventListener(
    "change",
    applyTheme,
  );
  setTimeout(applyTheme, 300);
})();
