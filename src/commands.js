"use strict";
const { token, cleanText } = require("./irc");
function executeInput(client, target, text, emit = () => {}) {
  if (!client?.ready) throw new Error("Conecta primero esta red.");
  if (typeof text !== "string" || text.length > 10000)
    throw new Error("Mensaje no válido o demasiado largo.");
  if (!text.startsWith("/") || text.startsWith("//")) {
    token(target, "Destino");
    if (target === "*")
      throw new Error("Selecciona una sala o un privado para enviar mensajes.");
    const lines = (text.startsWith("//") ? text.slice(1) : text)
      .split(/\r?\n/)
      .filter((line) => line.trim());
    if (lines.length > 20)
      throw new Error("Envía como máximo 20 líneas cada vez.");
    for (const line of lines) {
      cleanText(line);
      if (Buffer.byteLength(`PRIVMSG ${target} :${line}`) > 510)
        throw new Error("Una línea es demasiado larga para IRC.");
    }
    if (lines.length > 1 && typeof client.sendMultiline === "function")
      client.sendMultiline(target, lines);
    else for (const line of lines) client.sendMessage(target, line);
    return;
  }
  cleanText(text);
  const split = text.indexOf(" "),
    command = (split < 0 ? text.slice(1) : text.slice(1, split)).toLowerCase(),
    args = split < 0 ? "" : text.slice(split + 1).trim();
  const channel = () => {
    token(target, "Sala");
    if (!/^[#&+!]/.test(target))
      throw new Error("Selecciona una sala para esta acción.");
    return target;
  };
  if (command === "join" || command === "j") { const room=/^[#&+!]/.test(args)?args:"#"+args; token(room,"Sala"); if(room.length<2)throw new Error("Indica una sala."); client.join(room); }
  else if (command === "identify") {
    if (!args)
      throw new Error(
        "Uso: /identify contraseña o /identify cuenta contraseña",
      );
    client.sendMessage("NickServ", "IDENTIFY " + args);
  } else if (command === "login") {
    if (!args) throw new Error("Uso: /login cuenta contraseña");
    client.sendRaw("LOGIN " + args);
  } else if (command === "me") client.sendMessage(target, args, true);
  else if (command === "query") {
    token(args, "Apodo");
    emit("query", { target: args });
  } else if (command === "msg" || command === "notice") {
    const space = args.indexOf(" ");
    if (space < 1) throw new Error(`Uso: /${command} apodo mensaje`);
    const to = args.slice(0, space),
      body = args.slice(space + 1);
    token(to, "Destino");
    if (command === "msg") client.sendMessage(to, body);
    else {
      client.sendRaw(`NOTICE ${to} :${body}`);
      emit("message", {
        target: to,
        text: body,
        nick: client.nick,
        own: true,
        notice: true,
      });
    }
  } else if (command === "part")
    client.sendRaw(`PART ${channel()} :${args || "Hasta pronto"}`);
  else if (command === "cycle") {
    client.sendRaw(`PART ${channel()} :${args || "Volviendo"}`);
    client.join(target);
  } else if (command === "nick") {
    token(args, "Apodo");
    client.sendRaw(`NICK ${args}`);
  } else if (command === "whois" || command === "who") {
    token(args || target, "Destino");
    if (typeof client.request === "function")
      client.request(`${command.toUpperCase()} ${args || target}`, "*consultas*");
    else client.sendRaw(`${command.toUpperCase()} ${args || target}`);
    emit("query",{target:"*consultas*",...(command==="whois"?{whois:args||target}:{})});
  } else if (command === "topic")
    client.sendRaw(`TOPIC ${channel()}${args ? " :" + args : ""}`);
  else if (command === "mode") client.sendRaw(`MODE ${args || channel()}`);
  else if (
    ["op", "deop", "voice", "devoice", "ban", "unban"].includes(command)
  ) {
    token(args, "Usuario o máscara");
    const mode = {
      op: "+o",
      deop: "-o",
      voice: "+v",
      devoice: "-v",
      ban: "+b",
      unban: "-b",
    }[command];
    client.sendRaw(`MODE ${channel()} ${mode} ${args}`);
  } else if (command === "kick") {
    const [nick, ...reason] = args.split(" ");
    token(nick, "Apodo");
    client.sendRaw(
      `KICK ${channel()} ${nick} :${reason.join(" ") || "Expulsado"}`,
    );
  } else if (command === "invite") {
    token(args, "Apodo");
    client.sendRaw(`INVITE ${args} ${channel()}`);
  } else if (command === "kickban") {
    const [nick, ...reason] = args.split(" ");
    token(nick, "Apodo");
    client.sendRaw(`MODE ${channel()} +b ${nick}!*@*`);
    client.sendRaw(
      `KICK ${target} ${nick} :${reason.join(" ") || "Expulsado"}`,
    );
  } else if (command === "amsg" || command === "ame") {
    for (const joined of client.joined?.values() || [])
      client.sendMessage(joined, args, command === "ame");
  } else if (command === "markread") client.markRead(args || target);
  else if (command === "ctcp" || command === "ping") {
    const [nick, ...words] = args.split(" ");
    token(nick, "Apodo");
    const body = command === "ping" ? "PING " + Date.now() : words.join(" ");
    if (!body) throw new Error("Uso: /ctcp apodo VERSION");
    client.sendRaw(`PRIVMSG ${nick} :\x01${body}\x01`);
  } else if (
    [
      "ns",
      "nickserv",
      "cs",
      "chanserv",
      "hs",
      "hostserv",
      "os",
      "operserv",
    ].includes(command)
  ) {
    const service = {
      ns: "NickServ",
      nickserv: "NickServ",
      cs: "ChanServ",
      chanserv: "ChanServ",
      hs: "HostServ",
      hostserv: "HostServ",
      os: "OperServ",
      operserv: "OperServ",
    }[command];
    client.sendMessage(service, args);
  } else if (
    [
      "monitor",
      "metadata",
      "register",
      "verify",
      "names",
      "whowas",
      "knock",
      "oper",
      "kill",
      "kline",
      "unkline",
      "gline",
      "ungline",
      "rehash",
      "wallops",
    ].includes(command)
  )
    client.sendRaw(command.toUpperCase() + (args ? " " + args : ""));
  else if (command === "quit") client.disconnect();
  else if (command === "raw" || command === "quote") {
    if (!args) throw new Error("Introduce un comando IRC.");
    client.sendRaw(args);
  } else if (
    [
      "list",
      "time",
      "version",
      "motd",
      "admin",
      "info",
      "away",
      "back",
    ].includes(command)
  )
    client.sendRaw(
      command === "back"
        ? "AWAY"
        : command === "away"
          ? `AWAY${args ? " :" + args : ""}`
          : command.toUpperCase() + (args ? " " + args : ""),
    );
  else if (/^[a-z][a-z0-9_-]*$/.test(command))
    client.sendRaw(command.toUpperCase() + (args ? " " + args : ""));
  else throw new Error("Nombre de comando IRC no válido.");
}
module.exports = { executeInput };
