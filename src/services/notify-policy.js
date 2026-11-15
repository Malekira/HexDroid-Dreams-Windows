"use strict";
const {fold}=require('../irc');
function names(config,profile){return config.settings.sharedNotify===true?config.settings.sharedNotifyNicks||[]:profile.notifyNicks||[];}
function unique(values){return [...new Map(values.map(n=>[fold(n),n])).values()];}
module.exports={names,unique};
