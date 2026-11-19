import { apiUrl } from "./share.js";

export function presentEntry(entry, lookup) {
  const local = lookup?.get?.(entry.id);
  return {
    id: String(entry.id || ""),
    name: local?.name || entry.name || "이름 없음",
    wins: Number(entry.wins) || 0,
    share: Number(entry.share) || 0,
  };
}

export async function fetchRanking(lookup) {
  const response = await fetch(apiUrl("/api/ranking"), { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("ranking");
  const data = await response.json();
  const entries = Array.isArray(data.entries) ? data.entries : [];
  return {
    total: Number(data.total) || 0,
    entries: entries.map((entry) => presentEntry(entry, lookup)),
  };
}

export async function requestRun() {
  try {
    const response = await fetch(apiUrl("/api/runs"), {
      method: "POST",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return typeof data.runId === "string" ? data.runId : null;
  } catch {
    return null;
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function publishWin(runId, heroineId) {
  if (!runId) return "offline";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(apiUrl("/api/wins"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runId, heroineId }),
        signal: AbortSignal.timeout(8000),
      });
      const data = await response.json().catch(() => ({}));
      if (data.error === "too_early" && attempt < 2) {
        await wait(Number(data.retryAfterMs) || 800);
        continue;
      }
      if (data.counted) return "counted";
      if (data.reason === "duplicate") return "duplicate";
      if (data.error === "rate_limited") return "limited";
      return "offline";
    } catch {
      return "offline";
    }
  }
  return "offline";
}

export function statusCopy(state) {
  if (state === "counted") return "전체 순위에 반영했습니다.";
  if (state === "duplicate") return "이미 전체 순위에 반영된 결과입니다.";
  if (state === "limited") return "지금은 순위에 더 반영할 수 없습니다. 결과는 이 화면에 남아 있습니다.";
  return "순위 서버에 연결되지 않았습니다. 토너먼트 결과는 그대로 볼 수 있습니다.";
}
