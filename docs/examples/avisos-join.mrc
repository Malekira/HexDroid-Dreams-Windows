; /hdseguir: activa avisos locales de entrada para la sala actual.
; /hdseguir off: desactiva estos avisos. No envía mensajes al servidor.
alias hdseguir {
  if ($1 == off) { unset %hdseguir | echo -s Avisos JOIN desactivados | return }
  if (!$chan) { echo -s Usa /hdseguir desde una sala | return }
  set %hdseguir $chan
  echo -s Avisos JOIN activos en %hdseguir
}
on *:JOIN:#:{
  if (%hdseguir == $chan && $nick != $me) { echo -a Entró $nick a $chan }
}
