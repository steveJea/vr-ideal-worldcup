import { renderFavoriteCard, canvasFile, downloadCanvas } from "./card.js";
import { filterByGender, loadHeroines } from "./data.js";
import { factList } from "./labels.js";
import { fetchRanking, publishWin, requestRun, statusCopy } from "./ranking.js";
import {
  activeChannels,
  copyText,
  kakaoConfigured,
  ogImageUrl,
  portraitUrl,
  resultUrl,
  shareNative,
  shareTitle,
  shareToKakao,
  siteOrigin,
  xIntent,
} from "./share.js";
import { choose, currentPair, matchProgress, startBracket } from "./tournament.js";

const state = {
  roster: [],
  gender: "female",
  size: 16,
  bracket: null,
  busy: false,
  returnView: "home",
  winner: null,
  canvas: null,
  runPromise: Promise.resolve(null),
  published: false,
};

const $ = (id) => document.getElementById(id);
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function showView(name) {
  for (const view of ["home", "match", "result", "rank"]) {
    $(`view-${view}`).hidden = view !== name;
  }
  document.body.dataset.view = name;
  window.scrollTo(0, 0);
}

let toastTimer;
function toast(message) {
  const node = $("toast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove("show"), 2400);
}

function countLabel(mode) {
  return filterByGender(state.roster, mode).length;
}

function syncSetup() {
  const available = countLabel(state.gender);
  for (const button of document.querySelectorAll("#sizes button")) {
    const size = Number(button.dataset.size);
    const enabled = available >= size;
    button.disabled = !enabled;
    if (!enabled && state.size === size) state.size = 16;
  }
  for (const button of document.querySelectorAll("#gender button")) {
    button.setAttribute("aria-pressed", String(button.dataset.gender === state.gender));
  }
  for (const button of document.querySelectorAll("#sizes button")) {
    button.setAttribute("aria-pressed", String(Number(button.dataset.size) === state.size));
  }
  const noun = state.gender === "male" ? "남성" : state.gender === "all" ? "전체" : "여성";
  $("roster-note").textContent = state.roster.length
    ? `${noun} ${available}명 중에서 ${state.size}강을 진행합니다.`
    : "";
  const start = $("start");
  start.disabled = available < state.size;
  if (!start.disabled) start.textContent = "토너먼트 열기";
}

function renderChannels() {
  const channels = activeChannels();
  const section = $("channels");
  const list = $("channel-list");
  list.replaceChildren();
  if (!channels.length) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  for (const channel of channels) {
    const link = document.createElement("a");
    link.href = channel.url;
    link.textContent = channel.label;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    list.append(link);
  }
}

function renderFighter(button, heroine) {
  button.replaceChildren();
  const image = document.createElement("img");
  image.src = portraitUrl(heroine.id);
  image.alt = heroine.name;
  const shade = document.createElement("span");
  shade.className = "shade";
  const who = document.createElement("span");
  who.className = "who";
  const name = document.createElement("span");
  name.className = "who-name";
  name.textContent = heroine.name;
  who.append(name);
  const facts = factList(heroine).slice(0, 2);
  if (facts.length) {
    const meta = document.createElement("span");
    meta.className = "who-meta";
    meta.textContent = facts.join(" · ");
    who.append(meta);
  }
  button.append(image, shade, who);
  button.dataset.id = heroine.id;
  button.setAttribute("aria-label", `${heroine.name} 선택`);
}

function renderMatch() {
  const pair = currentPair(state.bracket);
  if (pair.length < 2) return;
  renderFighter($("fighter-a"), pair[0]);
  renderFighter($("fighter-b"), pair[1]);
  const progress = matchProgress(state.bracket);
  $("round-label").textContent = progress.round;
  $("match-count").textContent = `${progress.current} / ${progress.total}`;
  const ratio = progress.total ? progress.current / progress.total : 0;
  $("meter-bar").style.width = `${ratio * 100}%`;
}

function splash(label) {
  $("splash-label").textContent = label;
  $("splash").hidden = false;
  const delay = reducedMotion ? 0 : 680;
  return new Promise((resolve) => {
    setTimeout(() => {
      $("splash").hidden = true;
      resolve();
    }, delay);
  });
}

function closeSheet() {
  $("sheet").hidden = true;
}

function openSheet(heroine) {
  $("sheet-title").textContent = "이 사람으로 갈까요?";
  $("sheet-photo").src = portraitUrl(heroine.id);
  $("sheet-photo").alt = heroine.name;
  $("sheet-name").textContent = heroine.name;
  $("sheet-ok").textContent = "이 사람으로";
  $("sheet-cancel").textContent = "다시 보기";
  $("sheet").hidden = false;
  $("sheet-ok").onclick = () => confirmPick(heroine);
  $("sheet-cancel").onclick = closeSheet;
  $("sheet-ok").focus();
}

function askQuit() {
  $("sheet-title").textContent = "토너먼트를 끝낼까요?";
  $("sheet-photo").removeAttribute("src");
  $("sheet-photo").alt = "";
  $("sheet-name").textContent = "지금까지의 선택은 순위에 남지 않습니다.";
  $("sheet-ok").textContent = "처음으로";
  $("sheet-cancel").textContent = "계속";
  $("sheet").hidden = false;
  $("sheet-ok").onclick = () => {
    closeSheet();
    state.bracket = null;
    showView("home");
  };
  $("sheet-cancel").onclick = closeSheet;
}

async function confirmPick(heroine) {
  if (state.busy || !state.bracket) return;
  state.busy = true;
  closeSheet();
  const result = choose(state.bracket, heroine);
  state.bracket = result.state;
  if (result.event === "round") await splash(state.bracket.round);
  if (result.event === "done") {
    await showResult(state.bracket.winner);
    state.busy = false;
    return;
  }
  renderMatch();
  state.busy = false;
}

async function startTournament() {
  const bracket = startBracket(filterByGender(state.roster, state.gender), state.size);
  if (!bracket) {
    $("roster-note").textContent = "선택한 조건의 인원이 부족합니다.";
    return;
  }
  state.bracket = bracket;
  state.busy = true;
  state.published = false;
  state.winner = null;
  state.canvas = null;
  state.runPromise = requestRun();
  showView("match");
  await splash(bracket.round);
  renderMatch();
  state.busy = false;
}

function fileName(name) {
  const safe = name.replace(/[\\/:*?"<>|]/g, "").trim() || "heroine";
  return `내-최애-히로인-${safe}.png`;
}

async function showResult(heroine) {
  state.winner = heroine;
  $("winner-name").textContent = heroine.name;
  const facts = $("winner-facts");
  facts.replaceChildren();
  for (const fact of factList(heroine)) {
    const item = document.createElement("li");
    item.textContent = fact;
    facts.append(item);
  }
  const poster = $("poster");
  poster.src = portraitUrl(heroine.id);
  poster.alt = `${heroine.name}, 내 최애 히로인`;
  $("rank-status").textContent = "순위를 확인하고 있습니다.";
  $("share-kakao").hidden = !kakaoConfigured();
  showView("result");

  const host = siteOrigin().replace(/^https?:\/\//, "");
  try {
    state.canvas = await renderFavoriteCard(
      { id: heroine.id, name: heroine.name, lines: factList(heroine).slice(0, 3) },
      { host },
    );
    poster.src = state.canvas.toDataURL("image/png");
  } catch (error) {
    console.error(JSON.stringify({ message: "card_failed" }));
    state.canvas = null;
  }

  if (!state.published) {
    state.published = true;
    const runId = await state.runPromise;
    const outcome = await publishWin(runId, heroine.id);
    $("rank-status").textContent = statusCopy(outcome);
  }
}

function renderRank(data) {
  const list = $("rank-list");
  list.replaceChildren();
  $("rank-empty").hidden = data.entries.length > 0;
  $("rank-error").hidden = true;
  $("rank-retry").hidden = true;
  $("rank-total").textContent = data.total ? `집계된 우승 ${data.total}회` : "";
  const leader = data.entries[0]?.wins || 1;
  data.entries.forEach((entry, index) => {
    const item = document.createElement("li");
    item.className = index === 0 ? "rank-item lead" : "rank-item";
    const place = document.createElement("span");
    place.className = "place";
    place.textContent = String(index + 1);
    const image = document.createElement("img");
    image.src = portraitUrl(entry.id);
    image.alt = entry.name;
    const meta = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = entry.name;
    const bar = document.createElement("div");
    bar.className = "bar";
    const fill = document.createElement("span");
    fill.style.width = `${Math.max(4, (entry.wins / leader) * 100)}%`;
    bar.append(fill);
    meta.append(name, bar);
    const stat = document.createElement("div");
    stat.className = "stat";
    const wins = document.createElement("b");
    wins.textContent = `${entry.wins}승`;
    const share = document.createElement("small");
    share.textContent = `${entry.share}%`;
    stat.append(wins, share);
    item.append(place, image, meta, stat);
    list.append(item);
  });
}

async function openRank(from) {
  state.returnView = from;
  showView("rank");
  $("rank-list").replaceChildren();
  $("rank-empty").hidden = true;
  $("rank-error").hidden = true;
  $("rank-total").textContent = "불러오는 중";
  try {
    const lookup = new Map(state.roster.map((heroine) => [heroine.id, heroine]));
    renderRank(await fetchRanking(lookup));
  } catch {
    $("rank-total").textContent = "";
    $("rank-error").hidden = false;
    $("rank-error").textContent = "순위를 불러오지 못했습니다. 토너먼트는 계속 진행할 수 있습니다.";
    $("rank-retry").hidden = false;
  }
}

function bind() {
  for (const button of document.querySelectorAll("#gender button")) {
    button.addEventListener("click", () => {
      state.gender = button.dataset.gender;
      syncSetup();
    });
  }
  for (const button of document.querySelectorAll("#sizes button")) {
    button.addEventListener("click", () => {
      if (button.disabled) return;
      state.size = Number(button.dataset.size);
      syncSetup();
    });
  }
  $("setup").addEventListener("submit", (event) => {
    event.preventDefault();
    startTournament();
  });
  $("fighter-a").addEventListener("click", () => {
    const pair = state.bracket ? currentPair(state.bracket) : [];
    if (pair[0]) openSheet(pair[0]);
  });
  $("fighter-b").addEventListener("click", () => {
    const pair = state.bracket ? currentPair(state.bracket) : [];
    if (pair[1]) openSheet(pair[1]);
  });
  $("quit").addEventListener("click", askQuit);
  $("open-rank").addEventListener("click", () => openRank("home"));
  $("result-rank").addEventListener("click", () => openRank("result"));
  $("rank-back").addEventListener("click", () => showView(state.returnView));
  $("rank-retry").addEventListener("click", () => openRank(state.returnView));
  $("result-home").addEventListener("click", () => showView("home"));
  $("again").addEventListener("click", () => {
    showView("home");
    $("start").focus();
  });
  $("sheet").addEventListener("click", (event) => {
    if (event.target === $("sheet")) closeSheet();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !$("sheet").hidden) closeSheet();
  });
  $("save-card").addEventListener("click", () => {
    if (!state.canvas || !state.winner) return;
    downloadCanvas(state.canvas, fileName(state.winner.name));
    toast("이미지를 저장했습니다.");
  });
  $("copy-link").addEventListener("click", async () => {
    if (!state.winner) return;
    const ok = await copyText(resultUrl(state.winner.id));
    toast(ok ? "링크를 복사했습니다." : "링크를 복사하지 못했습니다.");
  });
  $("share-x").addEventListener("click", () => {
    if (!state.winner) return;
    window.open(xIntent(state.winner.name, resultUrl(state.winner.id)), "_blank", "noopener,noreferrer");
  });
  $("native-share").addEventListener("click", async () => {
    if (!state.winner) return;
    const url = resultUrl(state.winner.id);
    const file = state.canvas ? await canvasFile(state.canvas, fileName(state.winner.name)) : null;
    const outcome = await shareNative({
      title: shareTitle(state.winner.name),
      text: shareTitle(state.winner.name),
      url,
      file,
    });
    if (outcome === "shared" || outcome === "aborted") return;
    const ok = await copyText(url);
    toast(ok ? "링크를 복사했습니다." : "공유하지 못했습니다.");
  });
  $("share-kakao").addEventListener("click", async () => {
    if (!state.winner) return;
    try {
      const ok = await shareToKakao({
        name: state.winner.name,
        imageUrl: ogImageUrl(state.winner.id),
        url: resultUrl(state.winner.id),
      });
      if (!ok) toast("카카오톡 공유를 준비하지 못했습니다.");
    } catch {
      toast("카카오톡 공유를 준비하지 못했습니다.");
    }
  });
}

async function boot() {
  bind();
  renderChannels();
  try {
    state.roster = await loadHeroines();
    syncSetup();
  } catch {
    $("start").textContent = "명단을 불러오지 못했습니다";
    $("roster-note").textContent = "새로고침한 뒤 다시 열어 주세요.";
  }
}

boot();
