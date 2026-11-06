'use strict';
const path=require('node:path');
const root=path.resolve(__dirname,'..');
// Use RegExp objects: cmd.exe consumes unquoted ^ anchors in CLI arguments.
// Only exclude project tools; dependencies' dist/ and src/scripts/ are required.
module.exports={
  dir:root,electronVersion:require('../package.json').devDependencies.electron,...(process.env.ELECTRON_CACHE?{download:{cacheRoot:process.env.ELECTRON_CACHE}}:{}),name:'HexDreamsIRC',executableName:'HexDreamsIRC',icon:path.join(root,'src/assets/app.ico'),win32metadata:{CompanyName:'HexDreams IRC',FileDescription:'HexDreams IRC',ProductName:'HexDreams IRC'},platform:'win32',arch:'x64',out:path.join(root,'dist'),overwrite:true,asar:true,prune:true,
  ignore:[/^\/(?:test|test-results|scripts|dist|\.github)(?:\/|$)/,/^\/playwright[^/]*(?:\/|$)/]
};
