alias tp-ident { 
  if ($1 == off || !$1) { unset %ident-id | unset %ident-msg | unset %ident-kicks } 
  else { 
    set %ident-msg $2- | set %ident-kicks 1 | set %ident-id $replace($replace($address($1,5),$1 $+ !,),$replace($address($1,2),*!*,),) | var %t = 1
    while ($chan(%t)) { 
      if ($nick($chan(%t),$1)) { kick $chan(%t) $1 $2- } 
      inc %t 
    } 
  } 
} 
 
on *:join:#:{ 
  if (%ident-id) { 
    if (%ident-id == $replace($replace($address($nick,5),$nick $+ !,),$replace($address($nick,2),*!*,),)) { inc %ident-kicks | kick $chan $nick %ident-kicks %ident-msg } 
  } 
} 
