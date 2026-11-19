import { mkdirSync, existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { gradeLabel } from "../js/labels.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const homeOnly = process.argv.includes("--home");
const catalog = JSON.parse(readFileSync(path.join(root, "data/catalog.json"), "utf8"));
const outDir = path.join(root, "img/og");
mkdirSync(outDir, { recursive: true });

function xml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  }[char]));
}

function nameSize(name) {
  return name.length > 8 ? 46 : name.length > 6 ? 54 : 64;
}

async function portrait(id) {
  const file = path.join(root, "img/bt_img", `${id}.webp`);
  if (!existsSync(file)) return null;
  return sharp(file).resize(760, 630, { fit: "cover", position: "north" }).jpeg({ quality: 82 }).toBuffer();
}

function overlay(name, detail) {
  return Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#10080b" stop-opacity="0"/>
        <stop offset="0.22" stop-color="#10080b" stop-opacity="0.2"/>
        <stop offset="0.48" stop-color="#10080b" stop-opacity="1"/>
      </linearGradient>
    </defs>
    <rect x="430" width="770" height="630" fill="url(#fade)"/>
    <text x="700" y="210" fill="#e6c98a" font-family="WenQuanYi Micro Hei" font-size="28">VR</text>
    <text x="700" y="280" fill="#e6c98a" font-family="WenQuanYi Micro Hei" font-size="32">내 최애 히로인</text>
    <text x="700" y="370" fill="#f4efe8" font-family="WenQuanYi Micro Hei" font-size="${nameSize(name)}">${xml(name)}</text>
    <text x="700" y="440" fill="#d9c7bc" font-family="WenQuanYi Micro Hei" font-size="26">${xml(detail)}</text>
  </svg>`);
}

async function writeCard(id, name, detail, destination) {
  const face = await portrait(id);
  const base = sharp({
    create: { width: 1200, height: 630, channels: 3, background: "#10080b" },
  });
  const layers = [];
  if (face) layers.push({ input: face, left: 0, top: 0 });
  layers.push({ input: overlay(name, detail), left: 0, top: 0 });
  await base.composite(layers).jpeg({ quality: 80 }).toFile(destination);
}

const featured = catalog.find((entry) => entry.name === "임유리");
if (!featured) throw new Error("missing featured heroine");
const featuredFile = path.join(root, "img/bt_img", `${featured.id}.webp`);
const featuredMeta = await sharp(featuredFile).metadata();
const featuredScale = 1400 / featuredMeta.width;
const featuredHeight = Math.round(featuredMeta.height * featuredScale);
const featuredTop = Math.max(0, Math.min(featuredHeight - 630, Math.round(featuredHeight * 0.16)));
const featuredFace = await sharp(featuredFile)
  .resize(1400, featuredHeight)
  .extract({ left: 200, top: featuredTop, width: 1200, height: 630 })
  .jpeg({ quality: 84 })
  .toBuffer();
const homeOverlay = Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="homeFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#10080b" stop-opacity="0.15"/>
      <stop offset="0.45" stop-color="#10080b" stop-opacity="0"/>
      <stop offset="1" stop-color="#10080b" stop-opacity="0.88"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#homeFade)"/>
  <text x="64" y="470" fill="#e6c98a" font-family="WenQuanYi Micro Hei" font-size="28">VR</text>
  <text x="64" y="545" fill="#f4efe8" font-family="WenQuanYi Micro Hei" font-size="72">${xml(featured.name)}</text>
  <text x="64" y="592" fill="#e6c98a" font-family="WenQuanYi Micro Hei" font-size="28">이상형 월드컵</text>
</svg>`);
await sharp(featuredFace)
  .composite([{ input: homeOverlay, left: 0, top: 0 }])
  .jpeg({ quality: 84 })
  .toFile(path.join(root, "img/home-og.jpg"));
console.log(`home og ${featured.id} ${featured.name}`);

if (homeOnly) process.exit(0);

let written = 0;
let missing = 0;
for (const entry of catalog) {
  const detail = [entry.region, gradeLabel(entry.grade)].filter(Boolean).join(" · ");
  const file = path.join(outDir, `${entry.id}.jpg`);
  const face = path.join(root, "img/bt_img", `${entry.id}.webp`);
  if (!existsSync(face)) {
    missing += 1;
    continue;
  }
  await writeCard(entry.id, entry.name, detail, file);
  written += 1;
  if (written % 80 === 0) console.log(`og ${written}`);
}
console.log(`og written ${written} missing ${missing}`);
