import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { parseHeroines, filterByGender } from "../js/data.js";
import { classLabel, factList } from "../js/labels.js";
import { bracketSize, choose, currentPair, matchProgress, roundName, startBracket } from "../js/tournament.js";
import { createRun, getRanking, recordWin } from "../worker/src/store.ts";
import { renderSharePage } from "../worker/src/share-page.ts";
import { isHeroineId, isUuid, rateBucket } from "../worker/src/validate.ts";

const zero = () => 0;

function people(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: String(10000 + index),
    name: `히로인${index}`,
    gender: index % 2 ? "MALE" : "FEMALE",
    region: "강남구",
    grade: "RARE",
    class: "FIRE",
    attribute: "CHARGE",
  }));
}

test("parser drops the age column", () => {
  const csv = "id,name,gender,age,region,grade,class,attribute\n10127,박인영,FEMALE,97,동대문구,SUPER RARE,LIGHT,CHARGE\n";
  const [heroine] = parseHeroines(csv);
  assert.equal(heroine.name, "박인영");
  assert.equal(heroine.gender, "FEMALE");
  assert.equal("age" in heroine, false);
  assert.equal(JSON.stringify(heroine).includes("97"), false);
  assert.equal(JSON.stringify(heroine).includes("age"), false);
});

test("real roster has no age and keeps both genders", () => {
  const heroines = parseHeroines(readFileSync("VR_DATA.csv", "utf8"));
  assert.ok(heroines.length > 400);
  assert.equal(heroines.some((heroine) => "age" in heroine), false);
  assert.ok(filterByGender(heroines, "female").length > 200);
  assert.ok(filterByGender(heroines, "male").length > 100);
  assert.equal(filterByGender(heroines, "all").length, heroines.length);
});

test("hidden class is not shown", () => {
  assert.equal(classLabel("ABYSS"), "");
  assert.equal(classLabel("FIRE"), "화염");
  const facts = factList({ region: "강남구", grade: "RARE", class: "ABYSS", attribute: "FURIOUS" });
  assert.deepEqual(facts, ["강남구", "레어", "격노"]);
  assert.equal(facts.join(" ").includes("ABYSS"), false);
});

test("bracket eliminates down to one winner", () => {
  const roster = people(18);
  assert.equal(bracketSize(18, 16), 16);
  assert.equal(bracketSize(3, 16), 2);
  assert.equal(roundName(2), "결승");
  let state = startBracket(roster, 16, zero);
  assert.equal(state.queue.length, 16);
  assert.equal(state.round, "16강");
  let guard = 0;
  while (!state.over) {
    const [left] = currentPair(state);
    const progress = matchProgress(state);
    assert.ok(progress.current <= progress.total);
    state = choose(state, left, zero).state;
    guard += 1;
    assert.ok(guard < 40);
  }
  assert.equal(guard, 15);
  assert.ok(roster.some((heroine) => heroine.id === state.winner.id));
  const finalists = people(2);
  const decided = choose({
    queue: finalists,
    next: [],
    round: "결승",
    over: false,
    winner: null,
  }, finalists[1], zero);
  assert.equal(decided.event, "done");
  assert.equal(decided.state.winner.id, finalists[1].id);
});

function memorySql() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync("migrations/0001_init.sql", "utf8"));
  return {
    async first(query, ...binds) {
      return db.prepare(query).get(...binds) ?? null;
    },
    async all(query, ...binds) {
      return db.prepare(query).all(...binds);
    },
    async run(query, ...binds) {
      return { changes: Number(db.prepare(query).run(...binds).changes ?? 0) };
    },
  };
}

test("a finished run counts once and ranking shares add up", async () => {
  const sql = memorySql();
  const opened = await createRun(sql, {
    now: 1_000,
    windowMs: 3_600_000,
    runTtlMs: 10_000,
    runsPerHour: 2,
    bucket: "run:test",
  });
  assert.equal(opened.ok, true);
  const early = await recordWin(sql, {
    runId: opened.runId,
    heroineId: "10127",
    now: 2_000,
    minRunMs: 2_500,
    windowMs: 3_600_000,
    winsPerHour: 5,
    bucket: "win:test",
  });
  assert.equal(early.error, "too_early");

  const counted = await recordWin(sql, {
    runId: opened.runId,
    heroineId: "10127",
    now: 4_000,
    minRunMs: 2_500,
    windowMs: 3_600_000,
    winsPerHour: 5,
    bucket: "win:test",
  });
  assert.equal(counted.counted, true);
  assert.equal(counted.wins, 1);

  const duplicate = await recordWin(sql, {
    runId: opened.runId,
    heroineId: "10127",
    now: 5_000,
    minRunMs: 2_500,
    windowMs: 3_600_000,
    winsPerHour: 5,
    bucket: "win:test",
  });
  assert.equal(duplicate.reason, "duplicate");

  const second = await createRun(sql, {
    now: 6_000,
    windowMs: 3_600_000,
    runTtlMs: 10_000,
    runsPerHour: 2,
    bucket: "run:test",
  });
  await recordWin(sql, {
    runId: second.runId,
    heroineId: "10440",
    now: 9_000,
    minRunMs: 2_500,
    windowMs: 3_600_000,
    winsPerHour: 5,
    bucket: "win:test",
  });
  const blocked = await createRun(sql, {
    now: 9_100,
    windowMs: 3_600_000,
    runTtlMs: 10_000,
    runsPerHour: 2,
    bucket: "run:test",
  });
  assert.equal(blocked.error, "rate_limited");

  const ranking = await getRanking(sql);
  assert.equal(ranking.total, 2);
  assert.deepEqual(ranking.entries.map((entry) => entry.id), ["10127", "10440"]);
  assert.equal(ranking.entries[0].share, 50);
});

test("unknown runs are rejected and do not invent wins", async () => {
  const sql = memorySql();
  const result = await recordWin(sql, {
    runId: "11111111-1111-4111-8111-111111111111",
    heroineId: "10127",
    now: 10_000,
    minRunMs: 0,
    windowMs: 3_600_000,
    winsPerHour: 5,
    bucket: "win:unknown",
  });
  assert.equal(result.error, "unknown_run");
  assert.equal((await getRanking(sql)).total, 0);
});

test("share page shows the heroine and not an age", () => {
  const html = renderSharePage({
    heroine: {
      id: "10127",
      name: "박인영",
      region: "동대문구",
      grade: "SUPER RARE",
      class: "ABYSS",
      attribute: "CHARGE",
      age: "97",
    },
    origin: "https://preview.example",
    image: "https://preview.example/img/og/10127.jpg",
    portrait: "https://preview.example/img/bt_img/10127.webp",
  });
  assert.match(html, /내 최애 히로인 — 박인영/);
  assert.match(html, /property="og:image" content="https:\/\/preview\.example\/img\/og\/10127\.jpg"/);
  assert.match(html, /이상형 월드컵 보기/);
  assert.equal(html.includes("97"), false);
  assert.equal(html.includes("나이"), false);
  assert.equal(html.includes("ABYSS"), false);
  assert.equal(html.includes("어비스"), false);
  assert.match(html, /엔터인코드/);
});

test("ids and run tokens are checked before they are stored", () => {
  assert.equal(isUuid("11111111-1111-4111-8111-111111111111"), true);
  assert.equal(isUuid("not-a-uuid"), false);
  const ids = new Set(["10127"]);
  assert.equal(isHeroineId("10127", ids), true);
  assert.equal(isHeroineId("99999", ids), false);
});

test("rate limit key does not keep the address", async () => {
  const address = "203.0.113.44";
  const bucket = await rateBucket(address, "salt", "win");
  assert.equal(bucket.startsWith("win:"), true);
  assert.equal(bucket.includes(address), false);
  assert.equal(bucket, await rateBucket(address, "salt", "win"));
});

test("title visual features 임유리 without changing ranking code", () => {
  const html = readFileSync("index.html", "utf8");
  assert.match(html, /img\/teaser\/title\.webp\?v=3/);
  assert.match(html, /img\/teaser\/og\.jpg\?v=3/);
  assert.match(html, /summary_large_image/);
  assert.match(html, /og:image:width" content="1200"/);
  assert.match(html, /og:image:height" content="630"/);
  assert.match(html, /임유리/);
  assert.equal(html.includes("이미지 저장"), false);
  const rankingCode = [
    "js/ranking.js",
    "worker/src/store.ts",
    "worker/src/index.ts",
  ].map((file) => readFileSync(file, "utf8")).join("\n");
  assert.equal(rankingCode.includes("10325"), false);
  assert.equal(rankingCode.includes("임유리"), false);
});

test("new public copy avoids blocked phrases", () => {
  const files = [
    "index.html",
    "css/app.css",
    "README.md",
    "DEPLOY.md",
    ...readdirSync("js").map((name) => `js/${name}`),
    ...readdirSync("worker/src").map((name) => `worker/src/${name}`),
    ...readdirSync("scripts").map((name) => `scripts/${name}`),
  ];
  const banned = ["어비스", "지금 해보세요", "게임 시작", "플레이하기", "지금 플레이", "나이"];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const phrase of banned) {
      assert.equal(text.includes(phrase), false, `${file} contains ${phrase}`);
    }
  }
});
