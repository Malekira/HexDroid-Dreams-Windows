# HexDreams IRC 0.32.0

Alcance: avisar de rechazos y cortes de conexión y eliminar la salida rutinaria de Notify en Status.

El cliente conserva el motivo de ERROR, rechazos numéricos 463/464/465/466 y fallos del transporte. Los avisos de servidor relacionados con sanciones también se muestran aunque todavía no se haya entrado a ninguna sala. Los fallos de registro informados antes de un tiempo agotado se conservan en el diagnóstico. Si el servidor corta sin explicar por qué, el mensaje indica esa falta de motivo; no atribuye una G-line ni otra sanción inventada.

El gestor de sesiones transmite un evento específico de problema de conexión. Runtime conserva un registro en la campanita y en el historial TXT y evita duplicar el antiguo evento problem para el mismo error. La interfaz muestra el motivo en un aviso y en Status, conserva ese Status al caer y cierra el resto de ventanas de la red. Los errores críticos son visibles aun cuando el filtro de errores estuviera desactivado. No se cambia la política de reconexión ni se considera error una desconexión voluntaria.

Presence identifica las consultas automáticas ISON y las respuestas MONITOR rutinarias. Sus respuestas siguen actualizando el estado y siguen llegando al evento NUMERIC de los scripts, pero no se envían a Status ni al historial TXT. Una consulta ISON enviada manualmente conserva su respuesta. Los cambios reales de presencia y los errores de MONITOR, como lista llena, permanecen activos. El protocolo bruto sigue disponible en diagnóstico si estaba habilitado.

La campanita etiqueta estos nuevos registros como Conexión y conserva su red y motivo. Con la ventana en segundo plano se usa también la notificación de Windows si las notificaciones están habilitadas.

Pruebas: motivos G/Z/K-line, ausencia de salas, código de rechazo, cierre voluntario, corte TCP real sin motivo, persistencia visual del Status desconectado con filtros desactivados, consulta ISON automática/manual, actualizaciones de presencia y conservación de hooks de scripts. Electron se conecta a un servidor local que rechaza con 465 G-lined y verifica el aviso, el Status y la campanita.
