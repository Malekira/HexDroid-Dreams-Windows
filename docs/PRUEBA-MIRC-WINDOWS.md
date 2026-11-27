# HexDreams IRC 0.40.0-beta.6 · portable Windows x64

Extraé todo el ZIP y ejecutá `HexDreamsIRC.exe`. No requiere instalación.
`Probar-compatibilidad.cmd` permite usar una configuración separada, guardada en
`Datos-Prueba-Compatibilidad` junto al programa. Cerrá la instancia habitual
antes de iniciar ese perfil de prueba.

## Control de Privados v87

1. Conectate a tu red y abrí Configuración → Scripts → Compatibilidad mIRC.
2. Desactivá otros controles de privados que hayas cargado para evitar que compitan.
3. Elegí «Importar addon .mrc/.xcr…» y seleccioná `Control_Privados_mIRC_v87.mrc`
   (se incluye el original sin cambios en `Extras/mIRC`).
4. Usá `/pvconfig` para configurar mensajes, modo de aceptación, ventana y avisos.
5. Cuando llegue una solicitud, usá la ventana de pendientes, `/si Nick`, `/no Nick`
   o `/pvignorar Nick`. `/pvpendientes` vuelve a mostrar la ventana.
6. La lista de autoaceptados y la configuración se guardan por addon. Podés agregar
   y quitar nicks desde esa ventana o con `/pvautoagregar` y `/pvautoquitar`.

«Analizar addon mIRC…» solo analiza. Su mensaje final dice expresamente si puede
importarse y que no se ha instalado. No se confunde con una activación exitosa.

## Salas

Se ajusta la recuperación inicial a las últimas 50 líneas una sola vez para las
configuraciones anteriores. Si el historial estaba desactivado, no se activa
silenciosamente. La cantidad de recuperación puede cambiarse en Historial.
Todas las líneas nuevas de una sala se conservan durante la sesión: ya no se
recortan al superar 600 ni al cambiar de ventana. El ajuste de recuperación no
limita la conversación en curso. Los mensajes no se guardan en settings.json.

La publicación automática exige pruebas unitarias, interfaz, arranque y Electron
con IRC local, tanto desde fuentes como desde el ejecutable empaquetado en Windows.
Incluye pruebas del v87 original y de conservación de mensajes de sala.

Esta beta no ofrece compatibilidad universal con addons mIRC: siguen pendientes
controles adicionales, eventos de moderación, DLL y otras APIs. RAW numéricos, timers y menús básicos sí están implementados. Ver `Extras/mIRC/ALCANCE.md` para el estado por addon.

Paneles adicionales: ver `Extras/mIRC/PANELES.md`. Se incluyen los originales `ignorakuerys.xcr` y `PVGuard.mrc`.

Beta 6 comprueba también el filtro con eco de servidor activado, sin mostrar respuestas de espera/rechazo en PV retenidos. Guardar aplica el modo seleccionado; las aceptaciones previas y la lista autoaceptada del addon conservan sus reglas.
