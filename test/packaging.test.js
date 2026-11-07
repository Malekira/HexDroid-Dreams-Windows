const{test}=require('node:test'),assert=require('node:assert/strict');const options=require('../scripts/packaging-options');
test('Packaging excludes only root build/test tools and preserves production dependency dist folders and script workers',()=>{
 const excluded=path=>options.ignore.some(pattern=>pattern.test(path));
 for(const path of ['/dist/app.exe','/test/unit.js','/scripts/build-windows.mjs','/.github/workflows/windows.yml','/playwright.config.js'])assert.equal(excluded(path),true,path);
 for(const path of ['/src/scripts/worker.js','/src/scripts/interpreter.js','/node_modules/ip-address/dist/ip-address.js','/node_modules/egoroof-blowfish/dist/blowfish.mjs','/node_modules/selfsigned/index.js','/src/main.js'])assert.equal(excluded(path),false,path);
});
