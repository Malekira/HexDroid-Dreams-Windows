# Historial aislado del estado IRC — 0.33.0

Problema reproducido: Runtime.receive escribía y depuraba el historial antes de emitir JOIN. Una excepción FTS5 interrumpía el método; la cola mostraba un error pero descartaba el evento. El cliente IRC podía haber ingresado a la sala mientras la interfaz conservaba joined=false y deshabilitaba la escritura. Status no depende de ese indicador y seguía funcionando.

## Cambio

guardHistoryWrite captura las excepciones de las escrituras automáticas y mantiene el procesamiento normal del evento. Se aplica a mensajes, NOTICE, eventos de sala, historial de consultas, redacciones y mensajes privados recuperados. No se fuerza joined=true: sigue dependiendo del JOIN propio real y PART/KICK siguen deshabilitando la sala.

Después del primer fallo se conservan su detalle y un aviso crítico en Status. Se pausan las escrituras automáticas SQLite durante la vida de ese Runtime para evitar un error por mensaje y nuevas operaciones sobre una base que acaba de fallar. El próximo arranque vuelve a intentar el guardado conforme a las preferencias existentes. No se modifica historyEnabled ni se eliminan preferencias. El historial TXT es independiente y puede continuar.

No se ejecutan reparaciones, rebuild, VACUUM, DROP ni limpieza de la base del usuario. No se cambian HistoryStore ni los mecanismos de importación/restauración explícita. Las búsquedas y lecturas pueden seguir fallando si la base está dañada: corregir ese daño queda fuera de este cambio. Tampoco se atribuye su origen al Bot Espía, cuya versión modificada no está disponible.

## Verificación

Pruebas en memoria para errores tanto de append como de prune; JOIN, mensajes y PART siguen llegando; los avisos no se repiten y los TXT se conservan. WHOIS y redacciones también llegan a la interfaz. Una instancia nueva puede volver a escribir, sin cambiar preferencias persistentes.

En Electron con IRC local se sale de una sala, se simula una excepción FTS en memoria antes de volver a entrar y se verifica que el cuadro esté habilitado, que el servidor reciba un mensaje, que solo haya un intento fallido y que Status conserve el aviso. La prueba utiliza un perfil temporal, sin modificar ni corromper bases reales. Windows repite las pruebas y verifica el ejecutable empaquetado antes de publicar.
