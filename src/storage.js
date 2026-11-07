'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { validateProfile } = require('./irc');
const { sanitizeWorkspace } = require('./workspace');
const DEFAULTS = { showMessageAvatars:true, textLogsEnabled:true, highlightMentions:true,mentionHighlightColor:"#7650aa",roomView:"unified",eventsPanePercent:25,notifyNickChanges:true,showClones:true, savedThemes:[], sendTyping:true, fontSize: 14, sidebarWidth: 240, usersWidth: 192, showPrivates: true, showUsers: true, showTopic: true, topicHeight:null, notifyPresence:true, notifyPresenceOffline:true, notifyPresenceSound:true, timestamps: true, showEvents: true, eventShowHost:false, treeRoomsOpen:true,treePrivatesOpen:true, compact: false, autoScroll: true, fontFamily: 'Segoe UI', lineHeight: 1.65, messageSpacing: 9, ownNickColor: '#c0adf1', privateSort: 'manual', composerBold:false, composerItalic:false, composerUnderline:false, composerColor:null, mediaEnabled:true, showAvatars:true, autoAvatars:true, avatarUrlTemplate:'https://chat-avatars.chateagratis.net/avatar/Chat/{Nick}.png', mediaPreviewUrl:'', customColors:{}, photoDefaultsVersion:0, coloredNicks:true, roomAppearance:{}, mutedUsers:{}, notifyWhileFocused:true, notifyInCurrentRoom:true, mentionSound:true, privateSound:true, channelSound:false, queryHistoryEnabled:true, highlightActivity:true, highlightEvents:true, ignoredUsers:{}, protocolLogging:false, historyEnabled:false, historyDays:30, notifications:true, notificationPreview:false, notificationSound:false, flashOnMention:true, theme:'dark', minimizeToTray:false, closeToTray:false, highlightWords:[], historyDays:30, dccAutoAccept:false,dccAllowlist:[],dccAllowDirect:false, dccAddress:'127.0.0.1', dccBind:'0.0.0.0', dccPortMin:0, dccPortMax:0, dccMaxBytes:1073741824 };
function validateSettings(input, allowThemes=true) {
  const s = { ...DEFAULTS };
  if (!input || typeof input !== 'object') return s;
  for (const key of ['showMessageAvatars','textLogsEnabled','highlightMentions','notifyNickChanges','showClones','sendTyping','eventShowHost','treeRoomsOpen','treePrivatesOpen','notifyPresence','notifyPresenceOffline','notifyPresenceSound','coloredNicks','queryHistoryEnabled','composerBold','composerItalic','composerUnderline','mediaEnabled','showAvatars','autoAvatars','notifyWhileFocused','notifyInCurrentRoom','mentionSound','privateSound','channelSound','highlightActivity','highlightEvents','showPrivates','showUsers','showTopic','timestamps','showEvents','compact','autoScroll','historyEnabled','protocolLogging','notifications','notificationPreview','notificationSound','flashOnMention','dccAllowDirect','dccAutoAccept','minimizeToTray','closeToTray']) if (typeof input[key] === 'boolean') s[key] = input[key];
  if(Number.isFinite(input.topicHeight))s.topicHeight=Math.max(32,Math.min(320,Math.round(input.topicHeight)));
  if(['unified','split'].includes(input.roomView))s.roomView=input.roomView;
  if(Number.isFinite(input.eventsPanePercent))s.eventsPanePercent=Math.max(12,Math.min(65,input.eventsPanePercent));
  if(/^#[a-f\d]{6}$/i.test(input.mentionHighlightColor||''))s.mentionHighlightColor=input.mentionHighlightColor;
  if (Number.isFinite(input.fontSize)) s.fontSize = Math.max(11, Math.min(24, Math.round(input.fontSize)));
  if (Number.isFinite(input.sidebarWidth)) s.sidebarWidth = Math.max(160, Math.min(420, Math.round(input.sidebarWidth)));
  if (Number.isFinite(input.usersWidth)) s.usersWidth = Math.max(140, Math.min(360, Math.round(input.usersWidth)));
  if (Number.isFinite(input.lineHeight)) s.lineHeight = Math.max(1.2, Math.min(2.4, input.lineHeight));
  if (Number.isFinite(input.messageSpacing)) s.messageSpacing = Math.max(0, Math.min(20, Math.round(input.messageSpacing)));
  if (['Segoe UI','Consolas','Arial','Cascadia Mono'].includes(input.fontFamily)) s.fontFamily = input.fontFamily;
  if (typeof input.ownNickColor === 'string' && /^#[0-9a-f]{6}$/i.test(input.ownNickColor)) s.ownNickColor = input.ownNickColor;
  if (['manual','alphabetical','unread'].includes(input.privateSort)) s.privateSort = input.privateSort;
  if(input.ignoredUsers&&typeof input.ignoredUsers==='object'&&!Array.isArray(input.ignoredUsers)){s.ignoredUsers={};for(const[id,nicks]of Object.entries(input.ignoredUsers).slice(0,30))if(/^[a-z\d_-]{1,80}$/i.test(id)&&Array.isArray(nicks))s.ignoredUsers[id]=nicks.filter(n=>typeof n==='string'&&/^[^\s,:\0]{1,200}$/.test(n)).slice(0,500);}
  if(Array.isArray(input.dccAllowlist))s.dccAllowlist=input.dccAllowlist.filter(n=>typeof n==='string'&&/^[^\s,:\0]{1,200}$/.test(n)).slice(0,100);
  if(Array.isArray(input.highlightWords))s.highlightWords=input.highlightWords.filter(x=>typeof x==='string'&&x.length>0&&x.length<100).slice(0,50);
  if (['dark','light','system','matrix','violet'].includes(input.theme)) s.theme=input.theme;
  if (Number.isFinite(input.historyDays)) s.historyDays=Math.max(0,Math.min(3650,Math.round(input.historyDays)));
  for(const key of ['dccAddress','dccBind']) if(typeof input[key]==='string'&&require('node:net').isIP(input[key]))s[key]=input[key];
  for(const key of ['dccPortMin','dccPortMax']) if(Number.isInteger(input[key])&&input[key]>=0&&input[key]<=65535)s[key]=input[key];
  if(Number.isSafeInteger(input.dccMaxBytes)&&input.dccMaxBytes>0)s.dccMaxBytes=Math.min(1099511627776,input.dccMaxBytes);
  if(Number.isInteger(input.composerColor)&&input.composerColor>=0&&input.composerColor<=98)s.composerColor=input.composerColor;
  for(const key of ['avatarUrlTemplate','mediaPreviewUrl'])if(typeof input[key]==='string'&&input[key].length<=2048){if(input[key]){let url;try{url=new URL(input[key].replace(/\{nickLower\}|\{nick\}|%nick%|%s/gi,'test'));}catch{throw new Error('URL de multimedia no válida.');}if(url.protocol!=='https:'||url.username||url.password)throw new Error('Usa una URL HTTPS sin credenciales.');}if(key==='avatarUrlTemplate'&&input[key])require('./services/avatar-policy').avatarUrl(input[key],'test');s[key]=input[key];}
  s.customColors={};for(const key of ['bg','sidebar','surface','raised','border','text','muted','accent'])if(/^#[a-f\d]{6}$/i.test(input.customColors?.[key]||''))s.customColors[key]=input.customColors[key];
  if(input.photoDefaultsVersion===1)s.photoDefaultsVersion=1;
  s.mutedUsers={};for(const [id,nicks] of Object.entries(input.mutedUsers||{}).slice(0,30))if(Array.isArray(nicks))s.mutedUsers[id]=nicks.filter(n=>typeof n==='string'&&n.length<=200).slice(0,500);
  s.roomAppearance={};const a=input.roomAppearance;if(a&&typeof a==='object'){for(const key of ['background','inputBackground','text'])if(/^#[a-f\d]{6}$/i.test(a[key]||''))s.roomAppearance[key]=a[key];if(['normal','bold','italic','bold italic'].includes(a.style))s.roomAppearance.style=a.style;}
  if(allowThemes&&Array.isArray(input.savedThemes)){const seen=new Set();s.savedThemes=[];for(const t of input.savedThemes.slice(0,40)){if(!t||typeof t.id!=='string'||!/^[a-z0-9_-]{1,80}$/i.test(t.id)||seen.has(t.id)||typeof t.name!=='string'||!t.name.trim())continue;seen.add(t.id);const visual=require('./themes').snapshot(t.settings||{});s.savedThemes.push({id:t.id,name:t.name.trim().slice(0,80),settings:require('./themes').snapshot(validateSettings(visual,false))});}}
  return s;
}
function sanitizeData(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.profiles) || data.profiles.length > 30) throw new Error('Configuración de redes no válida.');
  const seen = new Set();
  const profiles = data.profiles.map(p => {
    if (typeof p.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(p.id) || seen.has(p.id)) throw new Error('Identificador de red no válido.');
    seen.add(p.id);
    const profile = validateProfile(p);
    return { id: p.id, name: typeof p.name === 'string' ? p.name.slice(0,80) : p.host, ...profile };
  });
  return { version: 2, settings: validateSettings(data.settings), profiles, workspace: sanitizeWorkspace(data.workspace, profiles) };
}
class Store {
  constructor(directory, report = () => {}) { this.directory = directory; this.file = path.join(directory, 'settings.json'); this.report = report; }
  load() {
    try { return sanitizeData(JSON.parse(fs.readFileSync(this.file, 'utf8'))); }
    catch (e) {
      if (e.code !== 'ENOENT') {
        this.report('No se pudo leer la configuración. Se usarán valores iniciales. ' + e.message);
        try { fs.copyFileSync(this.file, this.file + '.recovery-' + Date.now()); } catch {}
      }
      return { version: 2, settings: { ...DEFAULTS }, profiles: [], workspace: sanitizeWorkspace(null, []) };
    }
  }
  save(data) {
    const safe = sanitizeData(data); fs.mkdirSync(this.directory, { recursive: true });
    const temp = this.file + '.tmp';
    fs.writeFileSync(temp, JSON.stringify(safe, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temp, this.file); return safe;
  }
}
module.exports = { Store, DEFAULTS, validateSettings, sanitizeData };
