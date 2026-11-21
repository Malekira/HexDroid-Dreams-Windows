# HexDreams IRC 0.38.0 — Windows portable

- Comandos → Seguimiento de usuarios: criterios por nick exacto, parte del host o parte del nombre real; búsqueda de usuarios visibles y espera de futuras coincidencias.
- Informes TXT con nicks observados, hosts/vhosts, nombres reales, cuenta cuando está disponible, salas, fechas y evidencia. Se elige dónde guardar los informes; la carpeta queda guardada.
- Los vhosts compartidos no unen personas. La reutilización de hosts tras QUIT, desconexión local o pérdida de visibilidad se conserva en intervalos separados. NICK y CHGHOST observados identifican continuidad de una conexión, no identidad personal, incluido el cambio de nick registrado a Guest si el servidor lo muestra.
- El informe puede incluir evidencias guardadas anteriormente que coincidan con el criterio, sin unir intervalos por host o nombre real.
- El botón Salas muestra primero Entrar, Listado y Configurar favoritas; después, las salas favoritas.

Las búsquedas respetan el inicio de sesión y los comandos personalizados. Solo se registra lo visible para esta conexión y permitido por el servidor; no se garantiza encontrar usuarios ocultos. El seguimiento tiene archivos propios, separados de SQLite y del addon anterior. Los registros previos de addons no se importan automáticamente. Ante un fallo de escritura se pausa la captura y se avisa; un informe puede reflejar huecos. No se cambian TLS, Notify, scripts, estilos ni otras preferencias.

Extrae todo el ZIP con HexDreams cerrado. No requiere instalación.
