(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./formatting'):root.DreamsFormatting);if(typeof module==='object'&&module.exports)module.exports=api;else root.DreamsServices=api;})(globalThis,function(formatting){
  'use strict';
  const names=new Set(['ipvirtual','memo','memoserv','nick','nickserv','chan','chanserv','botserv','hostserv','operserv','helpserv','global','noteserv','ns','cs','ms','bs','hs','os']);
  function isService(target){return typeof target==='string'&&names.has(target.split('@')[0].toLowerCase());}
  function plain(target,text){return isService(target)?formatting.plain(text):text;}
  function outgoingTarget(text,current){const match=/^\/(?:msg|notice)\s+(\S+)\s/i.exec(text);return match?match[1]:!text.startsWith('/')||text.startsWith('//')?current:null;}
  return{isService,plain,outgoingTarget};
});
