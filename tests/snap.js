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

  // stub network
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const u = req.url();
    if (u.includes("api.github.com")) {
      if (req.method() === "OPTIONS") return req.respond({ status: 204, headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, PATCH, POST, DELETE, OPTIONS",
        "access-control-allow-headers": "authorization, content-type, accept",
      }});
      // gist with some tasks
      req.respond({
        status: 200, contentType: "application/json",
        headers: { "access-control-allow-origin": "*", "x-ratelimit-remaining": "4999", "x-ratelimit-limit": "5000" },
        body: JSON.stringify({
          files: {
            "auth.json": { content: JSON.stringify({ lead: { name: "Nilesh Suthar", rights: ["all"] }, developers: [
              { id: "d1", name: "Asha",  username: "asha",  rights: ["read","propose"] },
              { id: "d2", name: "Vikram", username: "vikram", rights: ["read","propose"] },
            ] }) },
            "team.json": { content: JSON.stringify({ statusOptions: ["active","remote","away","on-leave"], members: [
              { id: "nilesh", name: "Nilesh Suthar", status: "active",  responsibilities: "Lead", workload: 60 },
              { id: "d1",     name: "Asha",          status: "remote",  responsibilities: "Frontend", workload: 50, location: { lat: "28.613", lng: "77.209", t: Date.now() }, lastSeen: new Date().toISOString() },
              { id: "d2",     name: "Vikram",        status: "away",    responsibilities: "Backend",  workload: 80, lastSeen: new Date(Date.now()-3600*1000).toISOString() },
            ] }) },
            "tasks.json": { content: JSON.stringify({ columns: ["backlog","todo","in-progress","done"], priorities: ["high","medium","low"], tasks: [
              { id: "t1", title: "Ship Vite port",          owner: "nilesh", status: "in-progress", priority: "high",   deadline: "2026-07-02" },
              { id: "t2", title: "Design review",           owner: "d1",     status: "todo",        priority: "medium", deadline: "2026-07-05" },
              { id: "t3", title: "API rate-limit handling", owner: "d2",     status: "backlog",     priority: "low",    deadline: "2026-07-10" },
              { id: "t4", title: "Fix login edge case",     owner: "d1",     status: "done",        priority: "medium", deadline: "2026-06-28" },
            ] }) },
            "leaves.json": { content: JSON.stringify({ leaves: [
              { id: "l1", member: "d2", from: "2026-08-01", to: "2026-08-05", reason: "Vacation", status: "pending" },
            ] }) },
            "pending_approvals.json": { content: JSON.stringify({ requests: [
              { id: "p1", type: "task_add", file: "tasks.json", fileKey: "tasks", by: "d1", byName: "Asha", createdAt: new Date().toISOString(), summary: 'Add task "Migrate to Vite"', payload: { task: { id: "t5", title: "Migrate to Vite", owner: "d1", status: "backlog", priority: "high", deadline: "2026-07-15" } } },
            ] }) },
          },
        }),
      });
    } else req.continue();
  });

  // login as lead
  await page.goto(URL + "#gist=abcdef0123");
  await new Promise((r) => setTimeout(r, 1500));
  await page.evaluate(() => {
    localStorage.setItem("tos_session", JSON.stringify({ username: "nilesh", name: "Nilesh Suthar", role: "lead", rights: ["all"] }));
    localStorage.setItem("tos_token_nilesh", "fake-pat");
  });
  await page.reload();
  await new Promise((r) => setTimeout(r, 2500));

  fs.mkdirSync(path.join(__dirname, "screenshots"), { recursive: true });

  // board view
  await page.screenshot({ path: path.join(__dirname, "screenshots", "vite-board.png"), fullPage: false });
  console.log("saved: tests/screenshots/vite-board.png");

  // open dropdown
  await page.click("#userBtn");
  await new Promise((r) => setTimeout(r, 200));
  await page.screenshot({ path: path.join(__dirname, "screenshots", "vite-dropdown.png"), fullPage: false });
  console.log("saved: tests/screenshots/vite-dropdown.png");
  await page.click("body");

  // approvals tab
  await page.evaluate(() => {
    const tabs = document.querySelectorAll("#tabs button");
    for (const t of tabs) if (t.textContent.includes("Approvals")) { t.click(); break; }
  });
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: path.join(__dirname, "screenshots", "vite-approvals.png"), fullPage: false });
  console.log("saved: tests/screenshots/vite-approvals.png");

  // mobile
  await page.setViewport({ width: 380, height: 720 });
  await page.evaluate(() => {
    const tabs = document.querySelectorAll("#tabs button");
    for (const t of tabs) if (t.textContent.includes("Board")) { t.click(); break; }
  });
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: path.join(__dirname, "screenshots", "vite-mobile.png"), fullPage: false });
  console.log("saved: tests/screenshots/vite-mobile.png");

  await browser.close();
  console.log("Done.");
})().catch((e) => { console.error("FATAL:", e); process.exit(2); });
