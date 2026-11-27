# HexDreams IRC 0.40.0-beta.6 · Correcciones del control de privados

Corrige el eco de respuestas automáticas: con echo-message, la confirmación del
servidor ya no muestra una respuesta marcada como silenciosa ni crea un PV.
Las respuestas mientras una solicitud está retenida permanecen silenciosas,
incluso con la conversación abierta. Rechazar no recrea el PV que acaba de cerrar.

Los paneles de addons se pueden mover por su encabezado, quedan por encima de
la barra y conservan su posición al actualizarse. Se mantienen dentro de pantalla.

La prueba v87 ahora negocia echo-message/labeled-response y comprueba nicks
nuevos y conversaciones existentes, además de aceptar/rechazar, INI e historial.
Se conservan los paneles y las funciones anteriores. Portable Windows x64.
