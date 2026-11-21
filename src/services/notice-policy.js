"use strict";
const channel = (t) => /^[#&+!]/.test(t || "");
function destinations(data, settings, active) {
  const routes = settings.noticeDestinations || ["original"],
    out = new Set();
  if (routes.includes("original")) out.add(data.target);
  if (routes.includes("private")) {
    if (data.target === "*") out.add("*");
    else if (data.nick) out.add(data.nick);
  }
  if (routes.includes("room")) {
    if (channel(data.target)) out.add(data.target);
    else if (channel(active?.target)) out.add(active.target);
    else out.add("*");
  }
  if (routes.includes("status")) out.add("*");
  return [...out].filter(Boolean);
}
function windowEntry(data,settings){
 if(settings.noticeWindow!==true||!data.notice||data.own||data.historical)return null;
 return{...data,target:'*notices*',sourceTarget:data.target,text:'['+(data.target==='*'?'Servidor':data.target)+'] '+data.text};
}
module.exports = { destinations,windowEntry };
