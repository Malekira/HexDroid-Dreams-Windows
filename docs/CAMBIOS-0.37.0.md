# Registro Notify en una ventana de privado

La opción global notifyPrivateLog, desactivada por defecto, se configura desde Notify. Cada conexión dispone de una vista local *notify* con título Notify, situada entre los privados. Abrir registro Notify permite abrirla desde el administrador. Los eventos se agregan sin elegir esa conversación ni enviar notificaciones adicionales.

Runtime convierte las transiciones reales presence/presence-nick en notify-log, con nombre de perfil, servidor, texto y fecha. Se excluyen initial, privateOnly y duplicate, así como presence con renamed, para no registrar snapshots, observaciones exclusivas de privados o la reconexión ficticia asociada a un cambio de nick. El destino funciona independientemente de notifications/notifyPresence y de las opciones de avisos emergentes; la preferencia específica controla su captura.

Workspace distingue notify de private para evitar incluirla entre nicks observados o cargar historial IRC de ese destino. La vista se incluye entre los privados, pero su editor y envío están desactivados tanto en primer plano como en mosaico. Runtime rechaza send a *notify* y el cliente omite typing/read markers. Los eventos quedan visibles aunque showEvents esté desactivado. No se agrega guardado SQLite/TXT ni se cambia la política que cierra todas las ventanas al desconectar. Desactivar la opción no borra las líneas existentes.

Validaciones: preferencia, formato de los tres eventos, exclusión de snapshots y duplicados, captura con popups desactivados, clasificación y bloqueo de envío local, ausencia de read markers/typing, interfaz sin cambio de foco y de solo lectura; Electron con un cambio MONITOR real y persistencia de la opción. El CI repite la suite completa en Windows y prueba el ejecutable empaquetado.
