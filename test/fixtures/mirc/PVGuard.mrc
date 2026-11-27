; PVGuard.mrc — Control de privados con confirmación
; Requisitos de usuario:
; - Avisar al remitente: "Espere a que su PV sea aceptado."
; - Diálogo de Aceptar/Rechazar
; - Respuesta "Privado aceptado." o "Privado rechazado."
; - Bloqueo 5 minutos tras rechazo (solo PV)
; - Notificaciones en Status
; Comandos:
;   /pvguard on | off
;   /pvguard allow <mask>
;   /pvguard unallow <mask>
;   /pvguard list
;   /pvguard help

on *:START:{
  if (!$hget(pvguard.wl)) hmake pvguard.wl 50
  if (!$hget(pvguard.allowed)) hmake pvguard.allowed 50
}

alias pvguard {
  if ($1 == on)      { set %pvguard.on 1 | echo -s [PVGuard] Activado }
  elseif ($1 == off) { unset %pvguard.on | echo -s [PVGuard] Desactivado }
  elseif ($1 == allow) && ($2) {
    hadd -m pvguard.wl $2 1
    echo -s [PVGuard] Whitelist agregado: $2
  }
  elseif ($1 == unallow) && ($2) {
    hdel pvguard.wl $2
    echo -s [PVGuard] Whitelist quitado: $2
  }
  elseif ($1 == list) {
    var %f = $qt($scriptdir $+ pvguard_whitelist.hsh)
    hsave -o pvguard.wl %f
    echo -s [PVGuard] Whitelist guardado en: %f
  }
  else {
    echo -s Uso: /pvguard on|off | /pvguard allow <mask> | /pvguard unallow <mask> | /pvguard list
  }
}

; --- Núcleo: intercepta apertura de PV y muestra diálogo ---
on ^*:OPEN:?:*:{
  if (!%pvguard.on) return
  if ($pvguard_isallowed($nick)) return

  var %addr = $address($nick,2)
  ; Aviso al remitente, sin spamear (marca 60s)
  if (!$($+(%,pvguard.noticed.,%addr),2)) {
    msg $nick Espere a que su PV sea aceptado.
    set -u60 $+(%,pvguard.noticed.,%addr) 1
  }

  echo -s [PVGuard] Solicitud de PV de $nick $+ ( $+ %addr $+ ). Elige Aceptar o Rechazar.
  set -g %pvguard.nick $nick
  set -g %pvguard.addr %addr

  ; Cierra ventana si llegó a abrirse y cancela apertura
  .close -m $nick
  dialog -m pvguard pvguard
  haltdef
}

; Si algo se filtra por TEXT directo, también lo frena
on ^*:TEXT:*:?:{
  if (!%pvguard.on) return
  if ($pvguard_isallowed($nick)) return
  ; Reitera estado al remitente (no-spam ya lo controla el flag)
  if (!$($+(%,pvguard.noticed.,$address($nick,2)),2)) {
    msg $nick Espere a que su PV sea aceptado.
    set -u60 $+(%,pvguard.noticed.,$address($nick,2)) 1
  }
  echo -s [PVGuard] (Descartado) $nick: $1-
  haltdef
}

; --- Helpers de permiso ---
alias pvguard_isallowed {
  var %addr = $address($1,2)
  ; 1) Aceptados previamente (esta sesión)
  if ($hfind(pvguard.allowed,%addr,1,w)) return $true
  ; 2) En whitelist explícita (por máscara)
  if ($hfind(pvguard.wl,%addr,1,w)) return $true
  ; 3) En notify
  if ($notify($1)) return $true
  return $false
}

; --- Diálogo Aceptar/Rechazar ---
dialog pvguard {
  title "Solicitud de PV"
  size -1 -1 180 70
  option dbu
  text "Usuario:", 1, 7 9 30 10
  text "", 2, 40 9 132 10, autohs
  button "&Aceptar", 3, 22 40 60 14, default
  button "&Rechazar", 4, 98 40 60 14, cancel
}

on *:DIALOG:pvguard:init:0:{
  did -ra pvguard 2 %pvguard.nick
}

on *:DIALOG:pvguard:sclick:3:{ 
  ; Aceptar
  if (!%pvguard.nick) return
  hadd -m pvguard.allowed %pvguard.addr 1
  echo -s [PVGuard] PV ACEPTADO de %pvguard.nick $+ ( $+ %pvguard.addr $+ )
  dialog -x pvguard
  ; Abre query y saluda
  query %pvguard.nick
  msg %pvguard.nick Privado aceptado.
  ; Limpia vars
  unset %pvguard.nick | unset %pvguard.addr
}

on *:DIALOG:pvguard:sclick:4:{ 
  ; Rechazar: ignora PV por 5 minutos (300s) y avisa
  if (!%pvguard.nick) return
  ignore -pu300p %pvguard.addr
  echo -s [PVGuard] PV RECHAZADO de %pvguard.nick $+ ( $+ %pvguard.addr $+ ). Bloqueado 5 min (solo PV).
  msg %pvguard.nick Privado rechazado.
  dialog -x pvguard
  unset %pvguard.nick | unset %pvguard.addr
}

; Seguridad: si el usuario cierra el diálogo, no aceptar por accidente
on *:DIALOG:pvguard:close:*:{
  unset %pvguard.nick | unset %pvguard.addr
}
