// Public heroine fields. The CSV age column is intentionally not copied.
const PUBLIC_FIELDS = ["id", "name", "gender", "region", "grade", "class", "attribute"];

const HEADER_MAP = {
  id: "id",
  ID: "id",
  name: "name",
  이름: "name",
  gender: "gender",
  성별: "gender",
  region: "region",
  지역: "region",
  grade: "grade",
  등급: "grade",
  class: "class",
  클래스: "class",
  attribute: "attribute",
  속성: "attribute",
};

function splitRow(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

export function normalizeGender(value) {
  const token = String(value || "").trim().toUpperCase();
  if (token === "MALE" || token === "M" || token === "남" || token === "남성") return "MALE";
  if (token === "FEMALE" || token === "F" || token === "여" || token === "여성") return "FEMALE";
  return "";
}

export function toPublicHeroine(raw) {
  const heroine = {};
  for (const key of PUBLIC_FIELDS) heroine[key] = String(raw[key] || "").trim();
  heroine.gender = normalizeGender(heroine.gender);
  return heroine;
}

export function parseHeroines(csvText) {
  const text = String(csvText || "").replace(/^\uFEFF/, "").trim();
  if (!text) return [];
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = splitRow(lines[0]).map((header) => HEADER_MAP[header] || "");
  const heroines = [];
  for (const line of lines.slice(1)) {
    const cells = splitRow(line);
    const raw = {};
    headers.forEach((header, index) => {
      if (header) raw[header] = cells[index] || "";
    });
    const heroine = toPublicHeroine(raw);
    if (heroine.id && heroine.name) heroines.push(heroine);
  }
  return heroines;
}

export function filterByGender(list, mode) {
  if (mode === "all") return list.slice();
  const want = mode === "male" ? "MALE" : "FEMALE";
  return list.filter((heroine) => heroine.gender === want);
}

export async function loadHeroines() {
  const response = await fetch("VR_DATA.csv");
  if (!response.ok) throw new Error("csv");
  return parseHeroines(await response.text());
}
