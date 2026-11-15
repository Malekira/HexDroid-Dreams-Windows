# Integración del Seguidor de Nicks — 0.31.0

Origen: PR #4, rama feat/seguidor-de-nicks-hex, commit 272c21e3cc4b7a8c393bc5bf2865aa6fb779aae9. Se aplican sus cambios sobre 0.30.0 para conservar el orden de inicio y los ajustes de Notify; no se sustituye la versión actual por la rama antigua.

## Programa principal

- src/irc.js añade ident y host del prefijo IRC al evento NICK, manteniendo old/nick/own/targets.
- src/services/runtime.js expone JOIN al motor .hex con network, buffer/chan de la sala, nick, host, ident y own. NICK expone esos campos y newnick, usando la primera sala afectada o * cuando no existe ninguna.
- El empaquetado incorpora los addons en Extras sin activar ni reemplazar scripts del usuario.

## Script

addons/Seguidor-de-Nicks.hex parte del script del PR. Se ajusta la construcción de colecciones vacías para que, con el intérprete existente, no se guarden elementos vacíos ni aparezcan avisos en el primer ingreso o comas sobrantes. No se cambia el intérprete general.

El script registra cambios por red y host, recupera sn_db desde el estado persistente del script y emite solo echo local. Ignora ingresos propios y datos sin host. Un host puede ser compartido por usuarios diferentes: el aviso informa únicamente de coincidencia de host.

Para usarlo se importa Extras/Seguidor-de-Nicks.hex. Si existe otra copia instalada, debe actualizarse en lugar de ejecutar ambas; el programa no elimina ni reemplaza scripts automáticamente.

## Verificaciones

Pruebas de prefijos IRC reales, campos de eventos en Runtime, primer ingreso silencioso, repetición de nick, NICK seguido de JOIN, aislamiento entre redes/hosts, ausencia de envío IRC y restauración de estado. Electron con servidor IRC local comprueba el aviso en la sala y que no se transmite PRIVMSG; en Windows, con almacén seguro disponible, verifica la restauración tras reactivar el script. La publicación queda condicionada a las pruebas de Windows y del ejecutable empaquetado.
