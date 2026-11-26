;IRcap8 b35510003ce7185347d1668bb4b689ef
;IRcap8 72c73f47bf1d1538d732f519c13010d0
;IRcap8 0143afa4bd6043b650fad90dc377ba7e
;IRcap8 7f94bbca29edda53c63fd1216465d7bd

;  delBans by JL
;  Download: www.delBans.addonPack.tk





on 1:start: {  
  echo 
  echo 2Loaded addon 4delBans (v2.1) ( 3/delBans [channel]4 ) 2by 4JL (WM)
  echo 

  delBansUnset
}

raw *:*:{
  if (%delBans == $2) {
    if ($numeric == 367) {
      
      ;.timer 1 %cBnum .mode %delBans -b $3
      set %IDbans %IDbans $3
      delBansChecker %delBans %IDbans
      
    }
    elseif ($numeric == 368) {
      delBansEnd %delBans %IDbans
      delBansUnset
    }
  }
}
alias delBansUnset {
    unset %IDbans
    unset %delBans
    unset %cBans
}
alias delBansChecker {
  if ($5) {
    if (%cBans) { set %cBans $calc(%cBans +3) }
    else { set %cBans 2 }
    
    .timer 1 %cBans delBansEnd $1 $2 $3 $4 $5
    unset %IDbans
    if ($6) { set %IDbans $6- }
  }
}

alias delBansEnd {
  if ($8) {
    .timer 1 3 delBansEnd $1 $8-
  }
  .mode $1 -bbbbbb $2 $3 $4 $5 $6 $7
}


alias cBprMode {
  if ($nick) {
    return msg $nick
  }
  else {
    return echo
  }
}


alias delBans {
  delBansUnset
  if ($1) {
    set %delBans $1
  }
  elseif ($chan) {
    set %delBans $chan
  }
  else {
    $cBprMode [?] Write: /delBans [channel]
  }
  if (%delBans) {
    mode %delBans -b
  }
}
