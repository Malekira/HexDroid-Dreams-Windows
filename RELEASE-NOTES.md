Portable de prueba para Windows x64. Extraer todo el ZIP y ejecutar HexDreamsIRC.exe. Probar-compatibilidad.cmd usa un perfil separado.

Cambios solicitados:

- Compatibilidad con Control_Privados_mIRC_v87.mrc original: retención de privados, aceptar/rechazar/ignorar, búfer de 25 mensajes, diálogos, configuración INI y lista persistente de autoaceptados. El original se incluye sin modificaciones en Extras/mIRC.
- Salas: recuperación inicial de 50 líneas y conservación de todas las nuevas durante la sesión, sin el recorte de 600. Se conservan las preferencias de guardado de historial.
- El análisis informa claramente que no instala el addon; los auxiliares pv.* no aparecen en sugerencias.

La publicación verifica pruebas unitarias, interfaz y el ejecutable empaquetado en Windows con un IRC local y el addon exacto. No se certifica compatibilidad universal con mIRC: RAW, timers y otras APIs siguen pendientes.

El archivo SHA-256 permite verificar la integridad del ZIP.
