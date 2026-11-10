(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DreamsWhoisTime = api;
})(globalThis, () => {
  "use strict";
  function duration(seconds) {
    const days = Math.floor(seconds / 86400),
      hours = Math.floor((seconds % 86400) / 3600),
      minutes = Math.floor((seconds % 3600) / 60);
    return (
      (days ? days + " d " : "") +
      hours +
      " h " +
      minutes +
      " min " +
      (seconds % 60) +
      " s"
    );
  }
  function parse317(params, now = Date.now()) {
    const number = (value) =>
      typeof value === "string" &&
      /^\d+$/.test(value) &&
      Number.isSafeInteger(Number(value))
        ? Number(value)
        : null;
    const idle = number(params[0]),
      signon = number(params[1]);
    const result = {};
    if (idle !== null) result.idle = duration(idle);
    if (
      signon !== null &&
      signon > 0 &&
      signon <= Math.floor(now / 1000) &&
      signon * 1000 <= 8640000000000000
    ) {
      result.connectedAt = new Date(signon * 1000).toLocaleString("es-UY");
      result.connectedFor = duration(Math.floor(now / 1000) - signon);
    }
    return result;
  }
  return { parse317, duration };
});
