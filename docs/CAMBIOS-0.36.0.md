# Moderación, WHOIS, scripts y Status

## Listas de moderación

Salas → Ver bans abre una ventana con red, salas en las que se está dentro y Otra… para escribir un canal. Se consulta una lista por vez: +b (367/368), +e (348/349), +I (346/347), +q (728/729) o AKICK. Las filas preservan máscara y autor completos, timestamp y respuesta original. No se deriva un nick concreto de una máscara comodín. Si se abre desde un perfil se identifica al usuario, pero se mantienen todas las máscaras para no ocultar bans de host. La lista se puede filtrar por máscara, autor o respuesta.

La retirada requiere privilegio conocido q/a/o/h mediante PREFIX y la pertenencia actual. Se valida en el proceso principal en cada solicitud; el servidor conserva la decisión final. Se vuelve a consultar la lista tras enviar MODE -b/e/I/q. No se presenta el simple envío como confirmación de éxito.

AKICK se solicita con `PRIVMSG servicio :AKICK #canal LIST`; servicio es editable (ChanServ, Chan u otro). Se conserva cada respuesta original y se reconocen filas `número máscara ...` con máscara explícita para permitir `AKICK #canal DEL número`. Los servicios pueden exigir permisos propios distintos del rol IRC. Otros formatos se muestran como texto sin atribuir autores o habilitar una retirada incorrecta. No se promete compatibilidad con servicios que utilicen una sintaxis diferente de LIST/DEL.

## Listado de salas y WHOIS

Cada resultado LIST tiene Agregar a favoritos / Quitar de favoritos para esa red, persistente y sin JOIN. WHOIS recoge también numerics adicionales asociados a la consulta; el perfil flotante tiene Respuesta WHOIS completa. 317 conserva segundos de inactividad y timestamp de conexión separados. La vista WHOIS/WHO presenta el tiempo en forma legible, manteniendo la respuesta original. El perfil lateral puede reutilizar el idle recibido previamente y muestra su hora de consulta, sin inferir actividad a partir del último mensaje ni consultar WHO automáticamente.

## Menús de scripts

Un comentario por opción, con un alias del mismo script:

```text
; @menu Salas | Saludar a la sala | saludar {sala}
; @public
alias saludar {
  msg $1 Hola a todos
}
; @menu Scripts | Abrir panel privado | helper
; @internal
alias helper {
  echo $chan Acción interna del menú
}
alias -l otro_helper {
  echo $chan Otra función interna
}
```

Ubicaciones disponibles: Archivo, Ver, Comandos, Salas, Scripts, Ayuda, Apariencia, Ventanas. Las opciones se instalan solo mientras el script está activo. Se limitan a 50 por script y a alias de su propietario; una colisión con un alias de otro script no cambia a quién se llama. Los argumentos se separan por espacios; `{sala}`, `{nick}` y `{red}` se sustituyen por el contexto actual. `{red}` es el identificador de conexión; `$network` también recibe ese identificador. No se ejecuta texto arbitrario de comandos desde la declaración del menú.

`alias -l` o `; @internal` antes del alias lo excluyen de Ayuda y sugerencias, pero no impiden su uso explícito por otros alias o por menús. Se mantienen las reglas de nombres internos anteriores (sw_, ds_, hdg_, etc.); `; @public` permite declarar una excepción visible. Estas marcas no representan una barrera de permisos. Hay una ayuda breve en el editor.

## Status

Se reprodujo un mensaje engañoso: Status mostraba Conecta esta red si no había mensajes visibles, incluso estando conectado. Ahora distingue estado conectado, ausencia de eventos y filtros, ofreciendo acceso directo a éstos. Las vistas activa y en mosaico invalidan su presentación al cambiar filtros/estado, sin esperar tráfico nuevo. Un WHOIS/WHO explícitamente activado no queda oculto por el grupo general de respuestas numéricas desactivado.

El proceso principal conserva como máximo 200 eventos reales de Status por conexión, solo en memoria. Una vista conectada vacía puede recuperar esos eventos sin SQLite; se evita mezclar consultas *consultas*, chats y sondeos Notify. Se deduplican eventos recibidos durante la recuperación y se conservan sus fechas. No es persistencia adicional ni reconstrucción de historial. La captura con filtros de conexión/servidor activados no demuestra la causa del vaciado original; no se ha reproducido en los datos reales del usuario.

## Validación

Pruebas de numerics, máscaras IPv6, rechazo de inyección, permisos tras deop, AKICK y origen del servicio; menús limitados al script propietario, helpers ocultos y retirada al desactivar; tiempo WHOIS y respuestas extra; caché acotada de Status sin chats/Notify. Pruebas de interfaz para las cinco funciones y Status; Electron con servidor IRC local, MODE +b/-b, autor completo, favoritos persistidos, alias interno desde menú y recuperación de actividad real de Status. El CI repite las pruebas en Windows y arranca/prueba el portable antes de publicar.
