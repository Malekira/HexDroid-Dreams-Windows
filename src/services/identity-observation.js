'use strict';
function decode(m){
 const p=m.params,mask=/^[^!]+!([^@]*)@(.+)$/.exec(m.prefix||''),base={nick:m.nick,...(mask?{ident:mask[1],host:mask[2]}:{})};
 switch(m.command){
 case 'JOIN':return{...base,kind:'seen',source:'JOIN',channel:p[0],...(p.length>=3?{account:p[1]==='*'?'':p[1],realName:p[2]}:{})};
 case 'NICK':return{...base,kind:'nick',source:'NICK',next:p[0]};
 case 'CHGHOST':return{...base,kind:'host',source:'CHGHOST',ident:p[0],host:p[1]};
 case 'SETNAME':return{...base,kind:'seen',source:'SETNAME',realName:p[0]};
 case 'ACCOUNT':return{...base,kind:'seen',source:'ACCOUNT',account:p[0]==='*'?'':p[0]};
 case 'QUIT':return{...base,kind:'quit',source:'QUIT',reason:p[0]||''};
 case 'PART':return{...base,kind:'part',source:'PART',channel:p[0]};
 case 'KICK':return{nick:p[1],kind:'part',source:'KICK',channel:p[0]};
 case '352':return{kind:'seen',source:'WHO',channel:p[1],ident:p[2],host:p[3],nick:p[5],realName:(p[7]||'').replace(/^\d+ /,'')};
 case '354':if(['152','153'].includes(p[1])&&p.length>=9)return{kind:'seen',source:'WHOX',channel:p[2],ident:p[3],host:p[4],nick:p[5],account:['0','*'].includes(p[7])?'':p[7],realName:p.at(-1)};return null;
 case '311':return{kind:'seen',source:'WHOIS',nick:p[1],ident:p[2],host:p[3],realName:p[5]};
 case '330':return{kind:'seen',source:'WHOIS ACCOUNT',nick:p[1],account:p[2]};
 case '401':return{kind:'missing',source:'401',nick:p[1]};
 default:return null;
 }
}
module.exports={decode};
