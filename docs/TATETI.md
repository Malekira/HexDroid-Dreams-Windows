# Ta-Te-Ti para HexDreams IRC · addon v1

Requiere HexDreams IRC **0.40.0-beta.7 o posterior**. Las versiones anteriores
no implementan el tablero ni el protocolo. No requiere mIRC ni un servidor de
juegos externo. Las partidas no se guardan en disco.

## Instalar y abrir

1. Extraer el portable completo.
2. Configuración → Scripts → Importar archivo .hex. Elegir
   `Extras/TaTeTi_HexDreams_v1.hex`. Se activa automáticamente.
3. Abrir Scripts → Ta-Te-Ti o escribir `/tateti` desde un chat.

El panel se puede mover desde su encabezado. Durante una partida, las opciones
para empezar otra quedan plegadas bajo Nuevo juego. Ocultarlo conserva la partida;
Terminar la cancela. Desactivar o eliminar el addon detiene sus partidas.

## Contra la computadora

Elegir **Contra la computadora**. No requiere estar conectado a IRC. Jugás con
X y empezás; la computadora juega con O y elige jugadas óptimas. Las casillas
ocupadas quedan deshabilitadas. Ganar, perder o empatar habilita Jugar otra vez.

## Contra otra persona

Ambos deben usar una versión compatible de HexDreams y tener el addon activo.
Conectarse a la misma red IRC, elegir esa red en el panel, escribir el nick del
rival y pulsar Invitar. También se puede usar `/tateti Nick`.

La otra persona debe aceptar la invitación. Quien invita juega con X y empieza;
el rival usa O. El tablero indica de quién es el turno y bloquea jugadas fuera
de turno. Al terminar, Invitar a revancha envía una nueva invitación que también
requiere aceptación. El nick de IRC identifica al rival; no se usa el vhost como
prueba de identidad.

Las jugadas se envían como NOTICE CTCP privados `HDTTT`, con un identificador
aleatorio por partida y número de turno. No son mensajes de sala ni PV de chat,
no abren conversaciones y no pasan por el control de privados. No contienen
mensajes de chat, claves ni datos personales adicionales al nick y el tablero.
No se admite este protocolo para un destino configurado como privado cifrado.

## Desconexiones y límites

La red debe permitir NOTICE/CTCP entre los jugadores; un filtro del servidor
o del usuario puede impedir que llegue la invitación. Las invitaciones vencen
tras 90 segundos sin respuesta. Una partida remota sin
actividad vence a los 10 minutos. Desconectar la red, observar que el rival se
fue o cambió de nick termina la partida; se puede invitar otra vez al reconectar.
Si no comparten salas, IRC puede no comunicar inmediatamente una salida o cambio
de nick del rival: en ese caso actúa el vencimiento por inactividad.

Se comprueban remitente, red, partida, turno, casilla libre y secuencia. Los
mensajes históricos, repetidos, de terceros, malformados o dirigidos a una sala
se descartan. Las invitaciones y los envíos tienen límites para evitar ráfagas.
Se conservan hasta 20 partidas por sesión, eliminando las finalizadas más
antiguas cuando hace falta espacio. No hay estadísticas persistentes ni soporte
para jugar ambos lados de una misma partida desde dos perfiles de una sola
instancia: para probar dos usuarios, abrir dos instancias con perfiles separados.

## Validación

Reglas, ocho líneas ganadoras, empate, computadora probada frente a todas las
respuestas posibles del jugador, partidas entre dos motores, secuencias, turnos,
repeticiones, remitentes falsos, permisos, vencimientos y desconexión. Interfaz
local sin red, teclado y ventana compacta. Prueba Electron con dos instancias,
IRC local, addon .hex y v87 activo: invitación, aceptación, victoria sincronizada,
revancha rechazada y desactivación sin mostrar el protocolo en chats.
