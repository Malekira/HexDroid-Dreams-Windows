"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const {
  exportConfig,
  importConfig,
} = require("../src/services/config-selection");
const { sanitizeData } = require("../src/storage");
const { createBackup, readBackup } = require("../src/services/backups");
const make = (theme, host = "one.example") =>
  sanitizeData({
    settings: {
      theme,
      notifications: false,
      avatarUrlTemplate: "https://photos.example/{nick}.png",
    },
    profiles: [
      { id: "net", host, port: 6667, tls: false, nick: "Me", channels: [] },
    ],
  });
test("Selective configuration excludes networks and imports only selected sections", async () => {
  const current = make("dark"),
    other = make("light", "other.example");
  other.settings.notifications = true;
  const exported = exportConfig(other, ["appearance"]);
  assert.equal(exported.config.profiles.length, 0);
  const backup = await readBackup(
    await createBackup(
      exported.config,
      null,
      null,
      undefined,
      exported.sections,
    ),
  );
  const restored = importConfig(
    current,
    backup.config,
    ["appearance", "networks"],
    backup.sections,
  );
  assert.equal(restored.settings.theme, "light");
  assert.equal(restored.settings.notifications, false);
  assert.equal(restored.profiles[0].host, "one.example");
  assert.throws(() =>
    importConfig(current, backup.config, ["networks"], backup.sections),
  );
});
test("Network restore updates matching ids and retains unrelated networks and preferences", () => {
  const current = make("dark"),
    other = make("light", "new.example");
  current.profiles.push({
    ...current.profiles[0],
    id: "keep",
    host: "keep.example",
  });
  const restored = importConfig(current, other, ["networks"]);
  assert.equal(restored.profiles.length, 2);
  assert.equal(
    restored.profiles.find((p) => p.id === "net").host,
    "new.example",
  );
  assert.equal(
    restored.profiles.find((p) => p.id === "keep").host,
    "keep.example",
  );
  assert.equal(restored.settings.theme, "dark");
});
test('Default backup selection round-trips new writing and NOTICE preferences with networks',async()=>{
 const source=make('violet');source.settings.dictionaryEnabled=true;source.settings.dictionary=[{from:'XDD',to:'😂',enabled:true,matchCase:false}];source.settings.nickCompletion={enabled:true,template:'👋 {nick}',color:'#123abc'};source.settings.noticeDestinations=['status'];source.settings.notifyPrivates=false;source.settings.notifyMentions=true;const exported=exportConfig(source);const backup=await readBackup(await createBackup(exported.config,null,undefined,undefined,exported.sections));const restored=importConfig(make('light'),backup.config,undefined,backup.sections);assert.equal(restored.settings.dictionary[0].to,'😂');assert.equal(restored.settings.nickCompletion.template,'👋 {nick}');assert.deepEqual(restored.settings.noticeDestinations,['status']);assert.equal(restored.settings.notifyPrivates,false);assert.equal(restored.settings.notifyMentions,true);assert.equal(restored.profiles[0].host,'one.example');
});
