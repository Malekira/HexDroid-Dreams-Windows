"use strict";
const { sanitizeData } = require("../storage");
const { keys: visual } = require("../themes");
const groups = {
  appearance: [
    ...visual.filter(
      (k) =>
        ![
          "showMessageAvatars",
          "highlightMentions",
          "mentionHighlightColor",
        ].includes(k),
    ),
    "savedThemes",
    "nickPalette",
  ],
  notifications: [
    "autoAwayEnabled","autoAwayMinutes","autoAwayMessage","autoAwayReturn",
    "notifications",
    "notificationPreview",
    "notificationSound",
    "flashOnMention",
    "notifyPresence",
    "notifyPresenceOffline",
    "notifyPresenceSound",
    "notifyNickChanges",
    "notifyWhileFocused",
    "notifyInCurrentRoom",
    "mentionSound",
    "privateSound",
    "channelSound",
    "highlightActivity",
    "highlightEvents",
    "highlightWords",
    "highlightMentions",
    "mentionHighlightColor",
  ],
  multimedia: [
    "mediaEnabled",
    "showAvatars",
    "showMessageAvatars",
    "autoAvatars",
    "avatarUrlTemplate",
    "mediaPreviewUrl",
  ],
  history: [
    "textLogsEnabled",
    "textLogRooms",
    "textLogPrivates",
    "textLogStatus",
    "textLogQueries",
    "textLogDays",
    "textLogMaxMB",
    "historyEnabled",
    "historyDays",
    "queryHistoryEnabled",
    "protocolLogging",
  ],
};
function keys(section, settings) {
  if (section === "preferences") {
    const known = new Set(Object.values(groups).flat());
    return Object.keys(settings).filter((k) => !known.has(k));
  }
  return groups[section] || [];
}
function selection(value) {
  if (value === undefined)
    return [
      "networks",
      "appearance",
      "notifications",
      "multimedia",
      "history",
      "preferences",
    ];
  if (
    !Array.isArray(value) ||
    !value.length ||
    value.some(
      (s) => !["networks", ...Object.keys(groups), "preferences"].includes(s),
    )
  )
    throw Error("Selecciona al menos un apartado válido.");
  return [...new Set(value)];
}
function exportConfig(config, sections) {
  sections = selection(sections);
  const settings = {};
  for (const section of sections)
    for (const key of keys(section, config.settings))
      if (config.settings[key] !== undefined)
        settings[key] = config.settings[key];
  const profiles = sections.includes("networks") ? config.profiles : [];
  return {
    config: sanitizeData({
      ...config,
      profiles,
      settings,
      workspace: sections.includes("networks") ? config.workspace : null,
    }),
    sections,
  };
}
function importConfig(current, incoming, sections, available) {
  sections = selection(sections).filter(
    (s) => !available || available.includes(s),
  );
  if (!sections.length)
    throw Error("El respaldo no contiene los apartados seleccionados.");
  const settings = { ...current.settings };
  for (const section of sections)
    for (const key of keys(section, incoming.settings))
      if (incoming.settings[key] !== undefined)
        settings[key] = incoming.settings[key];
  const profiles = sections.includes("networks")
    ? [
        ...current.profiles.filter(
          (p) => !incoming.profiles.some((n) => n.id === p.id),
        ),
        ...incoming.profiles,
      ]
    : current.profiles;
  return sanitizeData({
    ...current,
    settings,
    profiles,
    workspace: sections.includes("networks")
      ? incoming.workspace
      : current.workspace,
  });
}
module.exports = { exportConfig, importConfig, selection };
