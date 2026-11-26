;IRcap8 0143afa4bd6043b650fad90dc377ba7e
;IRcap8 7f94bbca29edda53c63fd1216465d7bd

;  myClonDetector by JL(C) WM
;  Download: http://addonPack.aquiTODO.INFo



on *:join:#:{
  if ($nick != $me) {
    if ($site == $replace($address($me,2),*!*@,)) {
      var %w = @myClonDetector
      window %w
      echo %w $time - $network - $server - $chan : ME: $me , NICK-Clon: $nick , ADDRESS: $site
    }
  }
}