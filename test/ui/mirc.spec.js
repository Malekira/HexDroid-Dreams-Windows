const {test,expect}=require('@playwright/test');
test('mIRC import, rejection feedback, activation and removal use their own controls',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  let addons=[],reject=false;const listeners=[];
  window.dreams={
   load:async()=>({settings:{fontSize:14,sidebarWidth:240,showUsers:true,timestamps:true,showEvents:true,compact:false,autoScroll:true},profiles:[],version:'0.39.0',warnings:[]}),
   save:async data=>data,onEvent:cb=>listeners.push(cb),copy:async()=>({ok:true}),quit:async()=>{},
   advanced:async(name,data={})=>{
    if(name==='status')return {scripts:[],mircScripts:addons,mircError:null,transfers:[],crypto:{},debug:[],launchers:[],aliases:[]};
    if(name==='script.mirc.import'){
     if(reject)return {error:'Comando mSL todavía no soportado: timer'};
     addons=[{id:'sample',name:'moderacion.mrc',enabled:true,aliases:['darvoz']}];return {id:'sample'};
    }
    if(name==='script.mirc.configure'){addons[0].enabled=data.enabled;return {ok:true};}
    if(name==='script.mirc.remove'){addons=[];return {ok:true};}
    if(name==='script.mirc.inspect')return {name:'otro.mrc',encoding:'UTF-8',declarations:[],dependencies:[],diagnostics:[],message:'Lectura sin ejecución.'};
    if(name.endsWith('.list')||name==='script.commands'||name==='script.menus')return [];
    return {};
   }
  };window.__rejectMirc=()=>reject=true;
 });
 await page.goto('http://127.0.0.1:4173');
 await page.waitForFunction(()=>typeof window.openDreamsAdvanced==='function');
 await page.evaluate(()=>window.openDreamsAdvanced('scripts'));
 await page.getByText('Compatibilidad mIRC · alias y JOIN',{exact:true}).click();
 await page.getByRole('button',{name:'Importar alias .mrc/.xcr…',exact:true}).click();
 await expect(page.getByRole('checkbox',{name:'Activar moderacion.mrc',exact:true})).toBeChecked();
 await expect(page.locator('.mirc-addon-row')).toContainText('/darvoz');
 await page.getByRole('checkbox',{name:'Activar moderacion.mrc',exact:true}).uncheck();
 await expect(page.getByRole('checkbox',{name:'Activar moderacion.mrc',exact:true})).not.toBeChecked();
 await page.locator('.mirc-addon-row').getByRole('button',{name:'Eliminar',exact:true}).click();
 await expect(page.locator('.mirc-addon-row')).toHaveCount(0);
 await page.getByText('Compatibilidad mIRC · alias y JOIN',{exact:true}).click();
 await page.evaluate(()=>window.__rejectMirc());
 await page.getByRole('button',{name:'Importar alias .mrc/.xcr…',exact:true}).click();
 await expect(page.locator('#settings-feedback')).toContainText('no soportado: timer');
 await expect(page.locator('.mirc-addon-row')).toHaveCount(0);
 expect(errors).toEqual([]);
});
