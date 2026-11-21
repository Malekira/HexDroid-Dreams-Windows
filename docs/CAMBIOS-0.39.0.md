# Corrección SendQ del seguimiento

## Causa encontrada

La versión 0.38.0 añadía WHO * para criterios host/nombre real y lo repetía en rondas aproximadamente cada minuto. Limitar la frecuencia de comandos no limitaba el tamaño de la respuesta: una consulta global puede hacer que el servidor acumule demasiados datos pendientes hacia el cliente y lo desconecte por SendQ exceeded. Se verificó esa consulta en el código. No se dispone del registro del servidor del usuario para atribuir con certeza toda desconexión a ese único factor.

## Implementación

Se elimina por completo el WHO global del seguimiento. El cliente conserva una caché acotada de hasta 5000 nicks con los datos recibidos normalmente mediante JOIN/WHO/WHOIS/CHGHOST/NICK/SETNAME/ACCOUNT. No se añade una consulta global para llenar esa caché. Se invalidan datos al salir usuarios o perder visibilidad y se vacía al reconectar. Cada snapshot devuelve una entrada por nick, con sus salas, evitando multiplicar filas por pertenencia a varias salas.

El seguimiento filtra esas observaciones locales una vez por minuto o al pedir búsqueda. Los idents o datos incompletos de usuarios visibles se pueden completar con WHOIS individual. La cola de enriquecimiento tiene hasta 100 comandos pendientes; los datos completos no provocan consultas adicionales y los nicks consultados tienen un intervalo de enriquecimiento de diez minutos. Las búsquedas por nick exacto y sus nicks actualmente vinculados se repiten en rondas de al menos cinco minutos, terminando la cola anterior antes de empezar otra.

Como máximo se envía una consulta de seguimiento cada 15 segundos por dirección de servidor, compartido entre conexiones a ese host. No se superponen consultas de seguimiento al mismo servidor: se espera 318/401 o un timeout de 30 segundos. Se conserva prioridad de la secuencia de inicio y de las consultas manuales. Las conexiones se recorren en turnos para no favorecer siempre al primer perfil.

Esta corrección se limita al seguimiento. No altera los WHO de sala que la aplicación ya hacía al entrar, ni los comandos enviados explícitamente por el usuario o sus addons. Si persiste SendQ con el seguimiento corregido, esas otras fuentes deberán diagnosticarse con los datos de la nueva incidencia, sin asumir la misma causa.

## Uso y límites

Comandos → Seguimiento de usuarios conserva los mismos criterios, informes y selector de carpeta descritos en [0.38.0](CAMBIOS-0.38.0.md); únicamente su búsqueda masiva anterior queda sustituida por este mecanismo. No se borran archivos ni seguimientos. Si se quitaron criterios como mitigación, pueden agregarse de nuevo: el informe puede consultar evidencias históricas que coincidan con el criterio.

Host/ident ya no enumeran la red completa. Usan lo visible y recibido en las salas de esta conexión, y el enriquecimiento puede tardar. Seguir sin coincidencias no prueba que un usuario esté desconectado. Se mantiene la separación de vhosts compartidos, hosts reutilizados y cambios confirmados de conexión.

## Validación

Prueba con 2000 usuarios visibles y criterios de host/ident: cero WHO globales y cero consultas redundantes cuando los datos están completos. Pruebas de intervalo por servidor compartido, espera de respuesta, cola acotada, prioridad de inicio, cambios de nick/host y pérdida de visibilidad. Servidor IRC real de prueba que desconecta al recibir WHO *: el seguimiento corregido envía WHOIS individual y mantiene la conexión. Electron verifica además informes y ausencia de WHO global durante el flujo de seguimiento. El CI repite la suite completa y prueba el ejecutable Windows antes de publicarlo.

## Ampliaciones solicitadas durante esta corrección

### Ident

El selector ofrece Nick exacto, Host contiene e Ident contiene. Se compara ident del prefijo IRC o de WHO/WHOIS, sin usar el nombre real como criterio. El nombre real puede seguir figurando como contexto en el informe. Un ident puede ser compartido por distintas personas y no une intervalos. Los criterios realName guardados por versiones anteriores se cargan pausados, conservan su significado para informes y no generan nuevas consultas. No se reetiquetan evidencias anteriores como si hubieran sido obtenidas por ident. Para seguir un ident se agrega un criterio nuevo; el informe puede reutilizar evidencias históricas que coincidan con ese ident.

### Sistema

La barra lateral tiene Salas, Privados y Sistema. Sistema agrupa Status, WHOIS/WHO, Notify, NOTICE, buffers internos y destinos de servicios ya reconocidos por la aplicación. Las entradas laterales internas de scripts se muestran también dentro de Sistema para la red seleccionada; un PV real abierto por un script continúa siendo un PV de usuario. Un bot con nick común no se clasifica automáticamente como servicio. El menú contextual Mover a Sistema / Mover a Privados permite clasificar destinos ambiguos; se conserva esa elección sin cambiar el nick, destino IRC ni capacidad de enviar comandos al servicio. Las ventanas locales de registro siguen siendo de solo lectura. Sistema puede plegarse y conserva ese estado.

### NOTICE adicional

Configuración → NOTICE → Mostrar todos los NOTICE en una ventana de Sistema. Es una opción independiente, desactivada por defecto. Los NOTICE entrantes en vivo que pasan los filtros y scripts existentes generan una sola copia en *notices* de esa conexión, con título NOTICE. Se mantienen intactos los PV y destinos configurados previamente; no se duplica el aviso emergente ni la entrada de campana por añadir esta copia. Se conserva emisor, texto y contexto de origen. No se copian mensajes propios ni históricos para no llenar el registro con repeticiones. No se cambia de conversación al recibir un NOTICE. El registro es de sesión, con el mismo límite de mensajes de las demás ventanas, y no envía mensajes, typing ni marcas de lectura a IRC.

### Validaciones adicionales

Clasificación de servicios y usuarios, buffers de scripts y reclasificación manual persistente; plegado de Sistema; selector de ident, coincidencias de ident compartido sin unir identidades y migración pausada de realName; copia adicional de NOTICE manteniendo los PV. Electron verifica dos emisores NOTICE reales con una sola ventana adicional y mensajes originales intactos. Los tests del barrido global y del ritmo de consultas se mantienen en esta misma versión.
