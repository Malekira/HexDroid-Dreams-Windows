# HexDreams IRC 0.35.0 — Windows portable

- Notify separa la lista donde se guarda cada nick del alcance de sus consultas. Al agregarlo se elige una conexión o Todas, y Solo esta conexión, Mismo servidor o Todos los servidores.
- Una lista de Hannii puede mostrar presencia comprobada desde Dramatiik aunque Hannii esté desconectada, si se autorizó compartirla con ese servidor. Mismo servidor compara la dirección configurada, sin importar puerto o TLS; no supone equivalencias entre direcciones diferentes.
- El selector lateral conserva las listas disponibles sin conexión. Los usuarios en línea indican la conexión observadora; entre servidores diferentes se muestran por separado. Los clics de perfil, privado y WHOIS usan esa conexión.
- Cada fila permite cambiar el alcance o quitar el nick de su lista. Las listas anteriores y la lista global existente se conservan al editar. El ajuste general antiguo se sustituye por acceso al administrador de listas.
- Se mantienen la separación SQLite de 0.34.0, los TXT y la protección que evita que un error del historial bloquee el chat.

No se puede comprobar presencia sin una conexión activa autorizada: se indica Sin confirmar. No se cambia la configuración TLS ni la secuencia de inicio de las conexiones.

Extrae todo el ZIP con HexDreams cerrado. No requiere instalación.
