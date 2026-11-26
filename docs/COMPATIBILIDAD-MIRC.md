# Compatibilidad mIRC · 0.40.0-beta.4

HexDreams usa un intérprete mSL propio y aislado. No ejecuta ni distribuye mIRC.
Esta es una ampliación del subconjunto soportado, **no compatibilidad universal**.

En Configuración → Scripts, «Analizar addon mIRC…» no instala ni ejecuta el archivo.
Un análisis que compila no certifica todas las ramas ni sus dependencias.
«Importar addon .mrc/.xcr…» lo importa y activa. Si falla su inicialización se conserva
importado pero desactivado y se informa el error. No se ignoran instrucciones
incompatibles para aparentar una ejecución correcta.

## Ampliación implementada

- Eventos START, CONNECT, DISCONNECT, INPUT, NICK, PART y NOTICE, además de
  JOIN, LOAD, OPEN, TEXT, ACTION y DIALOG existentes. TEXT/ACTION/NOTICE respetan
  sus máscaras de texto y se procesan los manejadores coincidentes en orden.
- RAW numéricos conservando todos los parámetros IRC en sus posiciones originales.
  La recepción para scripts no imprime automáticamente esos datos en Status.
- Temporizadores de una ejecución o repetidos, con nombre, reemplazo y cancelación.
  Se cancelan al desconectar, cambiar de sesión, desactivar o eliminar el addon.
- Menús menubar/channel/status/query/nicklist. Las entradas de menubar aparecen en
  Scripts; las demás en el menú contextual correspondiente. Las rutas se muestran
  compactas («panel › acción»). Evaluar una etiqueta no conserva sus efectos laterales.
- Ventanas locales `@nombre`, dentro de Sistema y de solo lectura.
- `fullname` actualiza el nombre real del perfil para la próxima conexión.
- WHO/WHOIS y acciones básicas de moderación por el mismo envío IRC validado;
  helpers de tokens, máscaras, grupos, fechas y texto; alias legacy sin `alias`,
  asignaciones, etiquetas/goto y expansión dinámica limitada, sin JavaScript eval.
- Archivos de texto virtuales `write`, `read`, `lines`, `isfile`, `hsave` y `hload`.
  Se guardan por addon en `mirc-data/<id>/files.json`; las variantes son limitadas.
- Ignores temporales de privados por nick/máscara y host conocido, con caducidad y
  limpieza al desconectar o desactivar. No modifican la lista general de ignorados.
- `load/reload/unload` identifica únicamente addons ya importados por nombre.
  No busca ni ejecuta automáticamente archivos externos al registro.

Se conserva el control de privados **v87 original**, sus diálogos e INI por addon,
y la recuperación inicial de 50 líneas de sala con todas las líneas nuevas
conservadas durante la sesión. Los scripts `.hex` siguen en su motor separado.

Los comandos personalizados de conexión terminan antes de los eventos automáticos.
START se inicializa una sola vez cuando la red está disponible; CONNECT puede
reiniciar la lógica que el addon haya definido para una reconexión.

## Evidencia y límites por addon

| Archivo original | Comprobación / pendiente |
| --- | --- |
| Control_Privados_mIRC_v87.mrc | Pruebas unitarias y Electron: retención, aceptar/rechazar, configuración, lista e INI. |
| kaos_ident.mrc | Alias, JOIN e ident probados en motor y Electron con servidor local. |
| aSolas.mrc | START, INPUT, activación/desactivación y kick al JOIN probados en motor. |
| delBans.mrc | RAW 367/368 y retirada de máscara probados en motor y Electron. |
| voices.mrc | START y creación del temporizador de voz probados en motor. |
| megaWho.mrc | WHO, ventana local y temporizador de consulta probados en motor. |
| myClonDetector.mrc | Comparación de host y salida local probadas en motor; mismo host no demuestra identidad. |
| spy.mrc | START, WHO/RAW 352, temporizador, menú y ventana local probados; integración en Electron. |
| antiFloodPers.mrc y su copia | Pendiente la semántica de `/flood`; las llamadas dinámicas fallan explícitamente. |
| controla.mrc, PVGuard.mrc, tobogan.mrc, saluda.mrc | Compilan; falta validar todas sus rutas. No certificados como totalmente compatibles. |
| remoteControl.mrc | Pendientes INVITE y auxiliares de otros módulos. |
| who.mrc | Pendientes `$colour` y restantes rutas. |
| notify.mrc, trojAdd.mrc | Pendientes comando/eventos notify y otras rutas. |
| ignorakuerys.xcr | Pendientes combo editable y controles adicionales. |
| AntiPv.mrc | Pendiente el análisis de su sintaxis completa y ocultación de ventanas privadas. |
| addonPack.mrc | Pendientes APIs como `$file`, enlaces entre módulos y archivos ausentes, incluido modera.mrc. |
| TotalProtection.mrc | Pendientes eventos de moderación y APIs de sus paneles/listas. |
| asciiAdd.mrc | Pendiente ampliar el parser para su estructura. |
| personalAdd.mrc, eLiTe.mrc, SkeDDoN[v5].mrc | Pendientes estructuras y APIs adicionales. No se ejecutan binarios mIRC ni programas externos. |

La ejecución en servidores públicos, los permisos reales de cada sala, todas las
ramas y los límites MODES específicos de cada servidor requieren validación adicional.
El motor no concede permisos de operador ni inventa direcciones de usuarios.

## Aislamiento

Worker dedicado, watchdog de un segundo por petición, presupuesto de instrucciones,
64 MB de heap, máximo 200 acciones por lote y 40 de red; envíos espaciados al menos
350 ms. Máximo 100 temporizadores, 1000 ignores y 1 MB de archivos virtuales por addon.
Rutas absolutas, unidades Windows y `..` quedan fuera del espacio de archivos.
No se implementan DLL/COM, ejecución de programas externos ni acceso general al disco.
Los INI existentes permanecen en `mirc-data/<id>/ini.json`; no se reconstruyen bases.
