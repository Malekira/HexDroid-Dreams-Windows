'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {inspect,parse}=require('../src/scripts/mirc/importer');
const iconv=require('iconv-lite');
test('native declarations stay separate from HexVM and never execute LOAD',()=>{
 const report=inspect(Buffer.from('on *:LOAD:{\n run forbidden.exe\n}\nalias demo {\n echo hello\n}\nraw 367:*:{\n echo $1-\n}\ndialog panel {\n title "Panel"\n}\nmenu nicklist {\n Demo:demo\n}\n#guard off\n#guard end'),'sample.mrc');
 assert.equal(report.executable,false);assert.equal(report.stage,'inspection');
 assert.deepEqual(report.declarations.map(d=>d.type),['on','alias','raw','dialog','menu','group','group']);
 assert.deepEqual(report.diagnostics,[]);
});
test('legacy accents, text-only limits and dependency references',()=>{
 const result=inspect(iconv.encode('; configuración\nalias a {\n load -rs addons\\modera.mrc\n}\n','windows-1252'));
 assert.equal(result.encoding,'Windows-1252');assert.deepEqual(result.dependencies,['addons\\modera.mrc']);
 assert.throws(()=>inspect(Buffer.from([0,1])),/texto/);assert.throws(()=>inspect(Buffer.alloc(262145)),/256/);
});
test('unsupported declarations and incomplete source are reported without claiming execution',()=>{
 assert.equal(parse('alias missing {\n echo hi').diagnostics[0].code,'unclosed-block');
 assert.equal(parse('a { echo hi }').declarations[0].type,'alias');
 assert.equal(parse('; comment\nalias a { echo {Nick} }').declarations.length,1);
});
test('inspection distinguishes an executable alias subset from declarations still awaiting implementation',()=>{
 assert.equal(inspect(Buffer.from('alias sample { echo -s hello }')).compatibility.supported,true);
 const result=inspect(Buffer.from('alias sample { sockopen x host 80 }'));
 assert.equal(result.compatibility.supported,false);assert.match(result.compatibility.message,/sockopen/);assert.equal(result.executable,false);
});
