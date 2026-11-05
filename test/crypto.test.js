const { test } = require("node:test");
const assert = require("node:assert/strict");
const P = require("../src/crypto/primitives"),
  A = require("../src/crypto/age");
const { AgmCipher, FishCipher } = require("../src/crypto/symmetric");
const { AgeNetwork } = require("../src/crypto/manager");
test("AGM uses canonical private AAD and rejects tampering, cross-target replay and duplicate nonces", () => {
  const key = P.crypto.randomBytes(32),
    a = new AgmCipher(key),
    b = new AgmCipher(key),
    wire = a.encrypt("hello", "Alice", "Bob");
  assert.equal(b.decrypt(wire, "Bob", "Alice"), "hello");
  assert.throws(() => b.decrypt(wire, "Bob", "Alice"), /Repetición/);
  assert.throws(() => new AgmCipher(key).decrypt(wire, "Carol", "Alice"));
  const raw = P.b64(wire.slice(5));
  raw[20] ^= 1;
  assert.throws(() =>
    new AgmCipher(key).decrypt(
      "+AGM " + raw.toString("base64"),
      "Bob",
      "Alice",
    ),
  );
});
test("FiSH CBC round-trips UTF-8 and aligns zero padding without adding plaintext prefixes", () => {
  const c = new FishCipher(Buffer.from("test-key"));
  for (const text of ["hello", "12345678", "hola 👋"]) {
    const wire = c.encrypt(text);
    assert.ok(wire.startsWith("+OK *"));
    assert.equal(c.decrypt(wire), text);
  }
});
test("AGE signed identity and sealed boxes bind keys and recipients", () => {
  const a = A.identity(),
    b = A.identity(),
    wire = A.ident(a);
  assert.equal(A.fingerprint(A.parseIdent(wire)), A.fingerprint(a));
  const parts = wire.split(" ");
  parts[4] = b.dhPub.toString("base64");
  assert.throws(() => A.parseIdent(parts.join(" ")));
  const box = A.box(b.dhPub, Buffer.from("secret"), Buffer.from("aad"));
  assert.equal(A.unbox(b, box, Buffer.from("aad")).toString(), "secret");
  assert.throws(() => A.unbox(a, box, Buffer.from("aad")));
});
test("AGE v2 handshake binds transcript and double ratchet rolls back after a forged message", () => {
  const a = A.identity(),
    b = A.identity(),
    ea = A.ephemeral(),
    eb = A.ephemeral();
  const hello = A.hello(a, ea, b);
  assert.deepEqual(A.openHello(b, hello, a), ea.pub);
  const ack = A.ack(b, eb, a, ea.pub);
  assert.deepEqual(A.openAck(a, ack, b, ea.pub), eb.pub);
  assert.throws(() => A.openAck(a, ack, b, A.ephemeral().pub));
  const ar = new A.Ratchet(A.shared(a, ea, b, eb.pub, true), ea, eb.pub, true),
    br = new A.Ratchet(A.shared(b, eb, a, ea.pub, false), eb, ea.pub, false),
    ad = Buffer.from("conversation");
  const m1 = ar.encrypt(Buffer.from("first"), ad),
    m2 = ar.encrypt(Buffer.from("second"), ad);
  const forged = { ...m2, ciphertext: Buffer.from(m2.ciphertext) };
  forged.ciphertext[0] ^= 1;
  assert.throws(() => br.decrypt(forged, ad));
  assert.equal(br.decrypt(m2, ad).toString(), "second");
  assert.equal(br.decrypt(m1, ad).toString(), "first");
  assert.throws(() => br.decrypt(m1, ad));
  const reply = br.encrypt(Buffer.from("reply"), ad);
  assert.equal(ar.decrypt(reply, ad).toString(), "reply");
});
test("AGE groups verify sender signatures, replay counters, epoch and invitation membership", () => {
  const a = A.identity(),
    b = A.identity(),
    key = P.crypto.randomBytes(32),
    ag = new A.Group("#room", key, a),
    bg = new A.Group("#room", key, b);
  bg.members.set(A.fingerprint(a), a.sigPub);
  const m = ag.encrypt(Buffer.from("hello"));
  assert.equal(bg.decrypt(m).toString(), "hello");
  assert.throws(() => bg.decrypt(m));
  assert.throws(() => bg.decrypt({ ...m, epoch: 1 }));
  const blob = A.invite(a, b, "Bob", {
    id: "#room",
    key,
    members: [{ nick: "Bob", fp: A.fingerprint(b) }],
    issued: Date.now(),
    expires: Date.now() + 60000,
  });
  assert.equal(A.openInvite(b, "Bob", blob, a).id, "#room");
  assert.throws(() => A.openInvite(b, "Mallory", blob, a));
});
test("AGE fragments reassemble with hard limits and prohibit nesting", () => {
  const line = "AGE CHAT " + "a".repeat(3000),
    frames = A.fragments(line, "#room"),
    f = new A.Fragments();
  let result;
  for (const frame of frames.reverse())
    result = f.receive("Alice", frame) || result;
  assert.equal(result, line);
  assert.throws(() => f.receive("Alice", "AGE FRAG id 1/65 YQ=="));
  assert.throws(() =>
    f.receive(
      "Alice",
      "AGE FRAG id 1/1 " + Buffer.from("AGE FRAG nested").toString("base64"),
    ),
  );
});
test("Two AGE networks negotiate PMs without leaking plaintext and refuse identity changes", () => {
  const queue = [],
    deliveries = [],
    alice = { state: {}, nick: () => "Alice" },
    bob = { state: {}, nick: () => "Bob" };
  let a, b;
  a = new AgeNetwork({
    ...alice,
    save: () => {},
    wire: (target, line) => queue.push(() => b.receive("Alice", "Alice", line)),
  });
  b = new AgeNetwork({
    ...bob,
    save: () => {},
    wire: (target, line) => queue.push(() => a.receive("Bob", "Bob", line)),
  });
  a.on("delivery", (d) => deliveries.push(d));
  a.enable("Bob");
  b.enable("Alice");
  for (let i = 0; queue.length && i < 50; i++) queue.shift()();
  const frames = a.encrypt("Bob", "private message", { clientId: "id" });
  assert.ok(frames.every((f) => !f.includes("private message")));
  let text;
  for (const frame of frames) text = b.receive("Alice", "Alice", frame) || text;
  assert.equal(text, "private message");
  let conflict = false;
  b.on("security", (event) => {
    if (event.type === "identity-conflict") conflict = true;
  });
  b.receive("Alice", "Alice", A.ident(A.identity()));
  assert.equal(conflict, true);
});
test("AGM and FiSH decrypt independent Java JCE wire vectors used by the Android formats", () => {
  const vector = require("./fixtures/symmetric-jce.json"),
    key = Buffer.from(vector.key, "base64");
  assert.equal(
    new AgmCipher(key).decrypt(vector.agm, "Alice", vector.target),
    vector.text,
  );
  assert.equal(new FishCipher(key).decrypt(vector.fish), vector.text);
});
