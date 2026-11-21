(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./service-targets'):root.DreamsServices);if(typeof module==='object'&&module.exports)module.exports=api;else root.DreamsConversationGroups=api;})(globalThis,services=>{
 'use strict';
 function section(c){
  if(c.kind==='channel')return'rooms';
  if(['server','queries','notify','notices'].includes(c.kind)||/^\*.*\*$/.test(c.name))return'system';
  if(c.kind==='private'&&['system','private'].includes(c.sidebarSection))return c.sidebarSection;
  if(services?.isService(c.name))return'system';
  if(c.messages?.some(m=>m.systemSource==='script')&&c.messages.every(m=>m.event||m.systemSource==='script'))return'system';
  return'private';
 }
 return{section};
});
