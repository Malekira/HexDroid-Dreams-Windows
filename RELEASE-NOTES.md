# HexDreams IRC 0.39.0 — Windows portable

- Se elimina el WHO * automático introducido en el seguimiento de 0.38.0. Esa consulta podía generar respuestas masivas y provocar SendQ exceeded.
- Las búsquedas por host y nombre real utilizan datos ya recibidos de las salas visibles. Si falta información, se completa mediante WHOIS individuales, sin barridos globales.
- Como máximo un WHOIS de seguimiento cada 15 segundos por dirección de servidor, incluso con varias conexiones. Se espera la respuesta final o un timeout de 30 segundos antes de continuar. La cola de enriquecimiento queda limitada y los datos ya conocidos no se consultan de nuevo sin necesidad.
- Se mantienen la prioridad de los comandos personalizados y consultas manuales, los informes, la carpeta elegida y la separación de evidencias. Las comprobaciones exactas de nick se repiten en rondas de al menos cinco minutos.

Esto corrige la consulta masiva detectada; sin el registro del servidor no puede asegurarse que explique cada desconexión SendQ. La búsqueda por host/nombre real queda limitada a la información visible para esa conexión; los datos que no estén disponibles pueden tardar o no encontrarse. No se cambian redes, TLS, Notify ni addons, y no se borran seguimientos ni evidencias.

Cierra HexDreams y extrae todo el ZIP en una carpeta nueva. No requiere instalación.
