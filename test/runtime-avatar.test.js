"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path");
const { Runtime } = require("../src/services/runtime");
function fixture() {
  const bytes = fs.readFileSync(path.join(__dirname, "../src/assets/tray.png")),
    client = { nick: "Me", userStates: new Map() },
    requests = [];
  const context = {
    getConfig: () => ({
      settings: {
        mediaEnabled: true,
        autoAvatars: true,
        showAvatars: true,
        avatarUrlTemplate: "https://photos.example/{Nick}.png",
      },
      profiles: [{ id: "net", nick: "Me" }],
    }),
    sessions: { get: () => client },
    avatarCache: new Map(),
    web: {
      request: async (url) => {
        requests.push(url);
        return { status: 200, body: bytes };
      },
    },
    electron: {
      nativeImage: {
        createFromBuffer: () => ({
          isEmpty: () => false,
          getSize: () => ({ width: 80, height: 40 }),
          resize: () => ({ toDataURL: () => "data:image/png;base64,fixture" }),
        }),
      },
    },
  };
  context.resolvePhoto = Runtime.prototype.resolvePhoto.bind(context);
  return {
    context,
    client,
    requests,
    bytes,
    load: () =>
      Runtime.prototype.action.call(context, "avatar.load", {
        network: "net",
        nick: "Alice",
      }),
  };
}
test("Automatic thumbnails use announced metadata instead of the nick template and respect an explicit removal", async () => {
  const f = fixture();
  f.client.userStates.set("alice", {
    metadata: { avatar: "https://photos.example/announced.png?v=2" },
    avatarVersion: 1,
  });
  assert.ok((await f.load()).image);
  assert.deepEqual(f.requests, ["https://photos.example/announced.png?v=2"]);
  f.client.userStates.set("alice", {
    metadata: { avatar: "" },
    avatarVersion: 2,
  });
  assert.equal((await f.load()).empty, true);
  assert.equal(f.requests.length, 1);
});
test("A download that completes after newer metadata arrives cannot replace the new avatar", async () => {
  const f = fixture();
  let finish;
  f.client.userStates.set("alice", {
    legacyPhoto: "/old.png",
    avatarVersion: 1,
  });
  f.context.web.request = (url) => {
    f.requests.push(url);
    return new Promise((resolve) => (finish = resolve));
  };
  const pending = f.load();
  f.client.userStates.set("alice", {
    metadata: { avatar: "https://photos.example/new.png" },
    avatarVersion: 2,
  });
  finish({ status: 200, body: f.bytes });
  assert.equal((await pending).stale, true);
  assert.equal(f.context.avatarCache.size, 0);
});
test("An unconfigured metadata domain never starts an automatic download", async () => {
  const f = fixture();
  f.client.userStates.set("alice", {
    metadata: { avatar: "https://unconfigured.example/photo.png" },
    avatarVersion: 1,
  });
  assert.equal((await f.load()).blocked, true);
  assert.equal(f.requests.length, 0);
});
