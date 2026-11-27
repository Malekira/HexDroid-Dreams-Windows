const {test,expect}=require('@playwright/test');
const {MslVM}=require('../../src/scripts/mirc/language');
test('mSL panels have functional tabs, editable combos, live fields, focus and keyboard actions',async({page})=>{
 const errors=[],actions=[];page.on('pageerror',e=>errors.push(e.message));
 const vm=new MslVM(`alias open { dialog -m controls controls }
dialog controls {
 title "Controles"
 size -1 -1 500 300
 tab "Lista",1,0 0 130 28
 tab "Texto",2,140 0 130 28
 combo 3,0 40 240 90,tab 1
 edit "",4,0 150 240 28,tab 1
 edit "Solo lectura",5,0 40 240 80,multi read tab 2
 check "Activar",7,260 40 160 28,tab 1
 button "Guardar",8,0 230 130 28,default
 button "Cancelar",9,150 230 130 28,cancel
}
on *:DIALOG:controls:init:0:{ did -a controls 3 Alice | did -a controls 3 Bob | did -f controls 3 }
on *:DIALOG:controls:edit:4:{ echo -s edit $did(4).text }
on *:DIALOG:controls:sclick:7:{ did -ra controls 4 $did(7).state }
on *:DIALOG:controls:sclick:8:{ echo -s saved $did(4).text }
on *:DIALOG:controls:sclick:9:{ echo -s cancelled }
`),fields={network:'n',buffer:'*'};
 await page.exposeFunction('__panelInteraction',data=>{const r=vm.dialogEvent(fields,data.name,data.interaction,data.control,data.values);actions.push(...r.actions);return r;});
 await page.addInitScript(()=>{
  const listeners=[];window.__panelEmit=e=>listeners.forEach(cb=>cb(e));
  window.dreams={load:async()=>({settings:{fontSize:14,showUsers:true},profiles:[],warnings:[]}),save:async x=>x,onEvent:cb=>listeners.push(cb),copy:async()=>({ok:true}),quit:async()=>{},
   advanced:async(name,data)=>{if(name==='script.mirc.dialog'){const r=await window.__panelInteraction(data);window.__panelEmit({type:'mirc-dialogs',script:'test',...r});return {ok:true};}if(name==='status')return {scripts:[],mircScripts:[],transfers:[],debug:[],aliases:[],launchers:[],crypto:{}};return [];}};
 });
 await page.goto('http://127.0.0.1:4173');await page.waitForFunction(()=>window.dreamsUIReady===true);
 const result=vm.invoke('open',fields);await page.evaluate(r=>window.__panelEmit({type:'mirc-dialogs',script:'test',...r}),result);
 const panel=page.locator('.mirc-dialog'),combo=panel.locator('[data-mirc-id="3"] input');
 const before=await panel.boundingBox(),head=await panel.locator('header').boundingBox();await page.mouse.move(head.x+80,head.y+12);await page.mouse.down();await page.mouse.move(head.x+130,head.y+82,{steps:6});await page.mouse.up();const after=await panel.boundingBox();expect(after.y).toBeGreaterThan(before.y+40);
 await combo.focus();await expect(combo).toBeFocused();await expect(panel.locator('[data-mirc-id="3"] select option')).toHaveCount(2);
 await panel.locator('[data-mirc-id="7"] input').check();await expect(panel.locator('[data-mirc-id="4"]')).toHaveValue('1');expect((await panel.boundingBox()).y).toBeCloseTo(after.y,0);
 await panel.getByRole('tab',{name:'Lista',exact:true}).focus();await page.keyboard.press('ArrowRight');await expect(combo).toBeHidden();await expect(panel.locator('[data-mirc-id="5"]')).toBeVisible();await expect(panel.locator('[data-mirc-id="5"]')).toHaveAttribute('readonly','');
 await panel.getByRole('tab',{name:'Lista',exact:true}).click();await expect(combo).toBeVisible();
 await panel.locator('[data-mirc-id="4"]').fill('Texto final');await panel.locator('[data-mirc-id="4"]').press('Enter');
 await expect.poll(()=>actions.some(a=>a.text==='-s edit Texto final')).toBe(true);await expect.poll(()=>actions.some(a=>a.text==='-s saved Texto final')).toBe(true);
 await expect(panel).toBeVisible();await panel.locator('[data-mirc-id="8"]').press('Escape');await expect(panel).toHaveCount(0);
 expect(actions.some(a=>a.text==='-s cancelled')).toBe(true);expect(errors).toEqual([]);
});
