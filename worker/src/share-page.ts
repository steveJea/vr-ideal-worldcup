import { attributeLabel, classLabel, factList, gradeLabel } from "../../js/labels.js";

export interface ShareHeroine {
  id: string;
  name: string;
  region: string;
  grade: string;
  class: string;
  attribute: string;
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

export function renderSharePage(input: {
  heroine: ShareHeroine;
  origin: string;
  image: string;
  portrait: string;
}): string {
  const { heroine, origin, image, portrait } = input;
  const name = escapeHtml(heroine.name);
  const title = `내 최애 히로인 — ${name}`;
  const facts = factList({
    region: heroine.region,
    grade: heroine.grade,
    class: heroine.class,
    attribute: heroine.attribute,
  });
  const description = escapeHtml(
    [heroine.name, heroine.region, gradeLabel(heroine.grade), classLabel(heroine.class), attributeLabel(heroine.attribute)]
      .filter(Boolean)
      .join(" · "),
  );
  const pageUrl = `${origin}/r/${encodeURIComponent(heroine.id)}`;
  const factHtml = facts.map((fact) => `<li>${escapeHtml(fact)}</li>`).join("");
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <meta name="theme-color" content="#10080b">
  <link rel="canonical" href="${pageUrl}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="VR 이상형 월드컵">
  <meta property="og:locale" content="ko_KR">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:image:alt" content="${name}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${escapeHtml(image)}">
  <link rel="icon" href="${origin}/favicon.png" type="image/png">
  <link rel="stylesheet" href="${origin}/css/app.css">
</head>
<body class="share-page">
  <main class="share">
    <p class="brand">VR</p>
    <p class="eyebrow">내 최애 히로인</p>
    <h1>${name}</h1>
    <ul class="facts">${factHtml}</ul>
    <img class="share-photo" src="${escapeHtml(portrait)}" alt="${name}">
    <a class="cta" href="${origin}/">이상형 월드컵 보기</a>
    <p class="legal">엔터인코드</p>
  </main>
</body>
</html>`;
}

export function renderMissingPage(origin: string): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>결과를 찾지 못했습니다</title>
  <meta name="robots" content="noindex">
  <link rel="stylesheet" href="${origin}/css/app.css">
</head>
<body>
  <main class="share">
    <p class="brand">VR</p>
    <h1>결과를 찾지 못했습니다</h1>
    <a class="cta" href="${origin}/">이상형 월드컵 보기</a>
  </main>
</body>
</html>`;
}
