"use strict";
const AVATAR_ORIGIN = "https://chat-avatars.chateagratis.net";
const OFFICIAL_HOSTS = new Set([
  "chat-avatars.chateagratis.net",
  "images.chateagratis.net",
]);
function avatarUrl(template, nick) {
  if (
    typeof template !== "string" ||
    !template ||
    template.length > 2048 ||
    !/(?:\{nick\}|\{nickLower\}|%nick%|%s)/i.test(template)
  )
    throw new Error("La URL de fotos debe incluir {nick} o {nickLower}.");
  if (
    typeof nick !== "string" ||
    !nick ||
    nick.length > 200 ||
    /[\s!@\0\r\n]/.test(nick)
  )
    throw new Error("Nick de foto no válido.");
  const value = template
    .replace(/\{nickLower\}/gi, encodeURIComponent(nick.toLowerCase()))
    .replace(/\{nick\}|%nick%|%s/gi, encodeURIComponent(nick));
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("Usa HTTPS sin credenciales para las fotos.");
  return url.toString();
}
function normalizePhoto(value, legacy = false) {
  if (
    typeof value !== "string" ||
    !value ||
    value === "#" ||
    value.length > 2048 ||
    /[\s\x00-\x1f\\]/.test(value)
  )
    return null;
  try {
    let url;
    if (legacy) {
      if (value.startsWith("//")) return null;
      if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
        url = new URL(value);
        if (!OFFICIAL_HOSTS.has(url.hostname)) return null;
      } else {
        if (!value.split(/[?#]/)[0].replace(/^\/+/, "")) return null;
        url = new URL(
          value.startsWith("/") ? value : "/" + value,
          AVATAR_ORIGIN,
        );
      }
    } else url = new URL(value);
    if (OFFICIAL_HOSTS.has(url.hostname)) {
      url.protocol = "https:";
      url.hostname = "chat-avatars.chateagratis.net";
      url.port = "";
    }
    if (url.protocol !== "https:" || url.username || url.password) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}
function legacyPhoto(realName) {
  if (
    typeof realName !== "string" ||
    realName.length > 4096 ||
    !realName ||
    !/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)?$/.test(
      realName,
    )
  )
    return null;
  const parts = Buffer.from(realName, "base64").toString("utf8").split("|");
  return parts.length >= 4 ? normalizePhoto(parts[3], true) : null;
}
function resolveAvatar({
  state = {},
  nick,
  template,
  explicit,
  now = Date.now(),
  refresh = false,
  automatic = false,
}) {
  let source, url;
  if (explicit) {
    source = "explicit";
    url = normalizePhoto(
      /\{nick\}|\{nickLower\}|%nick%|%s/i.test(explicit)
        ? avatarUrl(explicit, nick)
        : explicit,
    );
    if (!url) throw new Error("La foto requiere una URL HTTPS válida.");
  } else if (Object.hasOwn(state.metadata || {}, "avatar")) {
    source = "metadata";
    url = normalizePhoto(state.metadata.avatar);
  } else if (Object.hasOwn(state.metadata || {}, "avatar-url")) {
    source = "metadata";
    url = normalizePhoto(state.metadata["avatar-url"]);
  } else if (state.legacyPhoto) {
    source = "legacy";
    url = normalizePhoto(state.legacyPhoto, true);
  } else {
    source = "template";
    url = template
      ? normalizePhoto(
          /\{nick\}|\{nickLower\}|%nick%|%s/i.test(template)
            ? avatarUrl(template, nick)
            : template,
        )
      : null;
  }
  if (!url) return { url: null, source };
  const u = new URL(url),
    allowed = new Set(OFFICIAL_HOSTS);
  try {
    allowed.add(new URL(avatarUrl(template, nick)).hostname);
  } catch {
    try {
      allowed.add(new URL(template).hostname);
    } catch {}
  }
  if (automatic && !allowed.has(u.hostname))
    return { url: null, source, blocked: true };
  if (
    OFFICIAL_HOSTS.has(u.hostname) &&
    !u.pathname.endsWith("/default.png") &&
    (refresh || !u.searchParams.has("v"))
  )
    u.searchParams.set(
      "v",
      String(refresh ? now : Math.floor(now / 60000)) +
        (state.avatarVersion ? "-" + state.avatarVersion : ""),
    );
  return { url: u.toString(), source };
}
module.exports = { avatarUrl, legacyPhoto, normalizePhoto, resolveAvatar };
