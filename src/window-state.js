'use strict';
const fs = require('node:fs');
const path = require('node:path');
function restoreBounds(saved, displays) {
  const primary = displays[0] || { x:0, y:0, width:1280, height:820 };
  const valid = saved && ['x','y','width','height'].every(k => Number.isFinite(saved[k]));
  const area = valid && displays.find(d => Math.min(d.x + d.width, saved.x + saved.width) - Math.max(d.x, saved.x) >= 100 && Math.min(d.y + d.height, saved.y + saved.height) - Math.max(d.y, saved.y) >= 100) || primary;
  const width = Math.min(area.width, Math.max(760, valid ? saved.width : 1280));
  const height = Math.min(area.height, Math.max(500, valid ? saved.height : 820));
  return { width:Math.round(width), height:Math.round(height), x:Math.round(Math.max(area.x, Math.min(area.x + area.width - width, valid ? saved.x : area.x + (area.width - width)/2))), y:Math.round(Math.max(area.y, Math.min(area.y + area.height - height, valid ? saved.y : area.y + (area.height - height)/2))), maximized:saved?.maximized === true };
}
class WindowState {
  constructor(directory) { this.file = path.join(directory, 'window-state.json'); }
  load(displays) { let saved; try { saved = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch {} return restoreBounds(saved, displays); }
  save(bounds, maximized) { const temp = this.file + '.tmp'; fs.writeFileSync(temp, JSON.stringify({ ...bounds, maximized }), { mode:0o600 }); fs.renameSync(temp, this.file); }
}
module.exports = { WindowState, restoreBounds };
