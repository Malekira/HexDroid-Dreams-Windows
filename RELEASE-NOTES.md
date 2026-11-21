# HexDreams IRC 0.39.0 — Windows portable

- Corrección de SendQ: se elimina el WHO * automático del seguimiento. Se reutilizan datos recibidos de salas visibles y, cuando falta información, se usan WHOIS individuales, como máximo uno cada 15 segundos por servidor, esperando respuesta o timeout. No hay barridos globales.
- El criterio de seguimiento ahora es ident, junto a nick y host. El nombre real solo se conserva como dato informativo. Los criterios antiguos por nombre real quedan pausados para no cambiar el significado de sus evidencias; se pueden conservar para informes o quitar y crear uno por ident.
- Nuevo apartado Sistema: Status, WHOIS/WHO, registro de Notify, NOTICE, servicios reconocidos y entradas internas de scripts. Salas y Privados contienen sus conversaciones correspondientes. Un destino desconocido puede moverse manualmente entre Sistema y Privados desde su menú contextual.
- Opción en Configuración → NOTICE: Mostrar todos los NOTICE en una ventana de Sistema. Crea una ventana por red, adicional a los PV/destinos existentes, sin robar foco ni enviar mensajes desde ese registro. Comienza desactivada.

Se conservan informes, carpeta elegida, evidencias, configuración de redes y addons. Las búsquedas se limitan a lo visible para la conexión y pueden tardar en completar datos. La consulta masiva detectada podía provocar SendQ; sin el registro del servidor no se puede asegurar que explique todas las desconexiones posibles.

Cierra HexDreams y extrae todo el ZIP en una carpeta nueva. No requiere instalación.
