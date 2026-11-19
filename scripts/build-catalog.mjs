import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { parseHeroines } from "../js/data.js";

const csv = readFileSync(new URL("../VR_DATA.csv", import.meta.url), "utf8");
const heroines = parseHeroines(csv);
if (!heroines.length) throw new Error("catalog empty");
if (heroines.some((heroine) => Object.prototype.hasOwnProperty.call(heroine, "age"))) {
  throw new Error("age leaked into catalog");
}
mkdirSync(new URL("../data/", import.meta.url), { recursive: true });
writeFileSync(new URL("../data/catalog.json", import.meta.url), `${JSON.stringify(heroines)}\n`);
console.log(`catalog ${heroines.length}`);
