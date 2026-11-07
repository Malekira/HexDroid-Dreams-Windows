(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DreamsThemes = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const keys = ["nickPalette","showMessageAvatars","highlightMentions","mentionHighlightColor",
    "theme",
    "customColors",
    "roomAppearance",
    "fontFamily",
    "fontSize",
    "lineHeight",
    "messageSpacing",
    "ownNickColor",
    "coloredNicks",
    "timestamps",
    "compact",
    "composerBold",
    "composerItalic",
    "composerUnderline",
    "composerColor",
  ];
  const violet = {
    theme: "violet",
    customColors: {
      bg: "#0b1026",
      sidebar: "#101530",
      surface: "#191b3a",
      raised: "#30214f",
      border: "#46416f",
      text: "#eeeafb",
      muted: "#b1b6d4",
      accent: "#bca0ff",
    },
    roomAppearance: {
      background: "#0b1026",
      inputBackground: "#141932",
      text: "#eeeafb",
      style: "normal",
    },
    ownNickColor: "#bf9cff",
  };
  const purpleLight={...structuredClone(violet),theme:'purple-light',nickPalette:'strong',roomAppearance:{background:'#ffffff',inputBackground:'#f7f4ff',text:'#211630',style:'normal'},ownNickColor:'#6c209e'};
  function snapshot(settings) {
    if (!settings || typeof settings !== "object") settings = {};
    return Object.fromEntries(
      keys
        .filter((k) => settings[k] !== undefined)
        .map((k) => [k, structuredClone(settings[k])]),
    );
  }
  return { keys, violet, purpleLight, snapshot };
});
