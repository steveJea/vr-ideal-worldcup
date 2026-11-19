export function siteOrigin() {
  const configured = String(window.VR_CONFIG?.publicOrigin || "").replace(/\/$/, "");
  if (/^https?:\/\//i.test(configured)) return configured;
  return location.origin;
}

export function apiUrl(path) {
  const base = String(window.VR_CONFIG?.apiBase || "").replace(/\/$/, "");
  return `${base}${path}`;
}

export function resultUrl(id) {
  return `${siteOrigin()}/r/${id}`;
}

export function portraitUrl(id) {
  return `img/bt_img/${id}.webp`;
}

export function ogImageUrl(id) {
  return `${siteOrigin()}/img/og/${id}.jpg`;
}

export function shareTitle(name) {
  return `내 최애 히로인 — ${name}`;
}

export function xIntent(name, url) {
  const intent = new URL("https://x.com/intent/tweet");
  intent.searchParams.set("text", shareTitle(name));
  intent.searchParams.set("url", url);
  return intent.toString();
}

export function activeChannels() {
  const list = Array.isArray(window.VR_CONFIG?.channels) ? window.VR_CONFIG.channels : [];
  return list.filter((channel) => {
    const url = String(channel?.url || "").trim();
    const label = String(channel?.label || "").trim();
    return label && /^https:\/\//i.test(url);
  }).map((channel) => ({
    id: String(channel.id || channel.label),
    label: String(channel.label).trim(),
    url: String(channel.url).trim(),
  }));
}

export function kakaoConfigured() {
  return Boolean(String(window.VR_CONFIG?.kakaoJsKey || "").trim());
}

let kakaoLoader;

function loadKakaoSdk(key) {
  if (window.Kakao?.isInitialized?.()) return Promise.resolve();
  if (!kakaoLoader) {
    kakaoLoader = new Promise((resolve, reject) => {
      const finish = () => {
        if (!window.Kakao) {
          reject(new Error("kakao"));
          return;
        }
        if (!window.Kakao.isInitialized()) window.Kakao.init(key);
        resolve();
      };
      if (window.Kakao) {
        finish();
        return;
      }
      const script = document.createElement("script");
      script.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js";
      script.crossOrigin = "anonymous";
      script.async = true;
      script.onload = finish;
      script.onerror = () => reject(new Error("kakao"));
      document.head.appendChild(script);
    });
  }
  return kakaoLoader;
}

// Dedicated KakaoTalk button. Stays unused until kakaoJsKey is set.
export async function shareToKakao({ name, imageUrl, url }) {
  const key = String(window.VR_CONFIG?.kakaoJsKey || "").trim();
  if (!key) return false;
  await loadKakaoSdk(key);
  if (!window.Kakao?.Share) return false;
  window.Kakao.Share.sendDefault({
    objectType: "feed",
    content: {
      title: shareTitle(name),
      description: "VR 이상형 월드컵",
      imageUrl,
      link: { mobileWebUrl: url, webUrl: url },
    },
    buttons: [{ title: "결과 보기", link: { mobileWebUrl: url, webUrl: url } }],
  });
  return true;
}

export async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

export async function shareNative({ title, text, url, file }) {
  if (!navigator.share) return "unsupported";
  const payload = { title, text, url };
  if (file && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ ...payload, files: [file] });
      return "shared";
    } catch (error) {
      if (error?.name === "AbortError") return "aborted";
    }
  }
  try {
    await navigator.share(payload);
    return "shared";
  } catch (error) {
    if (error?.name === "AbortError") return "aborted";
    return "failed";
  }
}
