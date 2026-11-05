const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { ScriptMedia } = require("../src/services/script-media");
test("Script media exposes opaque file tokens bound to the owner and confirms the upload destination", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "dreams-media-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, "chosen.txt");
  fs.writeFileSync(file, "only selected file bytes");
  const signals = [],
    uploads = [],
    prompts = [];
  const media = new ScriptMedia({
    pick: async () => file,
    confirm: async (message, detail) => {
      prompts.push({ message, detail });
      return true;
    },
    web: {
      request: async (url, options) => {
        uploads.push({ url, options });
        return {
          status: 201,
          body: Buffer.from("uploaded"),
          headers: { location: "/file" },
        };
      },
    },
    signal: (...args) => signals.push(args),
    allowed: () => ({ domains: ["example.org"] }),
  });
  const fields = { script: "owner", network: "network", buffer: "#room" };
  await media.run(
    { type: "media.pick", args: ["-m", "*/*", "chosen", "#room"] },
    fields,
  );
  const picked = signals[0][3];
  assert.equal(picked.mediaok, "true");
  assert.ok(picked.mediatoken);
  assert.ok(!JSON.stringify(picked).includes(directory));
  await media.run(
    {
      type: "media.upload",
      args: ["https://example.org/upload", picked.mediatoken, "done"],
    },
    { ...fields, script: "other" },
  );
  assert.equal(signals[1][3].httpok, "false");
  assert.equal(uploads.length, 0);
  await media.run(
    {
      type: "media.upload",
      args: [
        "-f",
        "image",
        "https://example.org/upload",
        picked.mediatoken,
        "done",
      ],
      callers: ["owner"],
    },
    fields,
  );
  assert.equal(signals[2][3].httpok, "true");
  assert.equal(uploads.length, 1);
  assert.ok(
    uploads[0].options.body.includes(Buffer.from("only selected file bytes")),
  );
  assert.equal(
    uploads[0].options.contentLength,
    uploads[0].options.body.length,
  );
  assert.equal(uploads[0].options.redirects, 0);
  assert.equal(prompts.length, 2);
  media.clear();
  await media.run(
    {
      type: "media.upload",
      args: ["https://example.org/upload", picked.mediatoken, "done"],
    },
    fields,
  );
  assert.equal(signals[3][3].httpok, "false");
  assert.equal(uploads.length, 1);
});
