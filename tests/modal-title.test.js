"use strict";
const puppeteer = require("puppeteer-core");
const path = require("path");

const URL = process.env.TEAM_OS_URL || "http://localhost:5173/team-os/";

function ok(c, m) { console.log((c ? "  PASS  " : "  FAIL  ") + msg(m)); if (!c) process.exitCode = 1; }
function msg(s) { return s; }

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

  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (!req.url().includes("api.github.com")) return req.continue();
    if (req.method() === "OPTIONS") return req.respond({ status: 204, headers: {
      "access-control-allow-origin": "*", "access-control-allow-methods": "GET, PATCH, POST, DELETE, OPTIONS",
      "access-control-allow-headers": "authorization, content-type, accept",
    }});
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
  });

  await page.goto(URL + "#gist=abcdef0123");
  await new Promise((r) => setTimeout(r, 1500));
  await page.evaluate(() => {
    localStorage.setItem("tos_session", JSON.stringify({ username: "nilesh", name: "Nilesh Suthar", role: "lead", rights: ["all"] }));
    localStorage.setItem("tos_token_nilesh", "fake-pat");
  });
  await page.reload();
  await new Promise((r) => setTimeout(r, 2000));

  console.log("\n[1] Open + add");
  const addBtns = await page.$$("button.sm");
  for (const b of addBtns) {
    const t = await b.evaluate((el) => el.textContent.trim());
    if (t === "+ add") { await b.click(); break; }
  }
  await new Promise((r) => setTimeout(r, 400));

  console.log("\n[2] Focus lands on title input immediately");
  const focused = await page.evaluate(() => document.activeElement?.id);
  ok(focused === "tt", `document.activeElement === #tt: got "${focused}"`);

  // The first keystroke should land in the title — verify by typing without clicking
  await page.keyboard.type("Instant capture");
  const titleVal = await page.$eval("#tt", (el) => el.value);
  ok(titleVal === "Instant capture", `typed text went into title (no click needed): got "${titleVal}"`);

  console.log("\n[3] Title is the visual hero (size + weight hierarchy)");
  const m = await page.evaluate(() => {
    const tt = document.getElementById('tt');
    const to = document.getElementById('to');
    const ts = document.getElementById('ts');
    const lblOwner = document.querySelector('.modal label[for], .modal label');
    const saveBtn = document.getElementById('tsave');
    const cs = (el) => getComputedStyle(el);
    return {
      title: { fontSize: cs(tt).fontSize, fontWeight: cs(tt).fontWeight, color: cs(tt).color },
      owner: { fontSize: cs(to).fontSize, fontWeight: cs(to).fontWeight },
      status: { fontSize: cs(ts).fontSize, fontWeight: cs(ts).fontWeight },
      save:   { fontSize: cs(saveBtn).fontSize, fontWeight: cs(saveBtn).fontWeight },
    };
  });
  const titlePx = parseFloat(m.title.fontSize);
  const ownerPx = parseFloat(m.owner.fontSize);
  const statusPx = parseFloat(m.status.fontSize);
  const savePx = parseFloat(m.save.fontSize);
  ok(titlePx >= 20, `title font-size >= 20px: got ${titlePx}px`);
  ok(titlePx > ownerPx, `title (${titlePx}px) bigger than owner (${ownerPx}px)`);
  ok(titlePx > statusPx, `title (${titlePx}px) bigger than status (${statusPx}px)`);
  ok(parseInt(m.title.fontWeight) >= 600, `title font-weight >= 600: got ${m.title.fontWeight}`);
  ok(parseInt(m.title.fontWeight) >= parseInt(m.owner.fontWeight), `title weight (${m.title.fontWeight}) >= owner weight (${m.owner.fontWeight})`);

  console.log("\n[4] Divider separates hero from details");
  const hasDivider = await page.evaluate(() => !!document.querySelector('.modal-divider'));
  ok(hasDivider, ".modal-divider present");

  console.log("\n[5] No JS errors");
  ok(errors.length === 0, `no console/page errors (got ${errors.length})`);
  if (errors.length) errors.forEach((e) => console.log("    -> " + e));

  await browser.close();
  console.log("\nDone. Exit code: " + (process.exitCode || 0));
})().catch((e) => { console.error("FATAL:", e); process.exit(2); });
