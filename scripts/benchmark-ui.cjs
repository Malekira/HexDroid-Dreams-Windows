const path = require("node:path"),
  root = path.resolve(__dirname, "..");
const { chromium } = require("@playwright/test");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
(async () => {
  let occupied=false;try{occupied=(await fetch('http://127.0.0.1:4173')).ok;}catch{}
  if(occupied)throw new Error('El puerto 4173 está ocupado. Cierra las pruebas de interfaz antes de medir.');
  const server = spawn(process.execPath, ["scripts/serve-ui.js"], {
    cwd: root,
    stdio: "ignore",
  });
  let browser;
  try {
    for (let i = 0; i < 50; i++) {
      try {
        if ((await fetch("http://127.0.0.1:4173")).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    });
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    await page.addInitScript(() => {
      window.dreams = {
        load: async () => ({
          profiles: [],
          settings: {
            fontSize: 14,
            showUsers: true,
            showEvents: true,
            autoScroll: true,
            showMessageAvatars: true,
            showAvatars: true,
            fontFamily: "Segoe UI",
            lineHeight: 1.65,
            messageSpacing: 9,
          },
          version: "test",
        }),
        save: async (d) => d,
        onEvent() {},
        advanced: async (name) =>
          ["presence.status", "notifications.list", "script.commands"].includes(
            name,
          )
            ? []
            : { scripts: [], debug: [] },
      };
    });
    await page.goto("http://127.0.0.1:4173");
    await page.waitForFunction(
      () => typeof window.arrangeDreamsWindows === "function",
    );
    const result = await page.evaluate(() => {
      config.profiles = [
        {
          id: "bench",
          name: "Prueba",
          host: "localhost",
          nick: "Me",
          channels: [],
        },
      ];
      workspace.profiles = config.profiles;
      const n = network("bench");
      n.state = "connected";
      n.nick = "Me";
      for (let i = 0; i < 6; i++) {
        const c = conversation("bench", "#room" + i);
        c.joined = true;
        c.users = Array.from({ length: 150 }, (_, j) => "User" + j);
        c.messages = Array.from({ length: 600 }, (_, j) => ({
          id: i + "-" + j,
          nick: "User" + (j % 150),
          text:
            "Mensaje " +
            j +
            " con \x0306color\x0f y texto para medir la interfaz.",
          time: "2026-11-10T20:00:00Z",
          own: false,
        }));
        c.revision = 1;
      }
      choose("bench", "#room0");
      let formats = 0;
      const original = DreamsFormatting.render;
      DreamsFormatting.render = (...args) => {
        formats++;
        return original(...args);
      };
      const times = [];
      for (let j = 0; j < 12; j++) {
        const start = performance.now();
        choose("bench", "#room" + (j % 6));
        times.push(performance.now() - start);
      }
      const c = selected(),
        last = $("messages").querySelector("[data-message-id]");
      const start = performance.now();
      c.messages.push({
        id: "new",
        nick: "User0",
        text: "Nuevo mensaje",
        time: "2026-11-10T20:01:00Z",
      });
      render(true);
      return {
        switchMedianMs: times.sort((a, b) => a - b)[6],
        switchMaxMs: Math.max(...times),
        formatCalls: formats,
        newMessageMs: performance.now() - start,
        preservesFirstRow: $("messages").contains(last),
        domNodes: document.querySelectorAll("*").length,
      };
    });
    const output =
      process.argv[2] || path.join(root, "dist", "interface-benchmark.json");
    fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
    console.log(result);
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
