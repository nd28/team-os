"use strict";
const puppeteer = require("puppeteer-core");
const path = require("path");

const URL = process.env.TEAM_OS_URL || "http://localhost:5173/team-os/";

function ok(c, m) { console.log((c ? "  PASS  " : "  FAIL  ") + m); if (!c) process.exitCode = 1; }

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
          "tasks.json": { content: JSON.stringify({ columns: ["backlog","todo","in-progress","done"], tasks: [
            { id: "t1", title: "Existing 1", owner: "nilesh", status: "todo", priority: "low", deadline: "" },
            { id: "t2", title: "Existing 2", owner: "nilesh", status: "in-progress", priority: "high", deadline: "" },
          ], priorities: ["high","medium","low"] }) },
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

  console.log("\n[1] Open + add task");
  const addBtns = await page.$$("button.sm");
  for (const b of addBtns) {
    const t = await b.evaluate((el) => el.textContent.trim());
    if (t === "+ add") { await b.click(); break; }
  }
  await new Promise((r) => setTimeout(r, 400));
  await page.type("#tt", "Segment test");

  console.log("\n[2] Segmented controls exist");
  const segs = await page.evaluate(() => {
    const status = document.querySelectorAll('#tsGroup .seg-btn');
    const pri = document.querySelectorAll('#tpGroup .seg-btn');
    return {
      status: Array.from(status).map((b) => ({ val: b.dataset.val, active: b.classList.contains('active'), text: b.textContent.trim() })),
      pri: Array.from(pri).map((b) => ({ val: b.dataset.val, active: b.classList.contains('active') })),
    };
  });
  ok(segs.status.length === 4, `status has 4 segments: got ${segs.status.length}`);
  ok(segs.pri.length === 3, `priority has 3 segments: got ${segs.pri.length}`);
  ok(segs.status.find((s) => s.active)?.val === "backlog", `default status is backlog: got ${segs.status.find((s) => s.active)?.val}`);
  ok(segs.pri.find((p) => p.active)?.val === "medium", `default priority is medium: got ${segs.pri.find((p) => p.active)?.val}`);

  console.log("\n[3] Status segments show live task counts");
  // The fixture has 1 todo + 1 in-progress, so:
  // backlog: 0, todo: 1, in-progress: 1, done: 0 (we exclude the task being edited, but this is new)
  const counts = segs.status.map((s) => s.text.match(/(\d+)/)?.[1]);
  ok(counts.join(",") === "0,1,1,0", `counts (backlog,todo,in-progress,done): got ${counts.join(",")}`);

  console.log("\n[4] Click 'in-progress' status — updates active + hidden input");
  await page.evaluate(() => {
    const btn = document.querySelector('#tsGroup .seg-btn[data-val="in-progress"]');
    btn.click();
  });
  await new Promise((r) => setTimeout(r, 200));
  const afterStatus = await page.evaluate(() => ({
    hiddenVal: document.getElementById('ts').value,
    activeVal: document.querySelector('#tsGroup .seg-btn.active')?.dataset.val,
  }));
  ok(afterStatus.hiddenVal === "in-progress", `hidden ts input: got ${afterStatus.hiddenVal}`);
  ok(afterStatus.activeVal === "in-progress", `active segment: got ${afterStatus.activeVal}`);

  console.log("\n[5] Click 'high' priority — updates active + hidden input + visual color");
  await page.evaluate(() => {
    document.querySelector('#tpGroup .seg-btn[data-val="high"]').click();
  });
  await new Promise((r) => setTimeout(r, 200));
  const afterPri = await page.evaluate(() => {
    const high = document.querySelector('#tpGroup .seg-btn[data-val="high"]');
    const med = document.querySelector('#tpGroup .seg-btn[data-val="medium"]');
    return {
      hiddenVal: document.getElementById('tp').value,
      highActive: high.classList.contains('active'),
      medActive: med.classList.contains('active'),
      highColor: getComputedStyle(high).color,
    };
  });
  ok(afterPri.hiddenVal === "high", `hidden tp input: got ${afterPri.hiddenVal}`);
  ok(afterPri.highActive && !afterPri.medActive, `high active, medium inactive`);
  // color transitions mid-frame — just check it's reddish (R dominant, >100)
  const [r, g, b] = afterPri.highColor.match(/\d+/g)?.map(Number) || [0, 0, 0];
  ok(r > 150 && r > g && r > b, `high priority is reddish: got ${afterPri.highColor}`);

  console.log("\n[6] Save sends the new values");
  // intercept PATCH to capture payload
  const captured = [];
  await page.setRequestInterception(true);
  page.removeAllListeners('request');
  page.on('request', (req) => {
    if (!req.url().includes("api.github.com")) return req.continue();
    if (req.method() === "OPTIONS") return req.respond({ status: 204, headers: {
      "access-control-allow-origin": "*", "access-control-allow-methods": "GET, PATCH, POST, DELETE, OPTIONS",
      "access-control-allow-headers": "authorization, content-type, accept",
    }});
    if (req.method() === "PATCH") {
      try { captured.push(JSON.parse(req.postData())); } catch (_) {}
      return req.respond({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ files: {} }) });
    }
    req.respond({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ files: {} }) });
  });
  await page.click("#tsave");
  await new Promise((r) => setTimeout(r, 800));
  const tasks = JSON.parse(captured[0].files["tasks.json"].content).tasks;
  const tp = tasks.find((t) => t.title === "Segment test");
  ok(!!tp, `new task "Segment test" present in saved file`);
  if (tp) {
    ok(tp.status === "in-progress", `saved status: got ${tp.status}`);
    ok(tp.priority === "high", `saved priority: got ${tp.priority}`);
  }

  console.log("\n[7] No JS errors");
  ok(errors.length === 0, `no errors (got ${errors.length})`);
  if (errors.length) errors.forEach((e) => console.log("    -> " + e));

  await browser.close();
  console.log("\nDone. Exit code: " + (process.exitCode || 0));
})().catch((e) => { console.error("FATAL:", e); process.exit(2); });
