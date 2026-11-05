const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
const { WindowState, restoreBounds } = require('../src/window-state');
const primary = {x:0,y:0,width:1920,height:1080};
test('Window moves back on screen after a monitor is removed', () => {
  const state = restoreBounds({x:-3000,y:200,width:1200,height:800,maximized:true},[primary]);
  assert.ok(state.x >= 0); assert.ok(state.x + state.width <= 1920); assert.equal(state.maximized,true);
});
test('Secondary monitors with negative coordinates remain supported', () => {
  const state = restoreBounds({x:-1800,y:50,width:1000,height:700},[primary,{x:-1920,y:0,width:1920,height:1080}]);
  assert.equal(state.x,-1800); assert.equal(state.y,50);
});
test('Window geometry is saved separately from chat settings and survives reopening', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'dreams-window-')); t.after(() => fs.rmSync(dir,{recursive:true,force:true}));
  const store = new WindowState(dir); store.save({x:50,y:60,width:1000,height:700},false);
  assert.equal(new WindowState(dir).load([primary]).x,50);
  fs.writeFileSync(store.file,'broken'); assert.ok(new WindowState(dir).load([primary]).width > 0);
});
