"use strict";
// Automatic history writes must never prevent IRC events from reaching the UI.
// Stop retrying after a failure; do not repair, clear or change the database.
function guardHistoryWrite(runtime, network, operation) {
  if (runtime.historyWriteFailure) return false;
  try {
    operation();
    return true;
  } catch (error) {
    const detail = error?.message || String(error);
    runtime.historyWriteFailure = detail;
    runtime.emit(network, "problem", {
      historyFailure: true,
      text: "No se pudo actualizar el historial SQLite; su guardado queda en pausa hasta reiniciar. El chat sigue funcionando. Error: " + detail,
    });
    return false;
  }
}
module.exports = { guardHistoryWrite };
