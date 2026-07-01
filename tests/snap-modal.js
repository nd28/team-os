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

  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const u = req.url();
    if (u.includes("api.github.com")) {
      if (req.method() === "OPTIONS") return req.respond({ status: 204, headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, PATCH, POST, DELETE, OPTIONS",
        "access-control-allow-headers": "authorization, content-type, accept",
      }});
      req.respond({ status: 200, contentType: "application/json",
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

  // click first + add
  const addBtns = await page.$$("button.sm");
  for (const b of addBtns) {
    const t = await b.evaluate((el) => el.textContent.trim());
    if (t === "+ add") { await b.click(); break; }
  }
  await new Promise((r) => setTimeout(r, 400));
  await page.type("#tt", "Ship the onboarding flow");

  fs.mkdirSync(path.join(__dirname, "screenshots"), { recursive: true });
  await page.screenshot({ path: path.join(__dirname, "screenshots", "modal-current.png"), fullPage: false });
  console.log("saved: tests/screenshots/modal-current.png");

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(2); });
