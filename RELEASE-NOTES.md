# HexDreams IRC 0.29.0 — Windows portable

Implementa los diez puntos del documento de ampliaciones y los cambios de barra y panel lateral solicitados.

- Anti-PV: retención antes del chat/historial/notificación, envío directo sin PV, acciones para abrir/cerrar privados y entradas laterales por script y red.
- Las ventanas de scripts se reutilizan, recuperan el primer plano y conservan sus campos.
- Notify compartido opcional, listas individuales conservadas, estados por red y filtro lateral por red o Todas.
- Menú Apariencia con temas, presentación, Diccionario y Nick Completion; activación directa y editores existentes.
- Ctrl+Enter envía una vez sin formato; Enter y Shift+Enter conservan su funcionamiento.
- Encabezados compactos con cierre ×; panel izquierdo desde 50 px, orden y separaciones solicitados.
- Barra: Red, conexión, Topic, Salas, Status, configuración y campanita. Tema y Notify salen de esa barra.

El script opcional Extras/AntiPV_HexDreams_0.29.hex se importa manualmente; no sustituye scripts instalados. Incluye /pv y /pvconfig. Detalle del alcance y validaciones en docs/CAMBIOS-0.29.0.md del repositorio.

Extrae todo el ZIP y ejecuta HexDreamsIRC.exe desde su carpeta. No requiere instalación.
