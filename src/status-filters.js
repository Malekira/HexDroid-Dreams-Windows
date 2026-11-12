(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DreamsStatus = api;
})(globalThis, () => {
  const groups = {
    connection: {
      label: "Conexión y desconexión",
      items: {
        connected: "Conexión",
        disconnected: "Desconexión",
        connecting: "Intentos y reconexiones",
      },
    },
    server: {
      label: "Mensajes del servidor",
      items: { server: "Información del servidor", motd: "Mensaje del día" },
    },
    errors: { label: "Errores", items: { errors: "Errores IRC y locales" } },
    notices: { label: "Avisos", items: { notices: "NOTICE" } },
    commands: {
      label: "Respuestas a comandos IRC",
      items: { commands: "Respuestas numéricas", queries: "WHOIS / WHO" },
    },
    channels: {
      label: "Actividad de canales",
      items: { channels: "Entradas, salidas y modos" },
    },
    nicks: { label: "Cambios de nick", items: { nicks: "Cambios de nick" } },
    services: {
      label: "Servicios IRC",
      items: { services: "NickServ, ChanServ, MeMo y otros servicios" },
    },
    debug: { label: "Depuración", items: { debug: "Diagnósticos" } },
  };
  const keys = Object.values(groups).flatMap((g) => Object.keys(g.items));
  function category(m) {
    if (m.statusCategory === "connection")
      return /desconect/i.test(m.text)
        ? "disconnected"
        : /conectad|connected/i.test(m.text)
          ? "connected"
          : "connecting";
    if (m.error) return "errors";
    if (m.notice) return "notices";
    if (
      /^(nickserv|chanserv|memoserv|memo|operserv|hostserv|auth|q)$/i.test(
        m.nick || "",
      )
    )
      return "services";
    if (m.eventType === "nick") return "nicks";
    if (["join", "part", "quit", "kick", "mode"].includes(m.eventType))
      return "channels";
    const code = Number(m.code);
    if (code >= 400) return "errors";
    if ([372, 375, 376, 422].includes(code)) return "motd";
    if ([311, 312, 313, 317, 318, 319, 330, 352, 354, 315].includes(code))
      return "queries";
    if (code) return "commands";
    if (m.statusCategory && keys.includes(m.statusCategory))
      return m.statusCategory;
    return "server";
  }
  function visible(m, filters = {}) {
    const key = category(m),
      group = Object.keys(groups).find((g) =>
        Object.hasOwn(groups[g].items, key),
      );
    return filters[group] !== false && filters[key] !== false;
  }
  return {
    groups,
    keys: [...new Set([...Object.keys(groups), ...keys])],
    category,
    visible,
  };
});
