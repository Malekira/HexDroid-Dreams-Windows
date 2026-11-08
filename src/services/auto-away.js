"use strict";
class AutoAway {
  constructor() {
    this.automatic = new Set();
    this.manual = new Set();
    this.pending = new Map();
  }
  forget(id) {
    this.automatic.delete(id);
    this.manual.delete(id);
    this.pending.delete(id);
  }
  setManual(id, away) {
    this.automatic.delete(id);
    this.pending.delete(id);
    if (away) this.manual.add(id);
    else this.manual.delete(id);
  }
  observe(id, away) {
    if (this.pending.get(id) === away) {
      this.pending.delete(id);
      return;
    }
    if (this.automatic.has(id) && away) return;
    this.setManual(id, away);
  }
  tick(entries, settings, idleSeconds) {
    const idle = Number.isFinite(idleSeconds) ? Math.max(0, idleSeconds) : 0;
    const shouldAway =
      settings.autoAwayEnabled === true &&
      idle >= Math.max(1, settings.autoAwayMinutes || 10) * 60;
    for (const { id, client } of entries) {
      if (!client?.ready) {
        this.forget(id);
        continue;
      }
      if (shouldAway && !this.automatic.has(id) && !this.manual.has(id)) {
        this.automatic.add(id);
        this.pending.set(id, true);
        try {
          client.sendRaw(
            "AWAY :" + (settings.autoAwayMessage || "Ausente por inactividad"),
          );
        } catch (e) {
          this.forget(id);
          throw e;
        }
      } else if (
        !shouldAway &&
        this.automatic.has(id) &&
        (settings.autoAwayReturn !== false || settings.autoAwayEnabled !== true)
      ) {
        this.automatic.delete(id);
        this.pending.set(id, false);
        client.sendRaw("AWAY");
      }
    }
  }
}
module.exports = { AutoAway };
