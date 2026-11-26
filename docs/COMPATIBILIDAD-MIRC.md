# Compatibilidad mIRC · 0.40.0-beta.2

HexDreams utiliza su propio intérprete mSL aislado, sin ejecutar mIRC.
Esta versión incorpora las funciones necesarias para el archivo original
`Control_Privados_mIRC_v87.mrc` y conserva las pruebas de `kaos_ident.mrc`.
No significa que todos los addons mIRC sean compatibles.

En Configuración → Scripts, «Analizar addon mIRC…» revisa la compatibilidad sin
instalar ni activar. Su resultado distingue análisis compatible/incompatible de
una instalación. «Importar addon .mrc/.xcr…» importa y activa los archivos que
pueden compilarse. Los alias auxiliares con puntos y `alias -l` no aparecen en
sugerencias; los comandos públicos se ejecutan con `/nombre` desde el chat.

El subconjunto incluye alias, variables, condiciones con y sin llaves, bucles,
argumentos posicionales, identificadores anidados, concatenación, prefijos de
usuario, `$address`, `$chan`, hashes, INI privados, eventos JOIN/LOAD y privados
OPEN/TEXT/ACTION, halt/haltdef y el núcleo de diálogos/did y conexiones scid/scon.
Los controles implementados son texto, edición, listas, botones, radios,
casillas y cajas. El evento y la lista de propiedades admitidas siguen siendo
limitados; otros controles y variantes se rechazan.

El motor mantiene límites de instrucciones, memoria, expansión y datos. Cada
petición de worker tiene un watchdog de un segundo, hasta 200 acciones locales
por invocación y un máximo de 40 acciones de red. Los envíos se espacian al menos
350 ms y utilizan las comprobaciones IRC/cifrado existentes. Los mensajes de
espera del addon se envían sin abrir ni crear una conversación privada.

Los INI se guardan por addon en el perfil de HexDreams como JSON dentro de
`mirc-data/<id>/ini.json`. El script usa rutas virtuales y no puede acceder al
sistema de archivos general. Activar/desactivar otro addon no borra sus estados.
Desactivar el propio addon elimina sus variables/tablas/ventanas de sesión,
conservando la configuración y listas persistidas. Los datos de los scripts `.hex`
se mantienen en su motor separado.

Los JOIN automáticos no se ejecutan antes de finalizar los comandos de conexión.
Los eventos privados se interceptan antes de mostrar, guardar en historial o
notificar el mensaje. Los mensajes propios, históricos, NOTICE y servicios IRC
no pasan por el filtro de privados del v87.

Pendientes generales: RAW, timers, evaluación dinámica, otras APIs/controladores,
archivos arbitrarios, DLL y paquetes no cubiertos por estas pruebas. El soporte
se amplía por funciones, sin traducir silenciosamente cada addon a código especial.

Ver [Control de Privados v87 e historial de salas](PRIVADOS-V87.md) para el alcance,
comandos, persistencia y pruebas de esta versión.
