;IRcap8 bf755fb6036472365a770057f941b135
; ========================================================================
; CONTROL DE PRIVADOS - mIRC 7.x (version 6)
; ========================================================================
; Creado por Dramatiik
; /pvconfig       Configurar mensajes, modo y avisos
; /pvpendientes   Ver solicitudes y aceptar/rechazar/ignorar
; /si [nick]      Aceptar un privado pendiente en la conexion activa
; /no [nick]      Rechazar un privado y enviar el mensaje de rechazo
; /pvignorar nick  Descartar la solicitud sin responder ni bloquear
; /pvreset nick   Permitir que ese nick vuelva a solicitar un privado
; /pvautoagregar nick  Agregar nick a autoaceptados persistentes
; /pvautoquitar nick   Quitar nick de autoaceptados persistentes
;
; {nick} se sustituye por el nick real en los tres mensajes.
; Se conservan el saludo y las opciones de versiones anteriores.
; Aceptaciones y rechazos manuales duran la sesion. La lista autoaceptada
; se guarda en pv_saludo.ini para conservarla al cerrar mIRC.
; ------------------------------------------------------------------------
; CREDITOS: este texto aparece al instalar/cargar el addon.
; Cada palabra usa un color mIRC distinto; $chr(15) restaura el estilo.
; El credito aparece en Status y no se envia a ninguna sala o privado.
; ------------------------------------------------------------------------

alias pv.creditos {
  echo -s $+($chr(3),04,Gracias,$chr(3),07,$chr(32),por,$chr(3),02,$chr(32),usar,$chr(3),03,$chr(32),nuestro,$chr(3),12,$chr(32),Addon,$chr(3),06,$chr(32),-,$chr(3),10,$chr(32),by,$chr(3),13,$chr(32),Dramatiik,$chr(15))
}

on *:LOAD: {
  pv.creditos
}

alias pv.ruta {
  return $+($scriptdir,pv_saludo.ini)
}

alias pv.clave {
  return $+($cid,.,$lower($1))
}

alias pv.mensaje {
  ; Recupera los mensajes de configuracion. Si falta uno usa el predeterminado.
  var %tipo = $lower($1)
  if (%tipo == espera) {
    var %valor = $readini($pv.ruta,n,Mensajes,espera)
    if ($len(%valor) == 0) return Espere por favor, estoy revisando su solicitud de privado...
    return %valor
  }
  if (%tipo == aceptacion) {
    var %valor = $readini($pv.ruta,n,Mensajes,aceptacion)
    ; Compatibilidad con versiones antiguas del addon.
    if ($len(%valor) == 0) var %valor = $readini($pv.ruta,n,Saludo,texto)
    if ($len(%valor) == 0) return Hola {nick}, ¿En Qué Te Puedo Ayudar? =)
    return %valor
  }
  if (%tipo == rechazo) {
    var %valor = $readini($pv.ruta,n,Mensajes,rechazo)
    if ($len(%valor) == 0) return Disculpa {nick}, no puedo aceptar tu privado en este momento.
    return %valor
  }
}

alias pv.personalizar {
  ; $1 = espera / aceptacion / rechazo, $2 = nick.
  var %marca = $+($chr(123),nick,$chr(125))
  return $replace($pv.mensaje($1),%marca,$2)
}

alias pv.modo {
  if ($readini($pv.ruta,n,Opciones,modo) == auto) return auto
  return preguntar
}

alias pv.usarventana {
  if ($readini($pv.ruta,n,Opciones,ventana) == 0) return 0
  return 1
}

alias pv.usartip {
  if ($readini($pv.ruta,n,Opciones,tip) == 0) return 0
  return 1
}

; ========================================================================
; LISTA PERSISTENTE DE NICKS AUTOACEPTADOS
; Se guarda en la seccion [Autoaceptados] de pv_saludo.ini.
; Es una lista global para las conexiones del mismo mIRC (solo nick).
; ========================================================================

alias pv.esauto {
  if (!$1) return 0
  if ($readini($pv.ruta,n,Autoaceptados,$lower($1)) == 1) return 1
  return 0
}

alias pv.nickvalido {
  ; Sin espacios, caracteres de control ni separadores de INI.
  ; Admite nicks con barras verticales, guiones y corchetes.
  if (!$1) return 0
  if ($0 != 1) return 0
  if ($len($1) > 32) return 0
  if ($regex($1,/^[^\s=;:]+$/) == 0) return 0
  return 1
}

alias pv.auto.pendiente {
  ; Ejecutado en cada conexion por /scon -a.
  var %clave = $pv.clave($1)
  if ($hget(PV_Rechazados,%clave)) hdel PV_Rechazados %clave
  if ($hget(PV_Pendientes,%clave)) {
    pv.aceptar $hget(PV_Pendientes,%clave)
  }
}

alias pvautoagregar {
  if (!$pv.nickvalido($1-)) {
    echo 4 -s [PV] Escribi un solo nick valido, de hasta 32 caracteres. Uso: /pvautoagregar Nick
    return
  }
  var %nick = $lower($1)
  if ($pv.esauto(%nick)) {
    echo 3 -s [PV] %nick ya esta en la lista de autoaceptados.
    pv.auto.refrescar
    return
  }
  writeini $qt($pv.ruta) Autoaceptados %nick 1
  if (!$pv.esauto(%nick)) {
    echo 4 -s [PV] No se pudo guardar el nick. Revisa la carpeta del script.
    return
  }
  ; Si habia una solicitud de ese nick en cualquier conexion, aceptarla ahora.
  scon -a pv.auto.pendiente %nick
  echo 3 -s [PV] %nick agregado a autoaceptados. Queda guardado para futuras sesiones.
  pv.auto.refrescar
}

alias pvautoquitar {
  if (!$pv.nickvalido($1-)) {
    echo 4 -s [PV] Uso: /pvautoquitar Nick
    return
  }
  var %nick = $lower($1)
  if (!$pv.esauto(%nick)) {
    echo -s [PV] %nick no figura en la lista de autoaceptados.
    return
  }
  remini $qt($pv.ruta) Autoaceptados %nick
  if ($pv.esauto(%nick)) {
    echo 4 -s [PV] No se pudo quitar el nick de la lista.
    return
  }
  ; Los PV aceptados manual o automaticamente antes de quitarlo siguen
  ; aceptados ESTA sesion. Para revocar ahora: /pvreset Nick.
  echo 3 -s [PV] %nick quitado de autoaceptados. Si ya estaba aceptado esta sesion, usa /pvreset %nick para revocarlo.
  pv.auto.refrescar
}

; Una solicitud nueva se notifica una sola vez al usuario.
alias pv.aviso {
  var %nick = $1
  var %clave = $pv.clave(%nick)
  if ($hget(PV_Pendientes,%clave)) return
  hadd -m100 PV_Pendientes %clave %nick
  hadd -m100 PV_Horas %clave $time(HH:nn)
  set %pv_ultimo %nick
  msg %nick $pv.personalizar(espera,%nick)
  echo 3 -s [PV pendiente] %nick escribio desde la conexion $cid $+ . Usa /si %nick o /no %nick $+ .
  if ($pv.usartip) {
    ; Esta es una notificacion mIRC Tips cerca del area de notificaciones de Windows.
    noop $tip($+(pv_,%clave),Solicitud de privado,%nick te ha escrito. Abri /pvpendientes para decidir.,15)
  }
  if ($pv.usarventana) pv.mostrar
  else pv.refrescar
}

; Cada solicitud guarda hasta 25 mensajes, incluyendo el inicial.
alias pv.guardar {
  if ($len($2-) == 0) return
  var %clave = $1
  var %n = $hget(PV_Cantidad,%clave)
  if (%n >= 25) return
  hinc -m100 PV_Cantidad %clave
  var %item = $+(%clave,.,$hget(PV_Cantidad,%clave))
  hadd -m100 PV_Mensajes %item $time(HH:nn:ss) $2-
}

alias pv.borrarbuf {
  var %clave = $1
  var %n = $hget(PV_Cantidad,%clave)
  var %i = 1
  while (%i <= %n) {
    hdel PV_Mensajes $+(%clave,.,%i)
    inc %i
  }
  if (%n) hdel PV_Cantidad %clave
}

; Regresa el ultimo nick pendiente de la conexion activa, si no hay argumento.
alias pv.elegir {
  if ($1) return $1
  var %clave = $pv.clave(%pv_ultimo)
  if ($hget(PV_Pendientes,%clave)) return $hget(PV_Pendientes,%clave)
  var %item = $hfind(PV_Pendientes,$+($cid,.*),1,w)
  if (%item) return $hget(PV_Pendientes,%item)
}

; Acepta en el contexto de la conexion especificada (scid desde el dialogo).
alias pv.aceptar {
  var %nick = $1
  if (!%nick) {
    echo -s [PV] No hay nick seleccionado.
    return
  }
  var %clave = $pv.clave(%nick)
  if (!$hget(PV_Pendientes,%clave)) {
    echo -s [PV] No hay solicitud pendiente de %nick en esta conexion.
    pv.refrescar
    return
  }
  hadd -m100 PV_Aceptados %clave 1
  hdel PV_Pendientes %clave
  hdel PV_Horas %clave
  query %nick
  var %n = $hget(PV_Cantidad,%clave)
  if (%n) {
    echo %nick --- Mensajes recibidos antes de aceptar el privado ---
    var %i = 1
    while (%i <= %n) {
      var %registro = $hget(PV_Mensajes,$+(%clave,.,%i))
      echo %nick $+([,$gettok(%registro,1,32),]) $+(<,%nick,>) $gettok(%registro,2-,32)
      inc %i
    }
    echo %nick --- Fin de los mensajes pendientes ---
  }
  pv.borrarbuf %clave
  msg %nick $pv.personalizar(aceptacion,%nick)
  echo 3 -s [PV aceptado] %nick fue aceptado y se envio el saludo.
  pv.refrescar
}

; Rechazar: manda respuesta y deja el nick bloqueado en esta sesion.
; Ignorar: solo descarta la solicitud actual; no responde NI bloquea.
; Si el usuario vuelve a escribir, se genera una solicitud nueva.
alias pv.denegar {
  var %nick = $1
  var %accion = $2
  if (!%nick) {
    echo -s [PV] No hay nick seleccionado.
    return
  }
  var %clave = $pv.clave(%nick)
  if (!$hget(PV_Pendientes,%clave)) {
    echo -s [PV] No hay solicitud pendiente de %nick en esta conexion.
    pv.refrescar
    return
  }
  ; Se elimina solamente la solicitud y sus mensajes pendientes.
  hdel PV_Pendientes %clave
  hdel PV_Horas %clave
  pv.borrarbuf %clave
  if (%accion == rechazo) {
    hadd -m100 PV_Rechazados %clave 1
    if ($query(%nick)) close -m %nick
    msg %nick $pv.personalizar(rechazo,%nick)
    echo 4 -s [PV rechazado] Se envio el rechazo a %nick $+ .
    echo -s [PV] Para recibir nuevas solicitudes de este nick: /pvreset %nick
  }
  else {
    ; IGNORAR: ni /ignore, ni tabla de rechazados, ni cierre del PV.
    ; El siguiente mensaje del nick vuelve a generar una solicitud.
    echo 3 -s [PV ignorado] Se descarto la solicitud de %nick sin responder ni bloquearlo. Puede volver a escribir.
  }
  pv.refrescar
}

alias pv.rechazar {
  pv.denegar $1 rechazo
}

alias pv.ignorar {
  pv.denegar $1 ignorar
}

alias si {
  var %nick = $pv.elegir($1)
  if (!%nick) {
    echo -s [PV] No hay solicitudes pendientes en esta conexion.
    return
  }
  pv.aceptar %nick
}

alias no {
  var %nick = $pv.elegir($1)
  if (!%nick) {
    echo -s [PV] No hay solicitudes pendientes en esta conexion.
    return
  }
  pv.rechazar %nick
}

alias pvignorar {
  var %nick = $pv.elegir($1)
  if (!%nick) {
    echo -s [PV] No hay solicitudes pendientes en esta conexion.
    return
  }
  pv.ignorar %nick
}

alias pvreset {
  if (!$1) {
    echo -s [PV] Uso: /pvreset nick
    return
  }
  var %clave = $pv.clave($1)
  if ($hget(PV_Aceptados,%clave)) hdel PV_Aceptados %clave
  if ($hget(PV_Rechazados,%clave)) hdel PV_Rechazados %clave
  if ($hget(PV_Pendientes,%clave)) hdel PV_Pendientes %clave
  if ($hget(PV_Horas,%clave)) hdel PV_Horas %clave
  pv.borrarbuf %clave
  echo -s [PV] Permiso reiniciado para $1 en esta conexion.
  pv.refrescar
}

alias pv.auto {
  var %nick = $1
  var %clave = $pv.clave(%nick)
  if ($hget(PV_Aceptados,%clave)) return
  hadd -m100 PV_Aceptados %clave 1
  echo 3 -s [PV automatico] Se acepto a %nick (conexion $cid $+ ).
  msg %nick $pv.personalizar(aceptacion,%nick)
}

; Primera linea de un privado que no tiene ventana de query.
; Importante: halt en on ^OPEN evita el on TEXT inicial. Por eso
; guardamos el mensaje inicial aqui antes de bloquear la ventana.
on ^*:OPEN:?:*: {
  if (!$nick) return
  var %clave = $pv.clave($nick)
  if ($pv.esauto($nick)) {
    if ($hget(PV_Rechazados,%clave)) hdel PV_Rechazados %clave
    if ($hget(PV_Pendientes,%clave)) pv.aceptar $nick
    else pv.auto $nick
    return
  }
  if ($hget(PV_Rechazados,%clave)) halt
  if ($hget(PV_Aceptados,%clave)) return
  if ($hget(PV_Pendientes,%clave)) {
    pv.guardar %clave $1-
    halt
  }
  if ($pv.modo == auto) {
    pv.auto $nick
    return
  }
  pv.aviso $nick
  pv.guardar %clave $1-
  halt
}

; Mensajes entrantes de una query ya abierta.
on ^*:TEXT:*:?: {
  var %clave = $pv.clave($nick)
  if ($pv.esauto($nick)) {
    if ($hget(PV_Rechazados,%clave)) hdel PV_Rechazados %clave
    if ($hget(PV_Pendientes,%clave)) pv.aceptar $nick
    else pv.auto $nick
    return
  }
  if ($hget(PV_Rechazados,%clave)) haltdef
  if ($hget(PV_Rechazados,%clave)) return
  if ($hget(PV_Aceptados,%clave)) return
  if ($hget(PV_Pendientes,%clave)) {
    pv.guardar %clave $1-
    haltdef
    return
  }
  if ($pv.modo == auto) {
    pv.auto $nick
    return
  }
  pv.aviso $nick
  pv.guardar %clave $1-
  haltdef
}

; Acciones /me enviadas a una query abierta.
on ^*:ACTION:*:?: {
  var %clave = $pv.clave($nick)
  if ($pv.esauto($nick)) {
    if ($hget(PV_Rechazados,%clave)) hdel PV_Rechazados %clave
    if ($hget(PV_Pendientes,%clave)) pv.aceptar $nick
    else pv.auto $nick
    return
  }
  if ($hget(PV_Rechazados,%clave)) haltdef
  if ($hget(PV_Rechazados,%clave)) return
  if ($hget(PV_Aceptados,%clave)) return
  if ($hget(PV_Pendientes,%clave)) {
    pv.guardar %clave $+(*,$chr(32),$1-)
    haltdef
    return
  }
  if ($pv.modo == auto) {
    pv.auto $nick
    return
  }
  pv.aviso $nick
  pv.guardar %clave $+(*,$chr(32),$1-)
  haltdef
}

; ========================================================================
; VENTANA CON LISTA DE SOLICITUDES PENDIENTES
; ========================================================================

dialog pv_pendientes {
  title "Control de privados by Dramatiik - Pendientes y autoaceptados"
  size -1 -1 700 414
  option pixels
  text "Rechazar avisa y bloquea. Ignorar descarta sin bloquear.", 11, 14 12 670 20
  text "SOLICITUDES PENDIENTES", 12, 14 37 322 19
  list 10, 14 59 322 260, size vsbar
  text "NICKS AUTOACEPTADOS (GUARDADOS)", 44, 350 37 334 19
  list 40, 350 59 334 182, size vsbar
  text "Escribi el nick que queres autoaceptar:", 45, 350 248 334 18
  edit "", 41, 350 269 334 29, autohs
  button "Agregar nick", 42, 350 305 156 30
  button "Quitar seleccionado", 43, 521 305 163 30
  text "Los nicks de la derecha se aceptan solos, incluso tras reiniciar mIRC.", 46, 14 342 672 18
  button "Aceptar", 20, 14 366 153 33
  button "Rechazar", 21, 185 366 153 33
  button "Ignorar", 22, 356 366 153 33
  button "Configuracion", 23, 527 366 157 33
}

alias pvpendientes {
  pv.mostrar
}

alias pv.mostrar {
  if ($dialog(pv_pendientes)) {
    pv.refrescar
    dialog -v pv_pendientes
    return
  }
  dialog -md pv_pendientes pv_pendientes
}

alias pv.refrescar {
  if (!$dialog(pv_pendientes)) return
  var %seleccion = $did(pv_pendientes,10).seltext
  did -r pv_pendientes 10
  var %total = $hget(PV_Pendientes,0).item
  var %i = 1
  while (%i <= %total) {
    var %clave = $hget(PV_Pendientes,%i).item
    var %nick = $hget(PV_Pendientes,%clave)
    var %cid = $gettok(%clave,1,46)
    var %hora = $hget(PV_Horas,%clave)
    var %linea = %cid %nick $+([,%hora,])
    did -a pv_pendientes 10 %linea
    if (%linea == %seleccion) did -c pv_pendientes 10 $did(pv_pendientes,10).lines
    inc %i
  }
  if ($did(pv_pendientes,10).lines == 0) {
    did -a pv_pendientes 10 (No hay privados pendientes)
    did -b pv_pendientes 20,21,22
  }
  else did -e pv_pendientes 20,21,22
  pv.auto.refrescar
}

alias pv.auto.refrescar {
  if (!$dialog(pv_pendientes)) return
  var %seleccion = $did(pv_pendientes,40).seltext
  did -r pv_pendientes 40
  var %total = $ini($pv.ruta,Autoaceptados,0)
  var %i = 1
  while (%i <= %total) {
    var %nick = $ini($pv.ruta,Autoaceptados,%i)
    if (%nick) {
      did -a pv_pendientes 40 %nick
      if (%nick == %seleccion) did -c pv_pendientes 40 $did(pv_pendientes,40).lines
    }
    inc %i
  }
  if (!$did(pv_pendientes,40).lines) {
    did -b pv_pendientes 43
  }
  else did -e pv_pendientes 43
}

alias pv.seleccion {
  if (!$dialog(pv_pendientes)) return
  var %linea = $did(pv_pendientes,10).seltext
  var %cid = $gettok(%linea,1,32)
  var %nick = $gettok(%linea,2,32)
  if (!$regex(%cid,/^[0-9]+$/) || !%nick) {
    echo -s [PV] Selecciona un nick de la lista.
    return
  }
  if ($1 == aceptar) scid %cid pv.aceptar %nick
  elseif ($1 == rechazar) scid %cid pv.rechazar %nick
  elseif ($1 == ignorar) scid %cid pv.ignorar %nick
}

on *:DIALOG:pv_pendientes:init:0: {
  pv.refrescar
}

on *:DIALOG:pv_pendientes:sclick:20: {
  pv.seleccion aceptar
}

on *:DIALOG:pv_pendientes:sclick:21: {
  pv.seleccion rechazar
}

on *:DIALOG:pv_pendientes:sclick:22: {
  pv.seleccion ignorar
}

on *:DIALOG:pv_pendientes:sclick:23: {
  pvconfig
}

on *:DIALOG:pv_pendientes:dclick:10: {
  pv.seleccion aceptar
}

on *:DIALOG:pv_pendientes:sclick:42: {
  var %nick = $did($dname,41).text
  if (!$pv.nickvalido(%nick)) {
    echo 4 -s [PV] Ingresa un nick valido, sin espacios, de hasta 32 caracteres.
    return
  }
  pvautoagregar %nick
  did -r $dname 41
}

on *:DIALOG:pv_pendientes:sclick:43: {
  var %nick = $did($dname,40).seltext
  if (!%nick) {
    echo 4 -s [PV] Selecciona un nick de la lista de autoaceptados.
    return
  }
  pvautoquitar %nick
}

on *:DIALOG:pv_pendientes:dclick:40: {
  var %nick = $did($dname,40).seltext
  if (%nick) {
    did -r $dname 41
    did -a $dname 41 %nick
  }
}

; ========================================================================
; CONFIGURACION: ESPERA, ACEPTACION, RECHAZO, MODO, VENTANA Y TIP
; ========================================================================

dialog pv_config {
  title "Control de privados by Dramatiik - Configuracion"
  size -1 -1 520 458
  option pixels
  text "Mensaje de espera (al recibir un PV nuevo):", 10, 14 12 490 18
  edit "", 11, 14 33 492 29, autohs
  text "Mensaje de aceptacion / saludo:", 12, 14 74 490 18
  edit "", 13, 14 95 492 29, autohs
  text "Mensaje de rechazo (/no o boton Rechazar):", 14, 14 136 490 18
  edit "", 15, 14 157 492 29, autohs
  text "Usa {nick} en los mensajes. Ignorar no responde ni bloquea.", 16, 14 199 492 20
  box "Comportamiento de los privados nuevos", 17, 14 226 492 91
  radio "Preguntar antes de aceptar", 20, 28 252 466 24, group
  radio "Aceptar automaticamente", 21, 28 281 466 24
  check "Abrir ventana con los privados pendientes", 22, 18 325 488 24
  check "Aviso emergente junto a la barra de Windows (mIRC Tips)", 23, 18 352 488 24
  button "Autoaceptados...", 32, 14 410 210 33
  button "Guardar", 30, 266 410 112 33
  button "Cerrar", 31, 394 410 112 33, cancel
}

alias pvconfig {
  if ($dialog(pv_config)) {
    dialog -v pv_config
    return
  }
  dialog -md pv_config pv_config
}

on *:DIALOG:pv_config:init:0: {
  did -a $dname 11 $pv.mensaje(espera)
  did -a $dname 13 $pv.mensaje(aceptacion)
  did -a $dname 15 $pv.mensaje(rechazo)
  if ($pv.modo == auto) did -c $dname 21
  else did -c $dname 20
  if ($pv.usarventana) did -c $dname 22
  if ($pv.usartip) did -c $dname 23
}

on *:DIALOG:pv_config:sclick:30: {
  var %espera = $did($dname,11).text
  var %aceptacion = $did($dname,13).text
  var %rechazo = $did($dname,15).text
  if (($len(%espera) == 0) || ($len(%aceptacion) == 0) || ($len(%rechazo) == 0)) {
    echo 4 -s [PV] Los tres mensajes deben tener texto. Ignorar es silencioso y no bloquea.
    return
  }
  writeini $qt($pv.ruta) Mensajes espera %espera
  writeini $qt($pv.ruta) Mensajes aceptacion %aceptacion
  writeini $qt($pv.ruta) Mensajes rechazo %rechazo
  if ($did($dname,21).state) writeini $qt($pv.ruta) Opciones modo auto
  else writeini $qt($pv.ruta) Opciones modo preguntar
  writeini $qt($pv.ruta) Opciones ventana $did($dname,22).state
  writeini $qt($pv.ruta) Opciones tip $did($dname,23).state
  echo 3 -s [PV] Configuracion guardada. Modo: $pv.modo $+ .
  dialog -x $dname
}


on *:DIALOG:pv_config:sclick:32: {
  pv.mostrar
}
