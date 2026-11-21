const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { SecretVault } = require("../src/services/vault");
const { HistoryStore } = require("../src/services/history");
const { createBackup, readBackup } = require("../src/services/backups");
const { DEFAULTS } = require("../src/storage");
function temp(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dreams-advanced-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
test("Vault rejects plaintext fallback and stores only encrypted values with a secure provider", (t) => {
  const dir = temp(t);
  const key = crypto.randomBytes(32);
  const adapter = {
    isEncryptionAvailable: () => true,
    encryptString: (text) => {
      const n = crypto.randomBytes(12),
        c = crypto.createCipheriv("aes-256-gcm", key, n);
      return Buffer.concat([n, c.update(text), c.final(), c.getAuthTag()]);
    },
    decryptString: (b) => {
      const c = crypto.createDecipheriv("aes-256-gcm", key, b.subarray(0, 12));
      c.setAuthTag(b.subarray(-16));
      return Buffer.concat([
        c.update(b.subarray(12, -16)),
        c.final(),
      ]).toString();
    },
  };
  const vault = new SecretVault(dir, adapter);
  vault.set("network", { password: "not-in-plaintext" });
  assert.ok(
    !fs.readFileSync(vault.file).includes(Buffer.from("not-in-plaintext")),
  );
  assert.equal(
    new SecretVault(dir, adapter).get("network").password,
    "not-in-plaintext",
  );
  assert.throws(
    () =>
      new SecretVault(dir, { isEncryptionAvailable: () => false }).get(
        "network",
      ),
    /no está disponible/,
  );
  assert.throws(
    () =>
      new SecretVault(dir, {
        isEncryptionAvailable: () => true,
        getSelectedStorageBackend: () => "basic_text",
      }).get("network"),
    /sin cifrar/,
  );
});
test("History separates networks, deduplicates msgids and supports indexed search and redaction", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "dreams-history-"));
  const h = new HistoryStore(directory);
  t.after(() => {
    h.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const m = {
    target: "#room",
    nick: "Alice",
    text: "a searchable phrase",
    messageId: "m1",
    time: new Date().toISOString(),
  };
  assert.equal(h.append("one", m), true);
  assert.equal(h.append("one", m), false);
  assert.equal(h.append("two", m), true);
  assert.equal(
    h.query({ network: "one", text: "searchable phrase" }).length,
    1,
  );
  assert.equal(h.query({ network: "two", nick: "alice" }).length, 1);
  h.redact("one", "m1");
  assert.equal(h.query({ network: "one" }).length, 0);
  assert.equal(h.query({ network: "two" }).length, 1);
});
test("Backup requires strong passphrase for secrets and rejects altered authentication tags", async () => {
  const config = { settings: DEFAULTS, profiles: [] };
  await assert.rejects(createBackup(config, { password: "secret" }, "short"));
  const text = await createBackup(
    config,
    { password: "secret" },
    "a long backup passphrase",
  );
  assert.ok(!text.includes('"password"'));
  assert.equal(
    (await readBackup(text, "a long backup passphrase")).secrets.password,
    "secret",
  );
  await assert.rejects(readBackup(text, "wrong passphrase"));
  const broken = JSON.parse(text);
  broken.secrets.tag = Buffer.alloc(16).toString("base64");
  await assert.rejects(
    readBackup(JSON.stringify(broken), "a long backup passphrase"),
  );
});
test("Protocol diagnostics redact credentials and all message content before encrypted persistence", () => {
  const { redactProtocol } = require("../src/services/protocol-log");
  for (const line of [
    "PASS password",
    "AUTHENTICATE c2VjcmV0",
    "OPER name password",
    "PRIVMSG NickServ :IDENTIFY password",
    "@label=secret PRIVMSG #room :private text",
    "BOUNCER ADDNETWORK server password",
    "MODE #secret +k password",
    "FAIL WEBPUSH INVALID https://endpoint/password",
  ]) {
    const redacted = redactProtocol(line);
    assert.ok(!redacted.includes("password"));
    assert.ok(!redacted.includes("private text"));
    assert.ok(!redacted.includes("c2VjcmV0"));
    assert.ok(!redacted.includes("label=secret"));
  }
  assert.equal(redactProtocol("PING :keepalive"), "PING :keepalive");
});
test('Backups optionally include validated conversation and query history and remain compatible with old backups',async()=>{
 const config={settings:{...DEFAULTS},profiles:[{id:'net',name:'Test',host:'localhost',port:6667,tls:false,nick:'Me',channels:[]}]};
 const rows=[{network:'net',target:'#room',nick:'Alice',text:'\x0313Hola 🦆',time:new Date().toISOString(),own:false},{network:'net',target:'*consultas*',nick:'Servidor',text:'Alice user host',time:new Date().toISOString()}];
 const text=await createBackup(config,null,null,rows),restored=await readBackup(text);assert.equal(restored.history.length,2);assert.equal(restored.history[0].text,rows[0].text);assert.equal(restored.history[1].target,'*consultas*');const events=await readBackup(await createBackup(config,null,null,[{...rows[0],event:true,text:'Alice salió'}]));assert.equal(events.history[0].event,true);assert.equal((await readBackup(await createBackup(config))).history,undefined);
 const invalid=JSON.parse(text);invalid.history[0].network='unknown';await assert.rejects(()=>readBackup(JSON.stringify(invalid)),/Historial/);invalid.history=rows.map(m=>({...m,time:'bad'}));await assert.rejects(()=>readBackup(JSON.stringify(invalid)),/Historial/);
});
test('History upgrades existing databases without losing messages and preserves room event flags after reopening',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dreams-history-upgrade-'));const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(path.join(dir,'history.sqlite'));db.exec("CREATE TABLE messages(id INTEGER PRIMARY KEY,network TEXT NOT NULL,target TEXT NOT NULL,nick TEXT NOT NULL,text TEXT NOT NULL,time TEXT NOT NULL,msgid TEXT,clientid TEXT,action INTEGER DEFAULT 0,own INTEGER DEFAULT 0); INSERT INTO messages(network,target,nick,text,time) VALUES('one','#room','Alice','Anterior','2026-11-08T00:00:00Z');");db.close();let h=new HistoryStore(dir);t.after(()=>{h.close();fs.rmSync(dir,{recursive:true,force:true});});assert.equal(h.query({})[0].event,0);h.append('one',{target:'#room',event:true,text:'Alice salió',time:'2026-11-08T01:00:00Z'});h.close();h=new HistoryStore(dir);assert.equal(h.query({}).length,2);assert.equal(h.query({text:'salió'})[0].event,1);
});
