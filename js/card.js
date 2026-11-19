import { portraitUrl } from "./share.js";

let fontsReady;

function loadCardFonts() {
  if (!fontsReady) {
    fontsReady = (async () => {
      const faces = [
        ["400", "/fonts/Pretendard-Regular.woff2"],
        ["600", "/fonts/Pretendard-SemiBold.woff2"],
        ["800", "/fonts/Pretendard-ExtraBold.woff2"],
      ];
      await Promise.all(faces.map(async ([weight, url]) => {
        const face = new FontFace("Pretendard", `url(${url})`, { weight, style: "normal" });
        await face.load();
        document.fonts.add(face);
      }));
    })();
  }
  return fontsReady;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image"));
    image.src = src;
  });
}

function drawCover(ctx, image, x, y, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sx = (image.width - sourceWidth) / 2;
  const sy = Math.max(0, (image.height - sourceHeight) * 0.08);
  ctx.drawImage(image, sx, sy, sourceWidth, sourceHeight, x, y, width, height);
}

function fitFont(ctx, text, weight, startSize, maxWidth) {
  let size = startSize;
  while (size > 36) {
    ctx.font = `${weight} ${size}px Pretendard, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 4;
  }
  ctx.font = `${weight} ${size}px Pretendard, sans-serif`;
  return size;
}

export async function renderFavoriteCard(heroine, options) {
  await loadCardFonts();
  const width = 1080;
  const height = 1440;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#10080b";
  ctx.fillRect(0, 0, width, height);

  try {
    const image = await loadImage(portraitUrl(heroine.id));
    drawCover(ctx, image, 0, 0, width, height);
  } catch {
    ctx.fillStyle = "#1a0e12";
    ctx.fillRect(0, 0, width, height);
  }

  const fade = ctx.createLinearGradient(0, 760, 0, height);
  fade.addColorStop(0, "rgba(16,8,11,0)");
  fade.addColorStop(0.38, "rgba(16,8,11,0.55)");
  fade.addColorStop(1, "rgba(16,8,11,0.94)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 760, width, height - 760);

  const top = ctx.createLinearGradient(0, 0, 0, 220);
  top.addColorStop(0, "rgba(16,8,11,0.45)");
  top.addColorStop(1, "rgba(16,8,11,0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, width, 220);

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#e6c98a";
  ctx.font = "500 42px 'Cormorant Garamond', serif";
  ctx.fillText("VR", 78, 110);

  ctx.fillStyle = "#e6c98a";
  ctx.font = "600 34px Pretendard, sans-serif";
  ctx.fillText("내 최애 히로인", 78, 1124);

  const nameSize = fitFont(ctx, heroine.name, 800, 84, 920);
  ctx.fillStyle = "#f4efe8";
  ctx.font = `800 ${nameSize}px Pretendard, sans-serif`;
  ctx.fillText(heroine.name, 78, 1124 + 36 + nameSize * 0.82);

  ctx.strokeStyle = "rgba(230,201,138,0.85)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(78, 1272);
  ctx.lineTo(246, 1272);
  ctx.stroke();

  const detail = (heroine.lines || []).filter(Boolean).slice(0, 3).join("  ·  ");
  ctx.fillStyle = "rgba(244,239,232,0.84)";
  ctx.font = "400 28px Pretendard, sans-serif";
  if (detail) ctx.fillText(detail, 78, 1316);

  const host = String(options.host || location.host);
  ctx.fillStyle = "rgba(244,239,232,0.72)";
  ctx.font = "400 26px Pretendard, sans-serif";
  ctx.fillText(host, 78, 1368);

  ctx.strokeStyle = "rgba(230,201,138,0.55)";
  ctx.lineWidth = 3;
  ctx.strokeRect(36, 36, width - 72, height - 72);
  return canvas;
}

export function canvasFile(canvas, filename) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve(null);
        return;
      }
      resolve(new File([blob], filename, { type: "image/png" }));
    }, "image/png");
  });
}

export function downloadCanvas(canvas, filename) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  document.body.appendChild(link);
  link.click();
  link.remove();
}
