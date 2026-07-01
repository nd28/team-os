"use strict";
const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs");

const URL = process.env.TEAM_OS_URL || "http://localhost:5173/team-os/";

function ok(cond, msg) {
  console.log((cond ? "  PASS  " : "  FAIL  ") + msg);
  if (!cond) process.exitCode = 1;
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setCacheEnabled(false);
  await page.setViewport({ width: 1200, height: 800 });

  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console.error: " + m.text()); });

  // Add latency to PATCH so double-click window is wide
  let patchDelay = 400;
  const patches = [];
  await page.setRequestInterception(true);
  page.on("request", async (req) => {
    const u = req.url();
    if (u.includes("api.github.com")) {
      if (req.method() === "OPTIONS") return req.respond({ status: 204, headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, PATCH, POST, DELETE, OPTIONS",
        "access-control-allow-headers": "authorization, content-type, accept",
      }});
      if (req.method() === "PATCH") {
        try { patches.push(JSON.parse(req.postData())); } catch (_) {}
        // simulate slow network
        await new Promise((r) => setTimeout(r, patchDelay));
        return req.respond({ status: 200, contentType: "application/json",
          headers: { "access-control-allow-origin": "*", "x-ratelimit-remaining": "4999", "x-ratelimit-limit": "5000" },
          body: JSON.stringify({ files: {} }) });
      }
      req.respond({ status: 200, contentType: "application/json",
        headers: { "access-control-allow-origin": "*", "x-ratelimit-remaining": "4999", "x-ratelimit-limit": "5000" },
        body: JSON.stringify({
          files: {
            "auth.json": { content: JSON.stringify({ lead: { name: "Nilesh Suthar", rights: ["all"] }, developers: [] }) },
            "team.json": { content: JSON.stringify({ statusOptions: ["active"], members: [{ id: "nilesh", name: "Nilesh Suthar", status: "active" }] }) },
            "tasks.json": { content: JSON.stringify({ columns: ["backlog","todo","in-progress","done"], tasks: [], priorities: ["high","medium","low"] }) },
            "leaves.json": { content: JSON.stringify({ leaves: [] }) },
            "pending_approvals.json": { content: JSON.stringify({ requests: [] }) },
          },
        }),
      });
    } else req.continue();
  });

  await page.goto(URL + "#gist=abcdef0123");
  await new Promise((r) => setTimeout(r, 1500));
  await page.evaluate(() => {
    localStorage.setItem("tos_session", JSON.stringify({ username: "nilesh", name: "Nilesh Suthar", role: "lead", rights: ["all"] }));
    localStorage.setItem("tos_token_nilesh", "fake-pat");
  });
  await page.reload();
  await new Promise((r) => setTimeout(r, 2000));

  console.log("\n[1] Open + add, type a title");
  const addBtns = await page.$$("button.sm");
  for (const b of addBtns) {
    const t = await b.evaluate((el) => el.textContent.trim());
    if (t === "+ add") { await b.click(); break; }
  }
  await new Promise((r) => setTimeout(r, 300));
  await page.type("#tt", "Double-click test");
  ok(true, "title typed");

  console.log("\n[2] Click Save 5 times rapidly (race condition)");
  // The bug: without the guard, each click fires another proposeChange → 5 PATCHes → 5 duplicate tasks
  for (let i = 0; i < 5; i++) {
    await page.click("#tsave").catch(() => {}); // ignore "not clickable" errors from disabled button
    await new Promise((r) => setTimeout(r, 30));
  }
  await new Promise((r) => setTimeout(r, 1500));

  console.log("\n[3] Verify only ONE PATCH was sent");
  const taskPatches = patches.filter((p) => p && p.files && p.files["tasks.json"]);
  ok(taskPatches.length === 1, "exactly 1 PATCH to tasks.json: got " + taskPatches.length);
  if (taskPatches.length === 1) {
    const written = JSON.parse(taskPatches[0].files["tasks.json"].content);
    ok(written.tasks.length === 1, "tasks.json has exactly 1 task: got " + written.tasks.length);
    if (written.tasks[0]) {
      ok(written.tasks[0].title === "Double-click test", "task title correct: " + written.tasks[0].title);
    }
  }

  console.log("\n[4] Modal closed, save button no longer disabled");
  const modalGone = await page.evaluate(() => !document.querySelector(".modal .box"));
  ok(modalGone, "modal closed");

  console.log("\n[5] No JS errors");
  ok(errors.length === 0, "no console/page errors (got " + errors.length + ")");
  if (errors.length) errors.forEach((e) => console.log("    -> " + e));

  fs.mkdirSync(path.join(__dirname, "screenshots"), { recursive: true });
  await page.screenshot({ path: path.join(__dirname, "screenshots", "double-save-test.png"), fullPage: false });
  console.log("\n  saved: tests/screenshots/double-save-test.png");

  await browser.close();
  console.log("\nDone. Exit code: " + (process.exitCode || 0));
})().catch((e) => { console.error("FATAL:", e); process.exit(2); });
