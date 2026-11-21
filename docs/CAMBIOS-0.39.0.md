# Corrección SendQ del seguimiento

## Causa encontrada

La versión 0.38.0 añadía WHO * para criterios host/nombre real y lo repetía en rondas aproximadamente cada minuto. Limitar la frecuencia de comandos no limitaba el tamaño de la respuesta: una consulta global puede hacer que el servidor acumule demasiados datos pendientes hacia el cliente y lo desconecte por SendQ exceeded. Se verificó esa consulta en el código. No se dispone del registro del servidor del usuario para atribuir con certeza toda desconexión a ese único factor.

## Implementación

Se elimina por completo el WHO global del seguimiento. El cliente conserva una caché acotada de hasta 5000 nicks con los datos recibidos normalmente mediante JOIN/WHO/WHOIS/CHGHOST/NICK/SETNAME/ACCOUNT. No se añade una consulta global para llenar esa caché. Se invalidan datos al salir usuarios o perder visibilidad y se vacía al reconectar. Cada snapshot devuelve una entrada por nick, con sus salas, evitando multiplicar filas por pertenencia a varias salas.

El seguimiento filtra esas observaciones locales una vez por minuto o al pedir búsqueda. Los nombres reales o datos incompletos de usuarios visibles se pueden completar con WHOIS individual. La cola de enriquecimiento tiene hasta 100 comandos pendientes; los datos completos no provocan consultas adicionales y los nicks consultados tienen un intervalo de enriquecimiento de diez minutos. Las búsquedas por nick exacto y sus nicks actualmente vinculados se repiten en rondas de al menos cinco minutos, terminando la cola anterior antes de empezar otra.

Como máximo se envía una consulta de seguimiento cada 15 segundos por dirección de servidor, compartido entre conexiones a ese host. No se superponen consultas de seguimiento al mismo servidor: se espera 318/401 o un timeout de 30 segundos. Se conserva prioridad de la secuencia de inicio y de las consultas manuales. Las conexiones se recorren en turnos para no favorecer siempre al primer perfil.

Esta corrección se limita al seguimiento. No altera los WHO de sala que la aplicación ya hacía al entrar, ni los comandos enviados explícitamente por el usuario o sus addons. Si persiste SendQ con el seguimiento corregido, esas otras fuentes deberán diagnosticarse con los datos de la nueva incidencia, sin asumir la misma causa.

## Uso y límites

Comandos → Seguimiento de usuarios conserva los mismos criterios, informes y selector de carpeta descritos en [0.38.0](CAMBIOS-0.38.0.md); únicamente su búsqueda masiva anterior queda sustituida por este mecanismo. No se borran archivos ni seguimientos. Si se quitaron criterios como mitigación, pueden agregarse de nuevo: el informe puede consultar evidencias históricas que coincidan con el criterio.

Host/nombre real ya no enumeran la red completa. Usan lo visible y recibido en las salas de esta conexión, y el enriquecimiento puede tardar. Seguir sin coincidencias no prueba que un usuario esté desconectado. Se mantiene la separación de vhosts compartidos, hosts reutilizados y cambios confirmados de conexión.

## Validación

Prueba con 2000 usuarios visibles y criterios de host/nombre real: cero WHO globales y cero consultas redundantes cuando los datos están completos. Pruebas de intervalo por servidor compartido, espera de respuesta, cola acotada, prioridad de inicio, cambios de nick/host y pérdida de visibilidad. Servidor IRC real de prueba que desconecta al recibir WHO *: el seguimiento corregido envía WHOIS individual y mantiene la conexión. Electron verifica además informes y ausencia de WHO global durante el flujo de seguimiento. El CI repite la suite completa y prueba el ejecutable Windows antes de publicarlo.
