import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import puppeteer from "puppeteer-core";
import { parseHeroines } from "../js/data.js";

const origin = process.env.ORIGIN || "http://127.0.0.1:8787";
const out = process.env.SHOT_DIR || "/tmp/vr-shots";
mkdirSync(out, { recursive: true });

const heroines = parseHeroines(readFileSync(new URL("../VR_DATA.csv", import.meta.url), "utf8"));
const byName = new Map(heroines.map((heroine) => [heroine.name, heroine]));

const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
page.on("pageerror", (error) => console.error("PAGE", error.message));
page.on("console", (message) => {
  if (message.type() === "error") console.error("CONSOLE", message.text());
});
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

await page.goto(origin, { waitUntil: "networkidle0" });
await page.waitForFunction(() => document.getElementById("start")?.textContent === "토너먼트 열기");
await page.evaluate(() => document.fonts.ready);
const channelsHidden = await page.$eval("#channels", (node) => node.hidden);
if (!channelsHidden) throw new Error("channels should stay hidden");
await page.screenshot({ path: `${out}/main.png` });

await page.click("#start");
await page.waitForSelector("#view-match:not([hidden])");
for (let round = 0; round < 20; round += 1) {
  const done = await page.$eval("#view-result", (node) => !node.hidden);
  if (done) break;
  await page.waitForFunction(() => document.getElementById("splash").hidden);
  await page.waitForSelector("#fighter-a img");
  await page.click("#fighter-a");
  await page.waitForSelector("#sheet:not([hidden])");
  if (round === 0) await page.screenshot({ path: `${out}/confirm.png` });
  await page.click("#sheet-ok");
  await page.waitForFunction(() => document.getElementById("sheet").hidden);
}
await page.waitForSelector("#view-result:not([hidden])");
await page.waitForFunction(() => document.getElementById("poster")?.src.startsWith("data:image/png"));
await page.waitForFunction(() => {
  const text = document.getElementById("rank-status")?.textContent || "";
  return text && !text.includes("확인하고");
}, { timeout: 15000 });
await page.screenshot({ path: `${out}/result.png`, fullPage: true });

const name = await page.$eval("#winner-name", (node) => node.textContent.trim());
const bodyText = await page.evaluate(() => document.body.innerText);
const record = byName.get(name);
if (!record) throw new Error(`unknown winner ${name}`);
const raw = readFileSync(new URL("../VR_DATA.csv", import.meta.url), "utf8");
const ageLine = raw.split(/\r?\n/).find((line) => line.startsWith(`${record.id},`));
const age = ageLine.split(",")[3];
if (bodyText.includes(`${age}세`)) {
  throw new Error(`age leaked for ${name}`);
}
const dataUrl = await page.$eval("#poster", (image) => image.src);
writeFileSync(`${out}/card.png`, Buffer.from(dataUrl.split(",")[1], "base64"));

const seeds = ["10127", "10440", "10072", "10326"].filter((id) => id !== record.id).slice(0, 3);
const runs = [];
for (const id of seeds) {
  const response = await fetch(`${origin}/api/runs`, { method: "POST" });
  const payload = await response.json();
  if (!payload.runId) throw new Error(`run failed ${JSON.stringify(payload)}`);
  runs.push({ id, runId: payload.runId });
}
await new Promise((resolve) => setTimeout(resolve, 2700));
for (const run of runs) {
  const response = await fetch(`${origin}/api/wins`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ runId: run.runId, heroineId: run.id }),
  });
  const payload = await response.json();
  if (!payload.counted) throw new Error(`win failed ${JSON.stringify(payload)}`);
}

await page.click("#result-rank");
await page.waitForSelector(".rank-item");
await page.screenshot({ path: `${out}/ranking.png`, fullPage: true });

const share = await fetch(`${origin}/r/${record.id}`);
const html = await share.text();
if (!html.includes("og:image") || html.includes(age)) {
  throw new Error("share preview leaked a private field or missed the image");
}
console.log(JSON.stringify({ name, age, status: await page.$eval("#rank-status", (node) => node.textContent) }));
await browser.close();
