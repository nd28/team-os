"use strict";
const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs");

const URL = process.env.TEAM_OS_URL || "http://localhost:5173/team-os/";

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

  // stub network — track PATCH writes
  let lastPatch = null;
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const u = req.url();
    if (u.includes("api.github.com")) {
      if (req.method() === "OPTIONS") return req.respond({ status: 204, headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, PATCH, POST, DELETE, OPTIONS",
        "access-control-allow-headers": "authorization, content-type, accept",
      }});
      if (req.method() === "PATCH") {
        try { lastPatch = JSON.parse(req.postData()); } catch (_) {}
        return req.respond({ status: 200, contentType: "application/json",
          headers: { "access-control-allow-origin": "*", "x-ratelimit-remaining": "4999", "x-ratelimit-limit": "5000" },
          body: JSON.stringify({ files: {} }) });
      }
      req.respond({
        status: 200, contentType: "application/json",
        headers: { "access-control-allow-origin": "*", "x-ratelimit-remaining": "4999", "x-ratelimit-limit": "5000" },
        body: JSON.stringify({
          files: {
            "auth.json": { content: JSON.stringify({ lead: { name: "Nilesh Suthar", rights: ["all"] }, developers: [] }) },
            "team.json": { content: JSON.stringify({ statusOptions: ["active","remote","away","on-leave"], members: [{ id: "nilesh", name: "Nilesh Suthar", status: "active" }] }) },
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

  console.log("\n[1] Click + add on backlog column");
  // click first + add button (in backlog column)
  const addBtns = await page.$$("button.sm");
  let addBtn = null;
  for (const b of addBtns) {
    const t = await b.evaluate((el) => el.textContent.trim());
    if (t === "+ add") { addBtn = b; break; }
  }
  ok(!!addBtn, "+ add button found");
  await addBtn.click();
  await new Promise((r) => setTimeout(r, 400));

  // modal should be open
  const modalOpen = await page.evaluate(() => !!document.querySelector(".modal .box"));
  ok(modalOpen, "modal opened on + add click");

  console.log("\n[2] Type a title and save");
  await page.type("#tt", "Test task from Vite build");
  await page.click("#tsave");
  await new Promise((r) => setTimeout(r, 800));

  // modal should close
  const modalAfter = await page.evaluate(() => !!document.querySelector(".modal .box"));
  ok(!modalAfter, "modal closed after save");

  // toast should appear
  const toastText = await page.evaluate(() => {
    const t = document.querySelector(".toast");
    return t ? t.textContent : null;
  });
  ok(toastText && toastText.includes("Applied"), "success toast: " + toastText);

  console.log("\n[3] Verify PATCH was sent to tasks.json");
  ok(lastPatch !== null, "PATCH was sent to API");
  ok(lastPatch && lastPatch.files && lastPatch.files["tasks.json"], "PATCH body has tasks.json");
  if (lastPatch && lastPatch.files && lastPatch.files["tasks.json"]) {
    const written = JSON.parse(lastPatch.files["tasks.json"].content);
    ok(written.tasks && written.tasks.length === 1, "tasks.json has 1 task: got " + (written.tasks?.length || 0));
    if (written.tasks && written.tasks[0]) {
      ok(written.tasks[0].title === "Test task from Vite build", "task title correct: " + written.tasks[0].title);
      ok(written.tasks[0].owner === "nilesh", "task owner is lead: " + written.tasks[0].owner);
    }
  }

  console.log("\n[4] No JS errors");
  ok(errors.length === 0, "no console/page errors (got " + errors.length + ")");
  if (errors.length) errors.forEach((e) => console.log("    -> " + e));

  fs.mkdirSync(path.join(__dirname, "screenshots"), { recursive: true });
  await page.screenshot({ path: path.join(__dirname, "screenshots", "vite-add-task.png"), fullPage: false });
  console.log("\n  saved: tests/screenshots/vite-add-task.png");

  await browser.close();
  console.log("\nDone. Exit code: " + (process.exitCode || 0));
})().catch((e) => { console.error("FATAL:", e); process.exit(2); });

function ok(cond, msg) {
  console.log((cond ? "  PASS  " : "  FAIL  ") + msg);
  if (!cond) process.exitCode = 1;
}
