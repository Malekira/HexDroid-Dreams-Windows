;IRcap8 0143afa4bd6043b650fad90dc377ba7e
;IRcap8 7f94bbca29edda53c63fd1216465d7bd

;  megaWho by JL(C) WM
;  Download: ---



alias mW-window-msg { var %w = @megaWhoS | window -e %w | echo %w $1- }

alias megaWho {
  
  /who $chan
  
  
  mW-window-msg $date - $time - Scanning: $network - $chan: INDEX!!
  
  timer 1 10 megaWho2 $chan
  
}
alias megaWho2 {
  var %t = 1
  while ($nick($1,%t)) {
    
    mW-window-msg $1 - $replace($address($nick($1,%t),2),*!*@,) - $nick($1,%t)
    
    inc %t
  }
  
  mW-window-msg ------------------------------------------------ SCAN ENDS
    
}