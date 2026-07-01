"use strict";
const puppeteer = require("puppeteer-core");
const path = require("path");
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
  await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2, isMobile: true });

  // stub gist network
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const u = req.url();
    if (u.includes("api.github.com")) {
      if (req.method() === "OPTIONS") {
        return req.respond({
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET, PATCH, POST, DELETE, OPTIONS",
            "access-control-allow-headers": "authorization, content-type, accept",
            "access-control-expose-headers": "x-ratelimit-limit, x-ratelimit-remaining, x-ratelimit-reset",
          },
        });
      }
      if (u.endsWith("/gists") || u.includes("/gists?")) {
        return req.respond({ status: 201, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: JSON.stringify({ id: "test-gist", files: {} }) });
      }
      if (u.includes("/gists/")) {
        return req.respond({
          status: 200,
          headers: { "access-control-allow-origin": "*", "content-type": "application/json", "x-ratelimit-remaining": "4999", "x-ratelimit-limit": "5000", "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 3600) },
          body: JSON.stringify({
            id: "test-gist",
            files: {
              "tasks.json": { content: JSON.stringify({ columns: ["backlog", "in progress", "review", "done"], tasks: [{ id: "t1", title: "A", status: "backlog", priority: "medium", assignee: "u-nil" }, { id: "t2", title: "B", status: "in progress", priority: "high", assignee: "u-nil" }, { id: "t3", title: "C", status: "done", priority: "low", assignee: "u-nil" }], priorities: ["high", "medium", "low"] }) },
              "team.json": { content: JSON.stringify({ statusOptions: ["available", "busy", "afk", "leave"], members: [{ id: "u-nil", name: "Nilesh Suthar", status: "available", workload: 3, responsibilities: ["auth"] }] }) },
              "auth.json": { content: JSON.stringify({ lead: { name: "Nilesh", rights: ["all"] }, developers: [] }) },
              "leaves.json": { content: JSON.stringify({ leaves: [] }) },
              "pending_approvals.json": { content: JSON.stringify({ requests: [] }) },
            },
          }),
        });
      }
    }
    req.continue();
  });

  await page.goto(URL, { waitUntil: "networkidle0" });
  await page.evaluate(() => {
    localStorage.setItem("tos_session", JSON.stringify({ username: "nilesh", name: "Nilesh Suthar", role: "lead", rights: ["all"] }));
    localStorage.setItem("tos_token_nilesh", "fake-pat");
    localStorage.setItem("tos_gist_id", "test-gist");
  });
  await page.reload({ waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 1500));

  await page.evaluate(() => {
    const t = [...document.querySelectorAll("button, .tab, [class*=\"tab\"]")].find((b) => b.textContent.trim() === "Board");
    if (t) t.click();
  });
  await new Promise((r) => setTimeout(r, 500));
  await page.evaluate(() => {
    const t = [...document.querySelectorAll("button.sm")].find((b) => b.textContent.trim() === "+ add");
    if (t) t.click();
  });
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: "tests/screenshots/mobile-seg.png" });

  const dims = await page.evaluate(() => {
    const groups = [...document.querySelectorAll(".seg-group")];
    const modalBox = document.querySelector(".modal .box");
    const mR = modalBox ? modalBox.getBoundingClientRect() : null;
    return {
      vw: window.innerWidth,
      mq: window.matchMedia("(max-width: 560px)").matches,
      modal: mR ? { w: Math.round(mR.width), l: Math.round(mR.left), r: Math.round(mR.right) } : null,
      groups: groups.map((g) => {
        const r = g.getBoundingClientRect();
        const cs = window.getComputedStyle(g);
        return {
          field: g.classList.contains("seg-status") ? "status" : g.classList.contains("seg-priority") ? "priority" : "?",
          w: Math.round(r.width),
          h: Math.round(r.height),
          l: Math.round(r.left),
          r: Math.round(r.right),
          flexDir: cs.flexDirection,
          segs: [...g.querySelectorAll(".seg-btn")].map((s) => {
            const sr = s.getBoundingClientRect();
            return { text: s.textContent.trim().replace(/\s+/g, " "), w: Math.round(sr.width), l: Math.round(sr.left), r: Math.round(sr.right) };
          }),
        };
      }),
    };
  });
  console.log(JSON.stringify(dims, null, 2));

  console.log("\n[1] Media query active on mobile");
  ok(dims.mq, "matchMedia(max-width:560px) is true at 375px");
  ok(dims.modal && dims.modal.w <= 360, "modal box width fits viewport: " + dims.modal?.w + "px");

  console.log("\n[2] Segmented groups stack vertically and span full width");
  for (const g of dims.groups) {
    ok(g.flexDir === "column", `${g.field}: flex-direction is column (got ${g.flexDir})`);
    ok(g.w >= 280, `${g.field}: full-width (got ${g.w}px)`);
  }

  console.log("\n[3] All segments fit within viewport (no horizontal overflow)");
  for (const g of dims.groups) {
    for (const s of g.segs) {
      ok(s.r <= dims.vw, `${g.field} "${s.text}" right=${s.r} <= ${dims.vw}`);
      ok(s.l >= 0, `${g.field} "${s.text}" left=${s.l} >= 0`);
    }
  }

  console.log("\n[4] Click a status segment updates the active state");
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.seg-status .seg-btn')];
    const inProgress = btns.find((b) => b.textContent.trim().includes("in progress"));
    if (inProgress) inProgress.click();
  });
  await new Promise((r) => setTimeout(r, 200));
  const activeVal = await page.evaluate(() => document.querySelector('.seg-status .seg-btn.active')?.dataset.val);
  ok(activeVal === "in progress", "clicking 'In Progress' sets it active: " + activeVal);

  await browser.close();
})();
