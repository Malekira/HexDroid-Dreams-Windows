; Ejemplo del subconjunto mSL implementado en HexDreams.
; /hdident Nick: muestra el ident ya recibido, sin consultar al servidor.
; /hdvoz Nick: solicita +v en la sala actual; requiere los permisos IRC correspondientes.
alias -l hd_ident {
  return $gettok($gettok($address($1,5),2,33),1,64)
}
alias hdident {
  if (!$1) { echo -s Uso: /hdident Nick | return }
  if (!$address($1,5)) { echo -s No hay ident/host recibido para $1 | return }
  echo -s Ident de $1 $+ : $hd_ident($1)
}
alias hdvoz {
  if (!$chan || !$1) { echo -s Uso: /hdvoz Nick desde una sala | return }
  mode $chan +v $1
}
