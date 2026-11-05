const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const{SecretVault}=require('../src/services/vault');const{HistoryStore}=require('../src/services/history');const{createBackup,readBackup}=require('../src/services/backups');const{DEFAULTS}=require('../src/storage');
function temp(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dreams-advanced-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
test('Vault rejects plaintext fallback and stores only encrypted values with a secure provider',t=>{
  const dir=temp(t);const key=crypto.randomBytes(32);const adapter={isEncryptionAvailable:()=>true,encryptString:text=>{const n=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',key,n);return Buffer.concat([n,c.update(text),c.final(),c.getAuthTag()]);},decryptString:b=>{const c=crypto.createDecipheriv('aes-256-gcm',key,b.subarray(0,12));c.setAuthTag(b.subarray(-16));return Buffer.concat([c.update(b.subarray(12,-16)),c.final()]).toString();}};
  const vault=new SecretVault(dir,adapter);vault.set('network',{password:'not-in-plaintext'});assert.ok(!fs.readFileSync(vault.file).includes(Buffer.from('not-in-plaintext')));assert.equal(new SecretVault(dir,adapter).get('network').password,'not-in-plaintext');
  assert.throws(()=>new SecretVault(dir,{isEncryptionAvailable:()=>false}).get('network'),/no está disponible/);
  assert.throws(()=>new SecretVault(dir,{isEncryptionAvailable:()=>true,getSelectedStorageBackend:()=> 'basic_text'}).get('network'),/sin cifrar/);
});
test('History separates networks, deduplicates msgids and supports indexed search and redaction',t=>{
  const h=new HistoryStore(temp(t));t.after(()=>h.close());const m={target:'#room',nick:'Alice',text:'a searchable phrase',messageId:'m1',time:new Date().toISOString()};
  assert.equal(h.append('one',m),true);assert.equal(h.append('one',m),false);assert.equal(h.append('two',m),true);
  assert.equal(h.query({network:'one',text:'searchable phrase'}).length,1);assert.equal(h.query({network:'two',nick:'alice'}).length,1);
  h.redact('one','m1');assert.equal(h.query({network:'one'}).length,0);assert.equal(h.query({network:'two'}).length,1);
});
test('Backup requires strong passphrase for secrets and rejects altered authentication tags',async()=>{
  const config={settings:DEFAULTS,profiles:[]};await assert.rejects(createBackup(config,{password:'secret'},'short'));
  const text=await createBackup(config,{password:'secret'},'a long backup passphrase');assert.ok(!text.includes('"password"'));
  assert.equal((await readBackup(text,'a long backup passphrase')).secrets.password,'secret');await assert.rejects(readBackup(text,'wrong passphrase'));
  const broken=JSON.parse(text);broken.secrets.tag=Buffer.alloc(16).toString('base64');await assert.rejects(readBackup(JSON.stringify(broken),'a long backup passphrase'));
});
