;IRcap8 abf0da70d7a9aacb2b372f207c25273e
; IRcap8 7f94bbca29edda53c63fd1216465d7bd
; spy by JL WM
; Tested by RxX_Kaos on dune.irc-hispano.org
; Download: wWw.spy.miniAddons.addonPack.tk


on 1:start: {

 set %spy-debug .
 set %spy-version 3
 set %spy-timer 30
 set %spy-logo-little 3[spy3]
 
 unset %spy-nick
 unset %spy-ipv
 unset %spy-is-on

 echo 
 echo 2Loaded addon 4spy ( 3/spy4 ) 2by 4JL WM
 echo 

 ;%spy-debug $+ fullname 4wWw.3spy4.addonPack.tk v $+ %spy-version
}
menu channel,menubar,status {
 spy
 .Comands:spy
 .-
 .Load addon spy:lspy
 .Unload addon spy:uspy
}
alias lspy { /load -rs addons/spy.mrc }
alias uspy { /unload -rs addons/spy.mrc }
alias spy {
 if ($1) { set %spy-is-on TRUE | %spy-debug $+ spy-spy $1- }
 else {
   unset %spy-is-on
   echo 
   echo 3/spy (OFF)
   echo 
   echo 2/lspy 4Load addon 2spy
   echo 2/uspy 4Unload addon 2spy
   echo 
   echo 2/spy [nick] 4Enable / Disable addon 2spy
   echo 
 }
}
on *:CONNECT:{
 if (%spy-is-on) { %spy-debug $+ timerSpy }
}
alias timerSpy {
 if (%spy-is-on) {
  if (%spy-nick) { who %spy-nick }
  if (%spy-ipv) { who %spy-ipv }

  %spy-debug $+ timer 1 %spy-timer timerSpy
 }
}
alias spy-spy {
 set %spy-nick $1-
 set %spy-ipv $1-
 %spy-debug $+ timerSpy
}
;raw *:*: { Echo RAW $numeric $1 , $2 , $3 , $4 , $5 , $6 , $7 , $8 , $9  | haltdef }
raw *:*: {
  if ($numeric == 352 && %spy-is-on && ($6 == %spy-nick || $4 == %spy-ipv)) {
    %spy-debug $+ spy-window-msg $time 4 Espiando a:3 %spy-nick $+ :4 IPVs:3 $3 $+ @ $+ $4 $+ 4, Nick actual:3 $6
    set %spy-ipv $4
  }
}
alias spy-window-msg { var %w = @spy | window -e %w | echo %w $1- }
