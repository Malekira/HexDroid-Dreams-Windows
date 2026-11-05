"use strict";
const crypto = require("node:crypto"),
  fs = require("node:fs"),
  path = require("node:path");
const { imageMime } = require("./web");
class ScriptMedia {
  constructor({ pick, confirm, web, signal, allowed }) {
    Object.assign(this, { pick, confirm, web, signal, allowed });
    this.tokens = new Map();
    this.denied = new Map();
    this.picking = false;
  }
  clear() {
    this.tokens.clear();
  }
  async run(action, fields) {
    const args = [...action.args],
      owner = fields.script;
    let mime = "image/*",
      field = "file",
      raw = false;
    const headers = {},
      params = [];
    while (args[0]?.startsWith("-")) {
      const option = args.shift();
      if (option === "-r") {
        raw = true;
        continue;
      }
      const value = args.shift();
      if (value === undefined) throw new Error("Opción multimedia sin valor.");
      if (option === "-m") mime = value;
      else if (option === "-f") field = value;
      else if (option === "-h") {
        const i = value.indexOf(":");
        if (i < 1) throw new Error("Cabecera inválida.");
        headers[value.slice(0, i)] = value.slice(i + 1).trim();
      } else if (option === "-p") {
        const i = value.indexOf("=");
        if (i < 1) throw new Error("Campo inválido.");
        params.push([value.slice(0, i), value.slice(i + 1)]);
      } else throw new Error("Opción multimedia desconocida.");
    }
    if (action.type === "media.pick") {
      const name = args.shift();
      if (!name) throw new Error("Falta señal de respuesta.");
      const context = args;
      let result = {
        mediaok: "false",
        mediatoken: "",
        medianame: "",
        mediamime: "",
        mediasize: "-1",
      };
      if (this.picking || Date.now() < (this.denied.get(owner) || 0)) {
        this.signal(owner, name, fields, result, context);
        return;
      }
      this.picking = true;
      try {
        if (
          !(await this.confirm(
            "El script solicita un archivo",
            `${fields.buffer || ""} · ${owner}\nSolo tendrá acceso al archivo que selecciones.`,
          ))
        ) {
          this.denied.set(owner, Date.now() + 60000);
          return;
        }
        const file = await this.pick({
          title: "Archivo para script",
          ...(mime.startsWith("image/")
            ? {
                filters: [
                  {
                    name: "Imagen",
                    extensions: [
                      "png",
                      "jpg",
                      "jpeg",
                      "gif",
                      "webp",
                      "bmp",
                      "avif",
                    ],
                  },
                ],
              }
            : {}),
        });
        if (!file) return;
        const stat = fs.statSync(file);
        if (!stat.isFile() || stat.size > 67108864)
          throw new Error("El archivo debe ser regular y de hasta 64 MB.");
        const fd = fs.openSync(file, "r"),
          head = Buffer.alloc(32);
        try {
          fs.readSync(fd, head);
        } finally {
          fs.closeSync(fd);
        }
        const detected = imageMime(head) || "application/octet-stream";
        if (mime.startsWith("image/") && !detected.startsWith("image/"))
          throw new Error("El archivo no es una imagen compatible.");
        const token = crypto.randomUUID();
        if (this.tokens.size >= 100)
          this.tokens.delete(this.tokens.keys().next().value);
        this.tokens.set(token, {
          file,
          owner,
          size: stat.size,
          mtime: stat.mtimeMs,
          mime: detected,
          expires: Date.now() + 600000,
        });
        result = {
          mediaok: "true",
          mediatoken: token,
          medianame: path.basename(file),
          mediamime: detected,
          mediasize: String(stat.size),
        };
      } catch (e) {
        result.mediaerror = e.message;
      } finally {
        this.picking = false;
        this.signal(owner, name, fields, result, context);
      }
      return;
    }
    const [url, token, name, ...context] = args;
    if (!name) throw new Error("Falta señal de respuesta.");
    let result;
    try {
      const chosen = this.tokens.get(token);
      if (!chosen || chosen.owner !== owner || chosen.expires < Date.now())
        throw new Error("Token de archivo inválido o caducado.");
      const stat = fs.statSync(chosen.file);
      if (stat.size !== chosen.size || stat.mtimeMs !== chosen.mtime)
        throw new Error("El archivo seleccionado cambió. Vuelve a elegirlo.");
      const permissions = this.allowed(owner, "http", action.callers);
      const domains = permissions.domains.filter((domain) =>
        (action.callers || []).every((id) =>
          this.allowed(id, "http").domains.includes(domain),
        ),
      );
      const endpoint = new URL(url);
      if (!domains.includes(endpoint.hostname))
        throw new Error("El dominio de subida no está autorizado.");
      if (
        !(await this.confirm(
          "¿Subir " + path.basename(chosen.file) + "?",
          `Destino: ${endpoint.origin}\nEl archivo puede contener metadatos personales.`,
        ))
      )
        throw new Error("Subida cancelada.");
      let body = fs.readFileSync(chosen.file);
      if (raw) headers["Content-Type"] = chosen.mime;
      else {
        const boundary = "HexDroid" + crypto.randomBytes(16).toString("hex");
        const clean = (s) =>
            String(s)
              .replace(/["\r\n\0]/g, "_")
              .slice(0, 200),
          chunks = [];
        for (const [key, value] of params)
          chunks.push(
            Buffer.from(
              `--${boundary}\r\nContent-Disposition: form-data; name="${clean(key)}"\r\n\r\n${value}\r\n`,
            ),
          );
        chunks.push(
          Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="${clean(field)}"; filename="${clean(path.basename(chosen.file))}"\r\nContent-Type: ${chosen.mime}\r\n\r\n`,
          ),
          body,
          Buffer.from(`\r\n--${boundary}--\r\n`),
        );
        body = Buffer.concat(chunks);
        headers["Content-Type"] = "multipart/form-data; boundary=" + boundary;
      }
      const response = await this.web.request(url, {
        domains,
        method: "POST",
        headers,
        body,
        contentLength: body.length,
        redirects: 0,
      });
      result = {
        httpok: String(response.status >= 200 && response.status < 300),
        httpstatus: String(response.status),
        httpbody: response.body.toString("utf8"),
        httplocation: response.headers.location,
        httperror: "",
      };
    } catch (e) {
      result = {
        httpok: "false",
        httpstatus: "0",
        httpbody: "",
        httplocation: "",
        httperror: e.message,
      };
    }
    this.signal(owner, name, fields, result, context);
  }
}
module.exports = { ScriptMedia };
