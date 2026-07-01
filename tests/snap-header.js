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
    if (!req.url().includes("api.github.com")) return req.continue();
    if (req.method() === "OPTIONS") return req.respond({ status: 204, headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, PATCH, POST, DELETE, OPTIONS",
      "access-control-allow-headers": "authorization, content-type, accept",
    }});
    req.respond({ status: 200, contentType: "application/json",
      headers: { "access-control-allow-origin": "*", "x-ratelimit-remaining": "4999", "x-ratelimit-limit": "5000" },
      body: JSON.stringify({
        files: {
          "auth.json": { content: JSON.stringify({ lead: { name: "Nilesh Suthar", rights: ["all"] }, developers: [
            { id: "d1", name: "Asha", username: "asha", rights: ["read","propose"] },
          ] }) },
          "team.json": { content: JSON.stringify({ statusOptions: ["active","remote","away","on-leave"], members: [
            { id: "nilesh", name: "Nilesh Suthar", status: "active", responsibilities: "Lead", workload: 60 },
            { id: "d1", name: "Asha", status: "remote", responsibilities: "Frontend", workload: 50, location: { lat: "28.613", lng: "77.209", t: Date.now() }, lastSeen: new Date().toISOString() },
          ] }) },
          "tasks.json": { content: JSON.stringify({ columns: ["backlog","todo","in-progress","done"], priorities: ["high","medium","low"], tasks: [
            { id: "t1", title: "Ship Vite port", owner: "nilesh", status: "in-progress", priority: "high", deadline: "2026-07-02" },
            { id: "t2", title: "Design review", owner: "d1", status: "todo", priority: "medium", deadline: "2026-07-05" },
          ] }) },
          "leaves.json": { content: JSON.stringify({ leaves: [] }) },
          "pending_approvals.json": { content: JSON.stringify({ requests: [] }) },
        },
      }),
    });
  });

  fs.mkdirSync(path.join(__dirname, "screenshots"), { recursive: true });

  // logged OUT
  await page.goto(URL + "#gist=abcdef0123");
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(__dirname, "screenshots", "header-loggedout.png"), fullPage: false });
  console.log("saved: header-loggedout.png");

  // logged IN
  await page.evaluate(() => {
    localStorage.setItem("tos_session", JSON.stringify({ username: "nilesh", name: "Nilesh Suthar", role: "lead", rights: ["all"] }));
    localStorage.setItem("tos_token_nilesh", "fake-pat");
  });
  await page.reload();
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(__dirname, "screenshots", "header-loggedin.png"), fullPage: false });
  console.log("saved: header-loggedin.png");

  // mobile
  await page.setViewport({ width: 380, height: 720 });
  await page.reload();
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(__dirname, "screenshots", "header-mobile.png"), fullPage: false });
  console.log("saved: header-mobile.png");

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(2); });
