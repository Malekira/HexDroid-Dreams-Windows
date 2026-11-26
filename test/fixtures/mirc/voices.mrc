;IRcap8 d03bc51dc558713549d4d422c3e5e6d2
;IRcap8 7f94bbca29edda53c63fd1216465d7bd

;  Voices AddOn by JL (WM)

;  Tested on irCAP

on 1:start: {
;## MODIFICAR ESTA LINEA SI ES NECESARIO ##
   
    set %VSmsg 4You are in my blackList !!
    
;########################################
  
  set %VSdebug .
  set %VSversion 1
  
  echo 
  echo 2Loaded addon 4Voices v $+ %VSversion ( 3/voices [channel/s]4 ) 2by 4JL (WM)
  echo 
  
  %VSdebug $+ fullname 4wWw.3Voices4.addonPack.tk
}

alias multiVoices {
  voices $1-
}
alias voices {
  if ($1) {
    var %c = $1
    if ($2) {
      multiVoices $2-
    }
  }
  elseif ($chan) {
    var %c = $chan
  }
  else {
    echo [?] Write: /voices [channel/s]
    halt
  }
  
  if (@ !isin $nick(%c,$me).pnick ) {
    echo [?] Write: /voices [channel/s] (Need @)
    halt
  }
  
  
  var %t = 1
  while ($nick(%c,%t)) {
    var %n = $nick(%c,%t)
    if ($nick(%c,%n).pnick == %n) {
      
      if (!%inc) { var %inc = 0 }
      else { inc %inc }
      
      %VSdebug $+ timer 1 %inc mode %c +v %n
      
    }
    inc %t
  }
}





