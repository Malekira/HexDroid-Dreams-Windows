const { test } = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os");
const { DccManager, parseOffer, safeName } = require("../src/services/dcc");
async function until(predicate) {
  for (let i = 0; i < 500; i++) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  assert.fail("La transferencia no terminó.");
}
test("DCC parser handles quoted names, IPv4 numeric and IPv6 without path traversal", () => {
  assert.equal(
    parseOffer('SEND "a b.txt" 2130706433 1234 20').host,
    "127.0.0.1",
  );
  assert.equal(parseOffer("CHAT chat ::1 1234").host, "::1");
  assert.equal(safeName("../../escape.txt"), "escape.txt");
  assert.throws(() => safeName("CON.txt"));
  assert.throws(() => parseOffer("SEND file 0 10 20"));
  assert.throws(() => parseOffer("SEND file 127.0.0.1 70000 5"));
  assert.throws(() => parseOffer("SEND file 127.0.0.1 0 5"));
});
test("DCC SEND requires acceptance, streams real TCP bytes and preserves both source and destination", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dreams-dcc-")),
    out = path.join(root, "received"),
    source = path.join(root, "source.txt");
  fs.writeFileSync(source, "real DCC bytes\n".repeat(10000));
  let sender, receiver;
  const settings = () => ({
    dccAddress: "127.0.0.1",
    dccBind: "127.0.0.1",
    dccMaxBytes: 1000000,
  });
  sender = new DccManager({
    directory: path.join(root, "sender"),
    settings,
    send: (network, nick, line) =>
      receiver.offer(network, "Alice", line.slice(4)),
  });
  receiver = new DccManager({
    directory: out,
    settings,
    send: (network, nick, line) => sender.offer(network, "Bob", line.slice(4)),
  });
  t.after(() => {
    sender.close();
    receiver.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const sent = await sender.sendFile("network", "Bob", source);
  assert.equal(sent.state, "offered");
  const offered = receiver.list()[0];
  assert.equal(offered.state, "offered");
  assert.ok(!fs.existsSync(path.join(out, "source.txt")));
  await receiver.accept(offered.id);
  await until(() => receiver.list()[0].state === "done");
  assert.deepEqual(
    fs.readFileSync(path.join(out, "source.txt")),
    fs.readFileSync(source),
  );
  await until(() => sender.list()[0].state === "done");
  assert.equal(sender.list()[0].bytes, fs.statSync(source).size);
});
test("DCC CHAT uses an explicitly accepted independent TCP session", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dreams-dcc-chat-"));
  let a, b;
  const settings = () => ({ dccAddress: "127.0.0.1", dccBind: "127.0.0.1" });
  a = new DccManager({
    directory: path.join(root, "a"),
    settings,
    send: (network, nick, line) => b.offer(network, "Alice", line.slice(4)),
  });
  b = new DccManager({
    directory: path.join(root, "b"),
    settings,
    send: () => {},
  });
  t.after(() => {
    a.close();
    b.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const av = await a.startChat("network", "Bob"),
    bv = b.list()[0];
  await b.accept(bv.id);
  await until(
    () => a.list()[0].state === "active" && b.list()[0].state === "active",
  );
  let received;
  b.on("chat", (m) => {
    received = m;
  });
  a.sendChat(av.id, "hello over DCC");
  await until(() => received);
  assert.equal(received.text, "hello over DCC");
});
for (const secure of [false, true])
  test(
    "DCC " +
      (secure ? "SSEND with verified TLS" : "passive SEND") +
      " transfers actual bytes",
    async (t) => {
      const root = fs.mkdtempSync(
        path.join(os.tmpdir(), "dreams-dcc-advanced-"),
      );
      const source = path.join(root, "payload.bin");
      fs.writeFileSync(source, require("node:crypto").randomBytes(200000));
      let a, b;
      const settings = () => ({
        dccAddress: "127.0.0.1",
        dccBind: "127.0.0.1",
      });
      let material;
      if (secure) {
        const certificate = await require("selfsigned").generate(
          [{ name: "commonName", value: "127.0.0.1" }],
          {
            keyType: "ec",
            curve: "P-256",
            extensions: [
              {
                name: "subjectAltName",
                altNames: [{ type: 7, ip: "127.0.0.1" }],
              },
            ],
          },
        );
        material = { cert: certificate.cert, key: certificate.private };
      }
      a = new DccManager({
        directory: path.join(root, "a"),
        settings,
        tlsMaterial: async () => material,
        send: (network, nick, line) => b.offer(network, "Alice", line.slice(4)),
      });
      b = new DccManager({
        directory: path.join(root, "b"),
        settings,
        trust: () => material?.cert,
        send: (network, nick, line) => a.offer(network, "Bob", line.slice(4)),
      });
      t.after(() => {
        a.close();
        b.close();
        fs.rmSync(root, { recursive: true, force: true });
      });
      await a.sendFile("network", "Bob", source, { secure, passive: !secure });
      const offer = b.list()[0];
      await b.accept(offer.id);
      await until(
        () => b.list()[0].state === "done" || b.list()[0].state === "failed",
      );
      assert.equal(b.list()[0].state, "done", b.list()[0].error);
      await until(() => a.list()[0].state === "done");
      assert.deepEqual(
        fs.readFileSync(path.join(root, "b", "payload.bin")),
        fs.readFileSync(source),
      );
    },
  );
test("DCC resume exchanges RESUME/ACCEPT and preserves the partial prefix", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dreams-dcc-resume-"));
  const source = path.join(root, "payload.bin"),
    payload = require("node:crypto").randomBytes(200000);
  fs.writeFileSync(source, payload);
  let a, b;
  const sent = [];
  const settings = () => ({ dccAddress: "127.0.0.1", dccBind: "127.0.0.1" });
  a = new DccManager({
    directory: path.join(root, "a"),
    settings,
    send: (network, nick, line) => {
      sent.push(line);
      b.offer(network, "Alice", line.slice(4));
    },
  });
  b = new DccManager({
    directory: path.join(root, "b"),
    settings,
    send: (network, nick, line) => {
      sent.push(line);
      a.offer(network, "Bob", line.slice(4));
    },
  });
  t.after(() => {
    a.close();
    b.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  await a.sendFile("network", "Bob", source);
  const transfer = b.transfers.values().next().value;
  fs.mkdirSync(path.join(root, "b"), { recursive: true });
  transfer.partial = path.join(root, "b", ".partial");
  transfer.destination = path.join(root, "b", "payload.bin");
  fs.writeFileSync(transfer.partial, payload.subarray(0, 12345));
  await b.accept(transfer.id, { resume: true });
  await until(() => transfer.state === "done" || transfer.state === "failed");
  assert.equal(transfer.state, "done", transfer.error);
  assert.deepEqual(fs.readFileSync(transfer.destination), payload);
  assert.ok(sent.some((line) => line.includes("DCC RESUME")));
  assert.ok(sent.some((line) => line.includes("DCC ACCEPT")));
});
