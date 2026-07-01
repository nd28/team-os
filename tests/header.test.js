"use strict";
const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs");

// TEAM_OS_URL env var overrides default. Default: Vite dev server on :5173
// with the /team-os/ base path. We assume the test runner starts the dev
// server separately. Falls back to file:// for legacy index.html.
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

  // capture console + page errors
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console.error: " + m.text()); });

  // stub gist network so init() doesn't try real GitHub
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
            "access-control-max-age": "86400",
          },
        });
      }
      req.respond({
        status: 200,
        contentType: "application/json",
        headers: {
          "access-control-allow-origin": "*",
          "x-ratelimit-remaining": "4999",
          "x-ratelimit-limit": "5000",
        },
        body: JSON.stringify({
          files: {
            "auth.json": { content: JSON.stringify({ lead: { name: "Nilesh Suthar", rights: ["all"] }, developers: [] }) },
            "team.json": { content: JSON.stringify({ members: [{ id: "nilesh", name: "Nilesh Suthar", status: "active" }], statusOptions: ["active","remote","away","on-leave"] }) },
            "tasks.json": { content: JSON.stringify({ columns: ["backlog","todo","doing","done"], tasks: [], priorities: ["high","medium","low"] }) },
            "leaves.json": { content: JSON.stringify({ leaves: [] }) },
            "pending_approvals.json": { content: JSON.stringify({ requests: [] }) },
          },
        }),
      });
    } else req.continue();
  });

  // force a known gist id in the URL hash (must be hex to match /[a-f0-9]+/)
  await page.goto(URL + "#gist=abcdef0123");
  await new Promise((r) => setTimeout(r, 2500));

  console.log("\n[1] Header structure (logged-out state)");
  const brandText = await page.$eval(".brand", (el) => el.textContent.trim());
  ok(brandText.includes("Team OS"), "brand shows 'Team OS'");

  const headerHeight1 = await page.$eval("header.top", (el) => el.getBoundingClientRect().height);
  ok(headerHeight1 < 70, "header height reasonable: " + headerHeight1 + "px");

  const whoItems1 = await page.$$eval("#who > *", (els) => els.length);
  ok(whoItems1 === 3, "#who has 3 items (rlBadge, themeBtn, muted text): got " + whoItems1);

  console.log("\n[2] Login as lead, then verify dropdown layout");
  await page.evaluate(() => {
    const u = { username: "nilesh", name: "Nilesh Suthar", role: "lead", rights: ["all"] };
    localStorage.setItem("tos_session", JSON.stringify(u));
    localStorage.setItem("tos_token_nilesh", "fake-pat");
  });
  await page.reload();
  await new Promise((r) => setTimeout(r, 1500));

  const headerHeight2 = await page.$eval("header.top", (el) => el.getBoundingClientRect().height);
  ok(headerHeight2 < 80, "header still compact after login: " + headerHeight2 + "px");

  const avatarText = await page.$eval(".user-btn .avatar", (el) => el.textContent.trim());
  ok(avatarText === "NS", "avatar shows initials: got '" + avatarText + "'");

  const userName = await page.$eval(".user-btn .uname", (el) => el.textContent.trim());
  ok(userName === "Nilesh Suthar", "name shows in pill: got '" + userName + "'");

  const whoItems2 = await page.$$eval("#who > *", (els) => els.length);
  ok(whoItems2 === 3, "#who has 3 items (user-wrap, rlBadge, themeBtn): got " + whoItems2);

  // Check-in + Logout should NOT be in the header top-level
  const visibleInHeader = await page.evaluate(() => {
    return {
      checkin: !!document.querySelector("#who > #btnCheckin"),
      logout: !!document.querySelector("#who > #btnLogout"),
    };
  });
  ok(!visibleInHeader.checkin, "Check-in is NOT a direct child of #who (moved to menu)");
  ok(!visibleInHeader.logout, "Logout is NOT a direct child of #who (moved to menu)");

  console.log("\n[3] Dropdown open / close behaviour");
  const initiallyOpen = await page.$eval("#userMenu", (el) => el.classList.contains("open"));
  ok(!initiallyOpen, "user menu starts closed");

  await page.click("#userBtn");
  await new Promise((r) => setTimeout(r, 200));
  const afterClick = await page.$eval("#userMenu", (el) => el.classList.contains("open"));
  ok(afterClick, "user menu opens on avatar click");

  const menuButtons = await page.$$eval("#userMenu button", (els) => els.map((e) => e.textContent.trim()));
  ok(menuButtons.some((t) => t.includes("Check-in")), "menu contains Check-in: " + JSON.stringify(menuButtons));
  ok(menuButtons.some((t) => t.includes("Logout")), "menu contains Logout: " + JSON.stringify(menuButtons));

  // outside click closes
  await page.click("body");
  await new Promise((r) => setTimeout(r, 200));
  const afterOutside = await page.$eval("#userMenu", (el) => el.classList.contains("open"));
  ok(!afterOutside, "user menu closes on outside click");

  // Escape closes
  await page.click("#userBtn");
  await new Promise((r) => setTimeout(r, 100));
  await page.keyboard.press("Escape");
  await new Promise((r) => setTimeout(r, 200));
  const afterEsc = await page.$eval("#userMenu", (el) => el.classList.contains("open"));
  ok(!afterEsc, "user menu closes on Escape");

  console.log("\n[4] Status pill inside avatar shows team status");
  const statusText = await page.$eval(".user-btn .ustatus .status", (el) => el.textContent.trim());
  ok(statusText === "active", "status pill text: '" + statusText + "'");
  const statusDotColor = await page.$eval(".user-btn .ustatus .status .dot", (el) => getComputedStyle(el).backgroundColor);
  ok(statusDotColor !== "rgba(0, 0, 0, 0)" && statusDotColor !== "", "status dot has a color: " + statusDotColor);

  console.log("\n[5] Logout from menu clears user state");
  await page.click("#userBtn");
  await new Promise((r) => setTimeout(r, 150));
  await page.click("#btnLogout");
  await new Promise((r) => setTimeout(r, 300));
  const stillLogged = await page.evaluate(() => !!document.getElementById("userBtn"));
  ok(!stillLogged, "avatar gone after logout");

  console.log("\n[6] Mobile viewport: avatar collapses to icon only");
  await page.evaluate(() => {
    const u = { username: "nilesh", name: "Nilesh Suthar", role: "lead", rights: ["all"] };
    localStorage.setItem("tos_session", JSON.stringify(u));
    localStorage.setItem("tos_token_nilesh", "fake-pat");
  });
  await page.setViewport({ width: 380, height: 720 });
  await page.reload();
  await new Promise((r) => setTimeout(r, 1500));

  const mobile = await page.evaluate(() => {
    const btn = document.querySelector(".user-btn");
    const uname = document.querySelector(".user-btn .uname");
    const av = document.querySelector(".user-btn .avatar");
    return {
      btnWidth: btn.getBoundingClientRect().width,
      unameDisplay: getComputedStyle(uname).display,
      avatarVisible: av.offsetWidth > 0,
    };
  });
  ok(mobile.unameDisplay === "none", "uname hidden on mobile: " + mobile.unameDisplay);
  ok(mobile.avatarVisible, "avatar still visible on mobile");
  ok(mobile.btnWidth < 50, "avatar button is compact on mobile: " + mobile.btnWidth + "px");

  console.log("\n[7] No JS errors during full run");
  ok(errors.length === 0, "no console/page errors (got " + errors.length + ")");
  if (errors.length) errors.forEach((e) => console.log("    -> " + e));

  // screenshots
  fs.mkdirSync(path.join(__dirname, "screenshots"), { recursive: true });
  await page.setViewport({ width: 1200, height: 800 });
  await page.reload();
  await new Promise((r) => setTimeout(r, 1500));
  await page.click("#userBtn");
  await new Promise((r) => setTimeout(r, 200));
  await page.screenshot({ path: path.join(__dirname, "screenshots", "header-dropdown.png"), fullPage: false });
  console.log("\n  saved: tests/screenshots/header-dropdown.png");

  await browser.close();
  console.log("\nDone. Exit code: " + (process.exitCode || 0));
})().catch((e) => {
  console.error("FATAL:", e);
  process.exit(2);
});
