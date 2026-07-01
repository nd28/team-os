"use strict";
const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs");

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

  // Custom rate-limit response per render
  const cases = [
    { name: "rl-healthy", remaining: 4999, limit: 5000, secs: 42 * 60 + 15 },
    { name: "rl-mid",     remaining: 500,  limit: 5000, secs: 12 * 60 + 30 },
    { name: "rl-low",     remaining: 3,    limit: 5000, secs: 8 * 60 + 5 },
  ];
  let idx = 0;

  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (!req.url().includes("api.github.com")) return req.continue();
    if (req.method() === "OPTIONS") return req.respond({ status: 204, headers: {
      "access-control-allow-origin": "*", "access-control-allow-methods": "GET, PATCH, POST, DELETE, OPTIONS",
      "access-control-allow-headers": "authorization, content-type, accept",
    }});
    const c = cases[idx];
    req.respond({ status: 200, contentType: "application/json",
      headers: { "access-control-allow-origin": "*",
        "access-control-expose-headers": "x-ratelimit-limit, x-ratelimit-remaining, x-ratelimit-reset",
        "x-ratelimit-limit": String(c.limit),
        "x-ratelimit-remaining": String(c.remaining),
        "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + c.secs) },
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

  fs.mkdirSync(path.join(__dirname, "screenshots"), { recursive: true });

  for (let i = 0; i < cases.length; i++) {
    idx = i;
    await page.goto(URL + "#gist=abcdef0123");
    await new Promise((r) => setTimeout(r, 1200));
    await page.evaluate(() => {
      localStorage.setItem("tos_session", JSON.stringify({ username: "nilesh", name: "Nilesh Suthar", role: "lead", rights: ["all"] }));
      localStorage.setItem("tos_token_nilesh", "fake-pat");
    });
    await page.reload();
    await new Promise((r) => setTimeout(r, 1500));

    const c = cases[i];
    // crop just the badge area: top-right 120x44
    const clip = { x: 1080, y: 0, width: 120, height: 44 };
    await page.screenshot({ path: path.join(__dirname, "screenshots", `${c.name}.png`), clip });
    console.log("saved:", `${c.name}.png`);

    // assertions
    const r = await page.evaluate(() => {
      const b = document.getElementById('rlBadge');
      if (!b) return null;
      const rem = b.querySelector('.rl-rem')?.textContent;
      const tot = b.querySelector('.rl-tot')?.textContent;
      const sep = b.querySelector('.rl-sep')?.textContent;
      const timer = b.querySelector('.rl-timer')?.textContent;
      const cs = getComputedStyle(b);
      const remCs = getComputedStyle(b.querySelector('.rl-rem'));
      const totCs = getComputedStyle(b.querySelector('.rl-tot'));
      const timerCs = b.querySelector('.rl-timer') ? getComputedStyle(b.querySelector('.rl-timer')) : null;
      return {
        width: b.getBoundingClientRect().width,
        height: b.getBoundingClientRect().height,
        rem, tot, sep, timer,
        remWeight: remCs.fontWeight, remColor: remCs.color, remOpacity: remCs.opacity,
        totWeight: totCs.fontWeight, totColor: totCs.color, totOpacity: totCs.opacity,
        timerOpacity: timerCs ? timerCs.opacity : null, timerColor: timerCs ? timerCs.color : null,
        low: b.classList.contains('low'),
        display: cs.display, flexDir: cs.flexDirection,
      };
    });
    ok(r, `badge DOM accessible for ${c.name}`);
    ok(/inline-flex|flex/.test(r.display) && r.flexDir === 'column', `stacked (flex-direction: column) — got ${r.display} ${r.flexDir}`);
    ok(r.rem === String(c.remaining), `remaining: ${c.remaining} → got ${r.rem}`);
    ok(r.tot === String(c.limit), `limit: ${c.limit} → got ${r.tot}`);
    ok(r.sep === '/', `slash separator: got "${r.sep}"`);
    ok(r.timer && /^\d{1,2}:\d{2}$/.test(r.timer), `timer mm:ss format: got "${r.timer}"`);
    ok(r.width < 100, `compact width (<100px): got ${r.width.toFixed(1)}px`);
    // hierarchy: rem is bolder + more opaque than tot, which is bolder than timer
    ok(parseInt(r.remWeight) >= parseInt(r.totWeight), `remaining weight (${r.remWeight}) >= limit weight (${r.totWeight})`);
    ok(parseFloat(r.remOpacity) > parseFloat(r.totOpacity), `remaining opacity (${r.remOpacity}) > limit opacity (${r.totOpacity})`);
    if (r.timerOpacity) ok(parseFloat(r.totOpacity) > parseFloat(r.timerOpacity), `limit opacity (${r.totOpacity}) > timer opacity (${r.timerOpacity})`);
    // low state
    const expectLow = c.remaining <= 5;
    ok(r.low === expectLow, `low class: expected ${expectLow}, got ${r.low}`);
    if (expectLow) {
      ok(r.remColor.includes('248, 81, 73') || r.remColor.includes('f85149'), `low: remaining text is red — got ${r.remColor}`);
    }
    console.log("---");
  }

  await browser.close();
  console.log("\nDone. Exit code: " + (process.exitCode || 0));
})().catch((e) => { console.error("FATAL:", e); process.exit(2); });
