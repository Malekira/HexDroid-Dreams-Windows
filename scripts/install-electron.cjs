'use strict';
const {spawnSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const directory=path.dirname(require.resolve('electron/package.json'));
const normal=spawnSync(process.execPath,[path.join(directory,'install.js')],{stdio:'inherit'});
if(normal.status===0)process.exit(0);
if(process.platform!=='win32')process.exit(normal.status||1);
// Keep the official artifact URL, pinned version, checksum and @electron/get
// cache. Only the HTTP downloader changes when Node's fetch receives a 504.
(async()=>{
  const {downloadArtifact}=await import('@electron/get');
  const {version}=require('electron/package.json');
  const zip=await downloadArtifact({version,artifactName:'electron',platform:'win32',arch:process.arch,checksums:require('electron/checksums.json'),downloader:{
    async download(url,destination){
      const result=spawnSync('curl.exe',['--fail','--location','--retry','3','--retry-delay','2','--connect-timeout','30','--max-time','180','--output',destination,url],{stdio:'inherit'});
      if(result.error||result.status!==0)throw result.error||new Error('No se pudo descargar Electron desde su origen oficial.');
    }
  }});
  const {extract}=require('@electron-internal/extract-zip');
  await extract(zip,{dir:path.join(directory,'dist')});
  if(fs.readFileSync(path.join(directory,'dist','version'),'utf8').trim().replace(/^v/,'')!==version)throw new Error('Version de Electron no valida.');
  fs.writeFileSync(path.join(directory,'path.txt'),'electron.exe');
})().catch(error=>{console.error(error);process.exitCode=1;});
