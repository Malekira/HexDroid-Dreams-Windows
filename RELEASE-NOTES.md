# HexDreams IRC 0.40.0-beta.4 · Windows portable

Ampliación del motor propio de compatibilidad mIRC: temporizadores cancelables,
RAW numéricos, menús, ventanas locales en Sistema, eventos de conexión/entrada,
archivos virtuales e ignores temporales. Conserva privados v87 y el historial de
salas (50 recuperadas + nuevas líneas sin recorte durante la sesión).

Comprobaciones con los originales aSolas, delBans, voices, megaWho,
myClonDetector y spy. Pruebas Electron con IRC local para kaos_ident, spy,
delBans y privados v87; pruebas de interfaz y empaquetado en Windows.

No es compatibilidad universal: los paneles más grandes aún requieren APIs,
eventos y módulos adicionales. El ZIP incluye el estado detallado por addon
en Extras/mIRC/ALCANCE.md. Compilar no certifica todas las rutas de un addon.

Extraer el ZIP completo y ejecutar HexDreamsIRC.exe. Probar-compatibilidad.cmd
usa un perfil separado. No se necesita instalar ni ejecutar mIRC.
