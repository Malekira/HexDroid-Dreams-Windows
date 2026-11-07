"use strict";
// HexDroid .hex language adaptation. Reference: boxlabs Android engine, GPL-3.0-or-later.
const crypto = require("node:crypto");
const MAX_STRING = 131072,
  MAX_ITEMS = 10000;
const str = (v) =>
  v instanceof Map
    ? [...v].map(([k, v]) => k + "=" + str(v)).join(" ")
    : Array.isArray(v)
      ? v.map(str).join(" ")
      : v === null || v === undefined
        ? ""
        : String(v);
const num = (v) =>
  Array.isArray(v) || v instanceof Map
    ? (v.size ?? v.length)
    : Number(str(v)) || 0;
const truth = (v) => !["", "false", "0"].includes(str(v).toLowerCase());
function bounded(v) {
  if (
    (typeof v === "string" && v.length > MAX_STRING) ||
    (Array.isArray(v) && v.length > MAX_ITEMS) ||
    (v instanceof Map && v.size > MAX_ITEMS)
  )
    throw new Error("El script superó el límite de datos.");
  return v;
}
function splitTop(source, delimiter) {
  const result = [];
  let start = 0,
    depth = 0,
    quote = false,
    escape = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\" && quote) {
      escape = true;
      continue;
    }
    if (c === '"') {
      quote = !quote;
      continue;
    }
    if (quote) continue;
    if (c === "(") depth++;
    else if (c === ")") depth = Math.max(0, depth - 1);
    if (!depth && source.startsWith(delimiter, i)) {
      result.push(source.slice(start, i));
      start = i + delimiter.length;
      i += delimiter.length - 1;
    }
  }
  result.push(source.slice(start));
  return result;
}
function tokens(text) {
  const result = [];
  let at = 0;
  while (at < text.length) {
    while (/\s/.test(text[at] || "") && at < text.length) at++;
    if (at >= text.length) break;
    let end = at,
      depth = 0,
      quote = false,
      escape = false;
    while (end < text.length) {
      const c = text[end];
      if (escape) {
        escape = false;
        end++;
        continue;
      }
      if (c === "\\" && quote) {
        escape = true;
        end++;
        continue;
      }
      if (c === '"') quote = !quote;
      if (!quote) {
        if (c === "(") depth++;
        if (c === ")") depth = Math.max(0, depth - 1);
        if (/\s/.test(c) && depth === 0) break;
      }
      end++;
    }
    result.push(text.slice(at, end));
    at = end;
  }
  return result;
}
function parse(source) {
  if (typeof source !== "string" || source.length > 262144)
    throw new Error("Script demasiado grande.");
  const text = source
    .split(/\r?\n/)
    .map((line) => {
      let quote = false,
        escape = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (escape) {
          escape = false;
          continue;
        }
        if (c === "\\" && quote) {
          escape = true;
          continue;
        }
        if (c === '"') quote = !quote;
        if (c === ";" && !quote) return line.slice(0, i);
      }
      return line;
    })
    .join("\n");
  let at = 0,
    nodes = 0;
  function block(nested = false, level = 0) {
    if (level > 80) throw new Error("Demasiados bloques anidados.");
    const out = [];
    while (at < text.length) {
      while (/[\s|]/.test(text[at] || "") && at < text.length) at++;
      if (at >= text.length) break;
      if (text[at] === "}") {
        if (!nested) throw new Error("Llave de cierre inesperada.");
        at++;
        return out;
      }
      let header = "",
        quote = false,
        escape = false,
        depth = 0;
      while (at < text.length) {
        const c = text[at];
        if (escape) {
          header += c;
          escape = false;
          at++;
          continue;
        }
        if (c === "\\" && quote) {
          header += c;
          escape = true;
          at++;
          continue;
        }
        if (c === '"') {
          quote = !quote;
          header += c;
          at++;
          continue;
        }
        if (!quote) {
          if (c === "(") depth++;
          else if (c === ")") depth = Math.max(0, depth - 1);
          if (depth === 0 && ["{", "}", "\n", "|"].includes(c)) break;
        }
        header += c;
        at++;
      }
      header = header.trim();
      if (!header) {
        if (text[at] === "\n" || text[at] === "|") {
          at++;
          continue;
        }
        throw new Error("Sentencia .hex vacía o no válida.");
      }
      if (++nodes > 20000) throw new Error("Demasiadas sentencias .hex.");
      if (text[at] === "{") {
        at++;
        out.push({ header, body: block(true, level + 1) });
      } else out.push({ header });
    }
    if (nested)
      throw new Error(
        "Bloque .hex sin cerrar (línea " +
          text.slice(0, at).split("\n").length +
          ").",
      );
    return out;
  }
  return block();
}
function glob(pattern, text) {
  return new RegExp(
    "^" +
      pattern
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*")
        .replace(/\\\?/g, ".") +
      "$",
    "i",
  ).test(text);
}
function arithmetic(source) {
  const parts =
    source.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[()+*/%\-]/gi) || [];
  if (
    parts.join("").toLowerCase() !== source.replace(/\s/g, "").toLowerCase() ||
    parts.length > 1000
  )
    throw new Error("Expresión matemática no válida.");
  let at = 0;
  const primary = () => {
    if (parts[at] === "-") {
      at++;
      return -primary();
    }
    if (parts[at] === "+") {
      at++;
      return primary();
    }
    if (parts[at] === "(") {
      at++;
      const n = sum();
      if (parts[at++] !== ")")
        throw new Error("Paréntesis matemático sin cerrar.");
      return n;
    }
    const value = Number(parts[at++]);
    if (!Number.isFinite(value)) throw new Error("Número no válido.");
    return value;
  };
  const product = () => {
    let n = primary();
    while (["*", "/", "%"].includes(parts[at])) {
      const op = parts[at++],
        b = primary();
      n = op === "*" ? n * b : op === "/" ? n / b : n % b;
    }
    return n;
  };
  const sum = () => {
    let n = product();
    while (["+", "-"].includes(parts[at])) {
      const op = parts[at++],
        b = product();
      n = op === "+" ? n + b : n - b;
    }
    return n;
  };
  const result = sum();
  if (at !== parts.length || !Number.isFinite(result))
    throw new Error("Resultado matemático no válido.");
  return result;
}
class HexVM {
  constructor() {
    this.globals = new Map();
    this.aliases = new Map();
    this.handlers = [];
    this.scripts = new Map();
  }
  install(scripts) {
    this.globals.clear();
    this.aliases.clear();
    this.handlers = [];
    this.scripts.clear();
    for (const script of scripts) {
      const tree = parse(script.source);
      this.scripts.set(script.id, script);
      for (const node of tree) {
        const alias = /^alias\s+([a-z][a-z0-9_.-]*)$/i.exec(node.header);
        if (alias) {
          if (!node.body) throw new Error("Alias sin bloque.");
          this.aliases.set(alias[1].toLowerCase(), {
            ...node,
            owner: script.id,
          });
          continue;
        }
        const event = /^on\s+(.+)$/i.exec(node.header);
        if (!event || !node.body)
          throw new Error(
            "Solo se admiten eventos y alias en el nivel superior.",
          );
        let header = event[1].replace(/:$/, "");
        let name, filter, target, regex;
        const m = /^([@!+&^=$]*(?:\*|\d+)?):([a-z]+):([^:]*):([^:]*):?$/i.exec(
          header,
        );
        if (m) {
          name = m[2];
          filter = m[3] || "*";
          target = m[4] || "*";
          regex = m[1].includes("$");
        } else if (/^SIGNAL:/i.test(header)) name = header;
        else {
          const i = header.indexOf(":");
          name = i < 0 ? header : header.slice(0, i);
          filter = i < 0 ? undefined : header.slice(i + 1);
        }
        this.handlers.push({
          ...node,
          owner: script.id,
          name: name.toUpperCase(),
          filter,
          target,
          regex,
        });
      }
    }
    return {
      aliases: [...this.aliases.keys()],
      scripts: scripts.map((s) => s.id),
    };
  }
  tick(ctx) {
    if (++ctx.budget.steps > 200000 || Date.now() > ctx.budget.until)
      throw new Error("El script superó su presupuesto de ejecución.");
  }
  variable(name, ctx) {
    return ctx.locals.has(name)
      ? ctx.locals.get(name)
      : (this.globals.get(name) ?? "");
  }
  value(raw, ctx, depth = 0) {
    this.tick(ctx);
    if (depth > 60) throw new Error("Expansión .hex demasiado profunda.");
    raw = String(raw).trim();
    const quoted = raw.startsWith('"') && raw.endsWith('"');
    if (quoted) raw = raw.slice(1, -1).replace(/\\"/g, '"');
    if (!quoted && /^%[\w.]+$/.test(raw)) return this.variable(raw, ctx);
    let result = "",
      i = 0;
    while (i < raw.length) {
      if (raw[i] === "%") {
        const m = /^%[\w.]+/.exec(raw.slice(i));
        if (m) {
          result += str(this.variable(m[0], ctx));
          i += m[0].length;
          continue;
        }
      }
      if (raw[i] === "$") {
        const m = /^\$([a-z_][\w.]*|\d+)(-)?/i.exec(raw.slice(i));
        if (m) {
          const start = i;
          i += m[0].length;
          let value;
          if (raw[i] === "(") {
            let end = i + 1,
              n = 1,
              q = false;
            for (; end < raw.length; end++) {
              if (raw[end] === '"' && raw[end - 1] !== "\\") q = !q;
              if (!q) {
                if (raw[end] === "(") n++;
                else if (raw[end] === ")" && !--n) break;
              }
            }
            if (n) throw new Error("Función .hex sin cerrar.");
            const args = splitTop(raw.slice(i + 1, end), ",").map((a) =>
              this.value(a, ctx, depth + 1),
            );
            value = this.call(m[1].toLowerCase(), args, ctx);
            i = end + 1;
          } else if (/^\d+$/.test(m[1])) {
            const n = Number(m[1]);
            value =
              n === 0
                ? ctx.args.length
                : m[2]
                  ? ctx.args.slice(n - 1).join(" ")
                  : ctx.args[n - 1] || "";
          } else {
            const key = m[1].toLowerCase(),
              fields = ctx.fields;
            if (key === "isprivate")
              value = String(
                !!(fields.buffer || fields.chan) &&
                  !["*", "*consultas*"].includes(
                    fields.buffer || fields.chan,
                  ) &&
                  !/^[#&!+]/.test(fields.buffer || fields.chan),
              );
            else if (key === "isme")
              value = String(
                fields.own === true ||
                  (!!fields.nick &&
                    !!fields.me &&
                    require("../irc").fold(fields.nick) ===
                      require("../irc").fold(fields.me)),
              );
            else value = fields[key] ?? "";
          }
          if (!quoted && start === 0 && i === raw.length) return bounded(value);
          result += str(value);
          continue;
        }
      }
      result += raw[i++];
      if (result.length > MAX_STRING)
        throw new Error("Texto de script demasiado grande.");
    }
    return bounded(result);
  }
  call(name, args, ctx) {
    this.tick(ctx);
    const s = (i) => str(args[i]),
      n = (i) => num(args[i]),
      list = (i) =>
        Array.isArray(args[i])
          ? args[i]
          : args[i] instanceof Map
            ? [...args[i].keys()]
            : [],
      numberList =
        args.length === 1 && Array.isArray(args[0])
          ? args[0].map(num)
          : args.map(num);
    const functions = {
      len: () =>
        Array.isArray(args[0])
          ? args[0].length
          : args[0] instanceof Map
            ? args[0].size
            : s(0).length,
      lower: () => s(0).toLowerCase(),
      upper: () => s(0).toUpperCase(),
      left: () => s(0).slice(0, Math.max(0, n(1))),
      right: () => (n(1) > 0 ? s(0).slice(-n(1)) : ""),
      substr: () => s(0).slice(n(1), args.length > 2 ? n(1) + n(2) : undefined),
      replace: () => s(0).split(s(1)).join(s(2)),
      trim: () => s(0).trim(),
      contains: () => (s(0).includes(s(1)) ? "true" : "false"),
      indexof: () => s(0).indexOf(s(1)),
      repeat: () => {
        if (n(1) < 0 || s(0).length * n(1) > MAX_STRING)
          throw new Error("Repetición demasiado grande.");
        return s(0).repeat(n(1));
      },
      pad: () =>
        s(0).padEnd(Math.min(MAX_STRING, Math.max(0, n(1))), s(2) || " "),
      padleft: () =>
        s(0).padStart(Math.min(MAX_STRING, Math.max(0, n(1))), s(2) || " "),
      capitalize: () => s(0).charAt(0).toUpperCase() + s(0).slice(1),
      title: () => s(0).replace(/\b\w/g, (c) => c.toUpperCase()),
      calc: () => arithmetic(s(0)),
      mod: () => n(0) % n(1),
      idiv: () => Math.floor(n(0) / n(1)),
      int: () => Math.floor(n(0)),
      ceil: () => Math.ceil(n(0)),
      abs: () => Math.abs(n(0)),
      pow: () => Math.pow(n(0), n(1)),
      round: () => Number(n(0).toFixed(Math.max(0, Math.min(12, n(1))))),
      clamp: () => Math.max(n(1), Math.min(n(2), n(0))),
      min: () => Math.min(...numberList),
      max: () => Math.max(...numberList),
      rand: () => {
        const lo = args.length > 1 ? Math.ceil(n(0)) : 0,
          hi = args.length > 1 ? Math.floor(n(1)) : Math.floor(n(0)) - 1;
        if (hi < lo || hi - lo > 0x100000000)
          throw new Error("Rango aleatorio no válido.");
        return crypto.randomInt(lo, hi + 1);
      },
      list: () => [...args],
      map: () => {
        const m = new Map();
        for (let i = 0; i < args.length; i += 2) m.set(s(i), args[i + 1] ?? "");
        return m;
      },
      get: () =>
        args[0] instanceof Map
          ? (args[0].get(s(1)) ?? "")
          : Array.isArray(args[0])
            ? (args[0][n(1)] ?? "")
            : "",
      has: () =>
        args[0] instanceof Map
          ? String(args[0].has(s(1)))
          : Array.isArray(args[0])
            ? String(args[0].some((v) => str(v) === s(1)))
            : "false",
      keys: () => (args[0] instanceof Map ? [...args[0].keys()] : []),
      values: () => (args[0] instanceof Map ? [...args[0].values()] : []),
      sort: () =>
        [...list(0)].sort((a, b) =>
          str(a).localeCompare(str(b), undefined, { numeric: true }),
        ),
      reverse: () => [...list(0)].reverse(),
      join: () =>
        list(0)
          .map(str)
          .join(args.length > 1 ? s(1) : " "),
      split: () => s(0).split(args.length > 1 ? s(1) : " "),
      slice: () => list(0).slice(n(1), n(2)),
      concat: () => args.flatMap((v) => (Array.isArray(v) ? v : [v])),
      find: () => list(0).findIndex((v) => str(v) === s(1)),
      count: () => list(0).filter((v) => str(v) === s(1)).length,
      sum: () => list(0).reduce((sum, v) => sum + num(v), 0),
      range: () => {
        if (Math.abs(n(1) - n(0)) > MAX_ITEMS)
          throw new Error("Rango demasiado grande.");
        return Array.from(
          { length: Math.max(0, n(1) - n(0) + 1) },
          (_, i) => n(0) + i,
        );
      },
      pick: () => {
        const a = list(0);
        return a.length ? a[crypto.randomInt(a.length)] : "";
      },
      shuffle: () => {
        const a = [...list(0)];
        for (let i = a.length - 1; i > 0; i--) {
          const j = crypto.randomInt(i + 1);
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      },
      tojson: () =>
        JSON.stringify(args[0], (_, v) =>
          v instanceof Map
            ? Object.fromEntries(v)
            : typeof v === "string" &&
                v.trim() !== "" &&
                Number.isFinite(Number(v))
              ? Number(v)
              : v,
        ),
      setting: () => ctx.fields.settings?.[s(0)] ?? "",
      state: () => this.scripts.get(ctx.owner)?.state?.[s(0)] ?? "",
      urlencode: () => encodeURIComponent(s(0)),
      json: () => {
        try {
          let v = JSON.parse(s(0));
          for (const part of s(1).split(".").filter(Boolean)) {
            if (v === null || typeof v !== "object" || !Object.hasOwn(v, part))
              return "";
            v = v[part];
          }
          return this.fromJson(v);
        } catch {
          return "";
        }
      },
      re_match: () =>
        this.regex(s(1), s(0), (m) => (m ? "true" : "false"), "false"),
      re_find: () => this.regex(s(1), s(0), (m) => m?.[0] || "", ""),
      re_group: () => this.regex(s(1), s(0), (m) => m?.[n(2)] || "", ""),
      re_replace: () => {
        try {
          return s(0)
            .slice(0, 20000)
            .replace(
              new RegExp(
                s(1).replace(/\\p\{Is([A-Za-z]+)\}/g, "\\p{Script=$1}"),
                "gu",
              ),
              () => s(2),
            );
        } catch {
          return s(0);
        }
      },
    };
    if (Object.hasOwn(functions, name)) {
      const value = functions[name]();
      if (typeof value === "number" && !Number.isFinite(value)) return "0";
      return bounded(value);
    }
    if (name.startsWith("age.")) {
      const item = ctx.fields.crypto?.[s(0) || ctx.fields.chan] || {};
      return name === "age.ready"
        ? String(item.ready === true)
        : name === "age.owner"
          ? item.owner || ""
          : name === "age.members"
            ? item.members || ""
            : name === "age.me"
              ? ctx.fields.cryptoIdentity || ""
              : "";
    }
    if (this.aliases.has(name)) {
      const child = {
        ...ctx,
        args: args.map(str),
        locals: new Map(),
        depth: ctx.depth + 1,
      };
      if (child.depth > 30) throw new Error("Alias recursivo.");
      const alias = this.aliases.get(name);
      child.owner = alias.owner;
      child.callers = new Set([...(ctx.callers || []), alias.owner]);
      const flow = this.run(alias.body, child);
      return flow?.value ?? "";
    }
    ctx.actions.push({
      type: "error",
      script: ctx.owner,
      callers: [...(ctx.callers || [ctx.owner])],
      text: "Función .hex desconocida: $" + name,
    });
    return "";
  }
  regex(pattern, text, convert, fallback) {
    try {
      let flags = "u";
      pattern = pattern.replace(/\\p\{Is([A-Za-z]+)\}/g, "\\p{Script=$1}");
      if (pattern.startsWith("(?i)")) {
        flags = "iu";
        pattern = pattern.slice(4);
      }
      return convert(new RegExp(pattern, flags).exec(text.slice(0, 20000)));
    } catch {
      return fallback;
    }
  }
  fromJson(v) {
    return Array.isArray(v)
      ? v.map((x) => this.fromJson(x))
      : v && typeof v === "object"
        ? new Map(Object.entries(v).map(([k, v]) => [k, this.fromJson(v)]))
        : v === null
          ? ""
          : String(v);
  }
  condition(raw, ctx) {
    this.tick(ctx);
    raw = raw.trim();
    const groups = splitTop(raw, "||");
    if (groups.length > 1) return groups.some((s) => this.condition(s, ctx));
    const and = splitTop(raw, "&&");
    if (and.length > 1) return and.every((s) => this.condition(s, ctx));
    if (raw.startsWith("!") && !raw.startsWith("!="))
      return !this.condition(raw.slice(1), ctx);
    if (raw[0] === "(") {
      let depth = 0,
        end = -1;
      for (let i = 0; i < raw.length; i++) {
        if (raw[i] === "(") depth++;
        else if (raw[i] === ")" && !--depth) {
          end = i;
          break;
        }
      }
      if (end === raw.length - 1) return this.condition(raw.slice(1, -1), ctx);
    }
    const m =
      /^([\s\S]*?)\s*(==|!=|>=|<=|>|<|\sisin\s|\siswm\s)\s*([\s\S]*)$/.exec(
        raw,
      );
    if (!m) return truth(this.value(raw, ctx));
    const left = this.value(m[1], ctx),
      right = this.value(m[3], ctx),
      op = m[2].trim();
    if (op === "isin") return str(right).includes(str(left));
    if (op === "iswm") return glob(str(right), str(left));
    const a = str(left),
      b = str(right),
      numeric =
        a.trim() !== "" &&
        b.trim() !== "" &&
        Number.isFinite(Number(a)) &&
        Number.isFinite(Number(b)),
      x = numeric ? Number(a) : a,
      y = numeric ? Number(b) : b;
    return op === "=="
      ? x === y
      : op === "!="
        ? x !== y
        : op === ">"
          ? x > y
          : op === "<"
            ? x < y
            : op === ">="
              ? x >= y
              : x <= y;
  }
  run(nodes, ctx) {
    for (let i = 0; i < nodes.length; i++) {
      this.tick(ctx);
      if (ctx.actions.length > 1000)
        throw new Error("Demasiadas acciones de script.");
      const node = nodes[i],
        header = node.header,
        word = header.split(/\s/)[0].toLowerCase(),
        raw = header.slice(word.length).trim();
      if (word === "if") {
        let chosen = false,
          j = i;
        while (j < nodes.length) {
          const n = nodes[j],
            w = n.header.split(/\s/)[0].toLowerCase();
          if (j !== i && !["elseif", "else"].includes(w)) break;
          const expression = n.header.slice(w.length).trim();
          if (!chosen && (w === "else" || this.condition(expression, ctx))) {
            chosen = true;
            const result = this.run(n.body || [], ctx);
            if (result) return result;
          }
          j++;
        }
        i = j - 1;
        continue;
      }
      if (word === "while") {
        while (this.condition(raw, ctx)) {
          this.tick(ctx);
          const result = this.run(node.body || [], ctx);
          if (result?.type === "break") break;
          if (result && result.type !== "continue") return result;
        }
        continue;
      }
      if (word === "foreach") {
        const match = /^(%[\w.]+)\s+([\s\S]+)$/.exec(raw);
        if (!match) throw new Error("foreach no válido.");
        const value = this.value(match[2], ctx),
          items =
            value instanceof Map
              ? [...value.keys()]
              : Array.isArray(value)
                ? [...value]
                : str(value).split(" ").filter(Boolean);
        if (items.length > MAX_ITEMS)
          throw new Error("Colección demasiado grande.");
        for (const item of items) {
          this.tick(ctx);
          ctx.locals.set(match[1], item);
          const result = this.run(node.body || [], ctx);
          if (result?.type === "break") break;
          if (result && result.type !== "continue") return result;
        }
        continue;
      }
      if (word === "view") {
        ctx.actions.push({
          type: "view",
          script: ctx.owner,
          callers: [...(ctx.callers || [ctx.owner])],
          tree: this.view(node.body || [], ctx),
        });
        continue;
      }
      if (["return", "halt", "break", "continue"].includes(word)) {
        if (word === "halt") {
          if (
            ![...(ctx.callers || [ctx.owner])].every((id) =>
              this.scripts.get(id)?.permissions?.includes("intercept"),
            )
          )
            throw new Error("El script no tiene permiso: intercept");
          ctx.halted = true;
        }
        return { type: word, value: raw ? this.value(raw, ctx) : "" };
      }
      if (
        word === "set" ||
        word === "unset" ||
        word === "inc" ||
        word === "dec" ||
        word === "push" ||
        word === "setat"
      ) {
        const parts = tokens(raw);
        let local = false;
        if (parts[0] === "-l") {
          parts.shift();
          local = true;
        }
        const variable = parts.shift();
        if (!/^%[\w.]+$/.test(variable || ""))
          throw new Error("Variable no válida.");
        const store =
          local || ctx.locals.has(variable) ? ctx.locals : this.globals;
        if (word === "unset") {
          store.delete(variable);
          continue;
        }
        const value = parts.join(" ");
        if (word === "set") store.set(variable, this.value(value, ctx));
        else if (word === "inc" || word === "dec")
          store.set(
            variable,
            num(this.variable(variable, ctx)) + (word === "inc" ? 1 : -1),
          );
        else if (word === "push") {
          const list = this.variable(variable, ctx);
          if (!Array.isArray(list)) throw new Error("push requiere una lista.");
          if (list.length >= MAX_ITEMS) throw new Error("Lista llena.");
          list.push(this.value(value, ctx));
        } else {
          const collection = this.variable(variable, ctx),
            key = str(this.value(parts.shift() || "", ctx)),
            v = this.value(parts.join(" "), ctx);
          if (collection instanceof Map) {
            if (collection.size >= MAX_ITEMS && !collection.has(key))
              throw new Error("Mapa lleno.");
            collection.set(key, v);
          } else if (
            Array.isArray(collection) &&
            /^\d+$/.test(key) &&
            Number(key) < MAX_ITEMS
          )
            collection[Number(key)] = v;
          else throw new Error("setat requiere una colección válida.");
        }
        continue;
      }
      if (word === "rewrite") {
        if (
          ![...(ctx.callers || [ctx.owner])].every((id) =>
            this.scripts.get(id)?.permissions?.includes("intercept"),
          )
        )
          throw new Error("El script no tiene permiso: intercept");
        ctx.fields.text = str(this.value(raw, ctx));
        continue;
      }
      if (this.aliases.has(word)) {
        const alias = this.aliases.get(word),
          child = {
            ...ctx,
            owner: alias.owner,
            callers: new Set([...(ctx.callers || []), alias.owner]),
            args: tokens(raw).map((t) => str(this.value(t, ctx))),
            locals: new Map(),
            depth: ctx.depth + 1,
          };
        if (child.depth > 30) throw new Error("Alias recursivo.");
        const result = this.run(alias.body, child);
        if (result?.type === "halt") {
          ctx.halted = true;
          return result;
        }
        continue;
      }
      const args = tokens(raw).map((t) => str(this.value(t, ctx)));
      if (word === "signal") {
        const name = args.shift() || "";
        this.dispatchInto("SIGNAL:" + name.toUpperCase(), {
          ...ctx,
          args,
          signalCallers: new Set(ctx.callers || []),
          depth: ctx.depth + 1,
        });
        continue;
      }
      if (word === "timer") {
        ctx.actions.push({
          type: "timer",
          script: ctx.owner,
          callers: [...(ctx.callers || [ctx.owner])],
          ms: Math.max(20, Math.min(86400000, Number(args[0]) || 20)),
          signal: args[1],
          args: args.slice(2),
          fields: { ...ctx.fields },
        });
        continue;
      }
      if (word === "http.get" || word === "http.post") {
        let contentType,
          headers = {},
          body;
        let i = 0;
        while (args[i]?.startsWith("-")) {
          const flag = args[i++],
            v = args[i++];
          if (flag === "-t") contentType = v;
          else if (flag === "-h") {
            const split = v.indexOf(":");
            if (split < 1) throw new Error("Cabecera HTTP no válida.");
            headers[v.slice(0, split)] = v.slice(split + 1).trim();
          } else if (flag === "-b") body = v;
          else throw new Error("Opción HTTP desconocida.");
        }
        const url = args[i++];
        if (word === "http.post" && body === undefined) body = args[i++];
        const signal = args[i++];
        if (!signal) throw new Error("HTTP requiere una señal de respuesta.");
        if (contentType) headers["Content-Type"] = contentType;
        ctx.actions.push({
          type: "http",
          script: ctx.owner,
          callers: [...(ctx.callers || [ctx.owner])],
          method: word === "http.get" ? "GET" : "POST",
          url,
          body,
          headers,
          signal,
          args: args.slice(i),
          fields: { ...ctx.fields },
        });
        continue;
      }
      ctx.actions.push({
        type: word,
        script: ctx.owner,
        callers: [...(ctx.callers || [ctx.owner])],
        args,
        text: str(this.value(raw, ctx)),
        fields: { ...ctx.fields },
      });
    }
  }
  view(nodes, ctx) {
    const output = [];
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      this.tick(ctx);
      const parts = tokens(node.header),
        type = parts.shift().toLowerCase();
      if (type === "if") {
        let chosen = false,
          j = i;
        for (; j < nodes.length; j++) {
          const branch = nodes[j],
            word = branch.header.split(/\s/)[0].toLowerCase();
          if (j !== i && !["elseif", "else"].includes(word)) break;
          if (
            !chosen &&
            (word === "else" ||
              this.condition(branch.header.slice(word.length).trim(), ctx))
          ) {
            chosen = true;
            output.push(...this.view(branch.body || [], ctx));
          }
        }
        i = j - 1;
        continue;
      }
      if (type === "foreach") {
        const variable = parts.shift(),
          value = this.value(parts.join(" "), ctx),
          items =
            value instanceof Map
              ? [...value.keys()]
              : Array.isArray(value)
                ? value
                : [];
        for (const item of items) {
          ctx.locals.set(variable, item);
          output.push(...this.view(node.body || [], ctx));
        }
        continue;
      }
      if (
        ![
          "column",
          "row",
          "stack",
          "ring",
          "surface",
          "text",
          "button",
          "card",
          "image",
          "spacer",
        ].includes(type)
      )
        throw new Error("Elemento de vista .hex no soportado: " + type);
      if ((ctx.viewCount = (ctx.viewCount || 0) + 1) > 2000)
        throw new Error("Vista .hex demasiado grande.");
      const values = parts.map((p) => str(this.value(p, ctx))),
        entry = {
          type,
          text: ["text", "button", "card", "image"].includes(type)
            ? values.shift() || ""
            : "",
          props: {},
          children: [],
        };
      if (type === "button") {
        entry.action = values.shift() || "";
        entry.args = [];
        while (
          values.length &&
          ![
            "width",
            "height",
            "pad",
            "gap",
            "color",
            "bg",
            "bold",
            "fill",
            "radius",
            "textsize",
            "size",
            "weight",
            "align",
            "circle",
            "ellipse",
            "border",
          ].includes(values[0])
        )
          entry.args.push(values.shift());
      }
      for (let i = 0; i < values.length; i++) {
        const key = values[i];
        if (
          [
            "bold",
            "fill",
            "wrap",
            "circle",
            "ellipse",
            "red",
            "back",
            "crop",
            "fit",
            "stretch",
          ].includes(key)
        )
          entry.props[key] = true;
        else if (
          [
            "width",
            "height",
            "size",
            "radius",
            "pad",
            "gap",
            "weight",
            "textsize",
            "offsetx",
            "offsety",
            "color",
            "bg",
            "align",
            "border",
          ].includes(key)
        )
          entry.props[key] = values[++i] || "";
      }
      if (node.body) entry.children = this.view(node.body, ctx);
      output.push(entry);
      if (output.length > 2000) throw new Error("Vista .hex demasiado grande.");
    }
    return output;
  }
  dispatchInto(name, ctx) {
    if (ctx.depth > 30) throw new Error("Señales recursivas.");
    for (const handler of this.handlers) {
      if (
        handler.name !== name.toUpperCase() ||
        (ctx.fields.__onlyScript && ctx.fields.__onlyScript !== handler.owner)
      )
        continue;
      const script = this.scripts.get(handler.owner);
      if (
        name !== "LOAD" &&
        !name.startsWith("SIGNAL:") &&
        !script.permissions?.includes(name === "INPUT" ? "intercept" : "read")
      )
        continue;
      if (handler.filter) {
        let matches = false;
        if (handler.regex) {
          matches = this.regex(
            handler.filter,
            str(ctx.fields.text),
            (m) => !!m,
            false,
          );
        } else matches = glob(handler.filter, str(ctx.fields.text));
        if (!matches) continue;
      }
      if (handler.target && handler.target !== "*") {
        const target = str(ctx.fields.buffer || ctx.fields.chan);
        if (
          (handler.target === "#" && !/^[#&+!]/.test(target)) ||
          (handler.target === "?" && /^[#&+!]/.test(target)) ||
          (!["#", "?"].includes(handler.target) &&
            !handler.target.split(",").some((p) => glob(p, target)))
        )
          continue;
      }
      ctx.owner = handler.owner;
      ctx.callers = new Set([...(ctx.signalCallers || []), handler.owner]);
      ctx.locals = new Map();
      try {
        this.run(handler.body, ctx);
      } catch (e) {
        ctx.actions.push({
          type: "error",
          script: handler.owner,
          text: e.message,
        });
        if (/presupuesto/.test(e.message))
          ctx.actions.push({ type: "disable", script: handler.owner });
      }
      if (ctx.halted) break;
    }
  }
  disable(id) {
    this.handlers = this.handlers.filter((h) => h.owner !== id);
    for (const [name, a] of this.aliases)
      if (a.owner === id) this.aliases.delete(name);
    this.scripts.delete(id);
  }
  dispatch(name, fields = {}, args = []) {
    const ctx = {
      fields: { ...fields },
      args,
      locals: new Map(),
      actions: [],
      owner: "",
      depth: 0,
      signalCallers: fields.__scriptCallers || [],
      budget: { steps: 0, until: Date.now() + 150 },
      halted: false,
    };
    this.dispatchInto(name, ctx);
    return {
      text: ctx.fields.text ?? "",
      halted: ctx.halted,
      actions: ctx.actions,
    };
  }
  alias(name, fields = {}, args = []) {
    const alias = this.aliases.get(name.toLowerCase());
    if (!alias) return { handled: false, actions: [] };
    const ctx = {
      fields: { ...fields },
      args,
      locals: new Map(),
      actions: [],
      owner: alias.owner,
      callers: new Set([alias.owner, ...(fields.__scriptCallers || [])]),
      depth: 0,
      budget: { steps: 0, until: Date.now() + 150 },
      halted: false,
    };
    this.run(alias.body, ctx);
    return { handled: true, actions: ctx.actions };
  }
}
module.exports = { HexVM, parse, str, glob, arithmetic };
