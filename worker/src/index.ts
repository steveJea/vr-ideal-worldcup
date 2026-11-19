import catalogJson from "../../data/catalog.json";
import { fromD1 } from "./d1";
import { renderMissingPage, renderSharePage, type ShareHeroine } from "./share-page";
import { createRun, getRanking, recordWin } from "./store";
import { isHeroineId, isUuid, rateBucket } from "./validate";

interface CatalogEntry extends ShareHeroine {
  gender: string;
}

const catalog = catalogJson as CatalogEntry[];
const byId = new Map(catalog.map((entry) => [entry.id, entry]));
const ids = new Set(byId.keys());

function numberVar(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function json(body: unknown, status = 200, cache = "no-store"): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type",
      "cache-control": cache,
    },
  });
}

function clientAddress(request: Request): string {
  return request.headers.get("CF-Connecting-IP") || "0";
}

async function readJson(request: Request): Promise<unknown> {
  const claimed = Number(request.headers.get("content-length") || 0);
  if (claimed > 2048) throw new Error("too_large");
  const text = await request.text();
  if (text.length > 2048) throw new Error("too_large");
  return JSON.parse(text);
}

function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300",
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
    },
  });
}

async function imageFor(request: Request, env: Env, id: string): Promise<string> {
  const origin = new URL(request.url).origin;
  const jpg = `/img/og/${id}.jpg`;
  const probe = await env.ASSETS.fetch(new Request(new URL(jpg, origin)));
  await probe.body?.cancel();
  if (probe.ok) return `${origin}${jpg}`;
  return `${origin}/img/bt_img/${id}.webp`;
}

async function rewriteHome(request: Request, env: Env): Promise<Response> {
  const assetUrl = new URL(request.url);
  assetUrl.pathname = "/index.html";
  const response = await env.ASSETS.fetch(new Request(assetUrl.toString(), request));
  if (!response.ok) return response;
  const page = (await response.text()).replaceAll("__ORIGIN__", new URL(request.url).origin);
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "public, max-age=60");
  return new Response(page, { status: 200, headers });
}

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.method === "OPTIONS") return json({ ok: true }, 204);
  const sql = fromD1(env.DB);
  const now = Date.now();
  const windowMs = numberVar(env.WINDOW_MS, 3_600_000);
  const salt = env.RATE_SALT || "vr-wcup-public-rate-v1";

  if (url.pathname === "/api/ranking") {
    if (request.method !== "GET") return json({ ok: false, error: "method" }, 405);
    const ranking = await getRanking(sql);
    const entries = ranking.entries.map((entry) => ({
      id: entry.id,
      name: byId.get(entry.id)?.name || "",
      wins: entry.wins,
      share: entry.share,
    }));
    return json({ ok: true, total: ranking.total, entries }, 200, "public, max-age=15");
  }

  if (url.pathname === "/api/runs") {
    if (request.method !== "POST") return json({ ok: false, error: "method" }, 405);
    const bucket = await rateBucket(clientAddress(request), salt, "run");
    const created = await createRun(sql, {
      now,
      windowMs,
      runTtlMs: numberVar(env.RUN_TTL_MS, 21_600_000),
      runsPerHour: numberVar(env.RUNS_PER_HOUR, 30),
      bucket,
    });
    if (!created.ok) return json({ ok: false, error: "rate_limited" }, 429);
    console.log(JSON.stringify({ message: "run_opened" }));
    return json({ ok: true, runId: created.runId }, 201);
  }

  if (url.pathname === "/api/wins") {
    if (request.method !== "POST") return json({ ok: false, error: "method" }, 405);
    let body: unknown;
    try {
      body = await readJson(request);
    } catch {
      return json({ ok: false, error: "bad_request" }, 400);
    }
    const record = body && typeof body === "object" ? body as { runId?: unknown; heroineId?: unknown } : {};
    if (!isUuid(record.runId) || !isHeroineId(record.heroineId, ids)) {
      return json({ ok: false, error: "bad_request" }, 400);
    }
    const bucket = await rateBucket(clientAddress(request), salt, "win");
    const result = await recordWin(sql, {
      runId: record.runId,
      heroineId: record.heroineId,
      now,
      minRunMs: numberVar(env.MIN_RUN_MS, 2500),
      windowMs,
      winsPerHour: numberVar(env.WINS_PER_HOUR, 40),
      bucket,
    });
    console.log(JSON.stringify({
      message: "win_posted",
      counted: "counted" in result ? result.counted : false,
      heroineId: record.heroineId,
      error: "error" in result ? result.error : "",
    }));
    const payload = "wins" in result
      ? { ok: true, counted: true, wins: result.wins }
      : "reason" in result
        ? { ok: true, counted: false, reason: result.reason }
        : { ok: false, error: result.error, retryAfterMs: "retryAfterMs" in result ? result.retryAfterMs : undefined };
    return json(payload, result.status);
  }

  return json({ ok: false, error: "not_found" }, 404);
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/" || url.pathname === "/index.html") return await rewriteHome(request, env);
      if (url.pathname.startsWith("/api/")) return await handleApi(request, env, url);
      const share = url.pathname.match(/^\/r\/([0-9]{5})\/?$/);
      if (share) {
        const heroine = byId.get(share[1]);
        const origin = url.origin;
        if (!heroine) return html(renderMissingPage(origin), 404);
        const image = await imageFor(request, env, heroine.id);
        return html(renderSharePage({
          heroine,
          origin,
          image,
          portrait: `${origin}/img/bt_img/${heroine.id}.webp`,
        }));
      }
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error(JSON.stringify({
        message: "request_failed",
        error: error instanceof Error ? error.message : "error",
      }));
      return json({ ok: false, error: "unavailable" }, 503);
    }
  },
} satisfies ExportedHandler<Env>;
