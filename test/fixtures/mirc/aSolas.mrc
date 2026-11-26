; ( ( ( aSolas by JL ) ) )
;
; Download: http://controla.addonPack.tk
;
; Tested on PhAnATiC en la red IRC-Hispana



on 1:start: {
  echo 
  echo 2Loaded miniAddon 4aSolas ( 3/asolas4 ) 2by 4JL
  echo 
  
  ;%megaDebug $+ fullname 4wWw.3aSolas4.miniAddons.addonPack.tk
}

on *:INPUT:#:{
  if ($1 == .asolas) { asolas }
}

alias asolas {
  if (%asolas) {
    unset %asolas
    echo aSolas is disabled
  }
  else {
    set %asolas $chan
    echo aSolas is enabled
  }
}
on *:join:#:{
  if (%asolas == $chan && $nick != $me) {
    kick $chan $nick Necesito estar aSolas, gracias.
  }
}
