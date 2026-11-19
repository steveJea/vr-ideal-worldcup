export const GRADE_LABELS = {
  NORMAL: "노멀",
  RARE: "레어",
  "HIGH RARE": "하이 레어",
  "SUPER RARE": "슈퍼 레어",
  "ULTRA RARE": "울트라 레어",
  "MYTHIC RARE": "미스릭 레어",
};

export const CLASS_LABELS = {
  FIRE: "화염",
  WIND: "바람",
  ICE: "얼음",
  DARK: "어둠",
  LIGHT: "빛",
};

export const ATTRIBUTE_LABELS = {
  CHARGE: "돌격",
  CRUSH: "파쇄",
  DEFENSE: "수호",
  SUPPORT: "지원",
  DISTURB: "교란",
  FASCINATION: "매혹",
  OVERWHELMING: "압도",
  FURIOUS: "격노",
  PHENOMENAL: "경이",
  EXTERMINATE: "섬멸",
};

const HIDDEN_CLASS = "ABYSS";

export function gradeLabel(value) {
  return GRADE_LABELS[value] || "";
}

export function classLabel(value) {
  if (!value || String(value).toUpperCase() === HIDDEN_CLASS) return "";
  return CLASS_LABELS[value] || "";
}

export function attributeLabel(value) {
  return ATTRIBUTE_LABELS[value] || "";
}

export function factList(heroine) {
  return [heroine.region, gradeLabel(heroine.grade), classLabel(heroine.class), attributeLabel(heroine.attribute)].filter(Boolean);
}
