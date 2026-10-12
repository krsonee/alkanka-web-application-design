import { readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";

const [source, target] = process.argv.slice(2);
if (!source || !target) {
  throw new Error("kullanım: node scripts/prepare-logo.mjs <kaynak> <hedef>");
}

const png = PNG.sync.read(readFileSync(source));
const { width, height, data } = png;

const idx = (x, y) => (y * width + x) * 4;

let opaquePixels = 0;
for (let i = 3; i < data.length; i += 4) {
  if (data[i] > 250) opaquePixels += 1;
}
const alreadyTransparent = opaquePixels < width * height * 0.98;

// Beyaz zemini şeffaflaştır: parlaklığa göre yumuşak geçiş bırakarak
// kenarlarda beyaz hale oluşmasını engelliyoruz.
const WHITE_CUT = 246;
const SOFT_EDGE = 214;

if (!alreadyTransparent) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const min = Math.min(r, g, b);
    const max = Math.max(r, g, b);
    const isNeutral = max - min < 14;

    if (!isNeutral) continue;

    if (min >= WHITE_CUT) {
      data[i + 3] = 0;
    } else if (min >= SOFT_EDGE) {
      const ratio = (min - SOFT_EDGE) / (WHITE_CUT - SOFT_EDGE);
      data[i + 3] = Math.round(data[i + 3] * (1 - ratio));
    }
  }
}

let top = height;
let left = width;
let right = -1;
let bottom = -1;

for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    if (data[idx(x, y) + 3] > 8) {
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }
}

if (right < 0) throw new Error("görselde görünür piksel bulunamadı");

const pad = Math.round(Math.max(right - left, bottom - top) * 0.03);
left = Math.max(0, left - pad);
top = Math.max(0, top - pad);
right = Math.min(width - 1, right + pad);
bottom = Math.min(height - 1, bottom + pad);

const outWidth = right - left + 1;
const outHeight = bottom - top + 1;
const out = new PNG({ width: outWidth, height: outHeight });

for (let y = 0; y < outHeight; y += 1) {
  for (let x = 0; x < outWidth; x += 1) {
    const from = idx(left + x, top + y);
    const to = (y * outWidth + x) * 4;
    out.data[to] = data[from];
    out.data[to + 1] = data[from + 1];
    out.data[to + 2] = data[from + 2];
    out.data[to + 3] = data[from + 3];
  }
}

writeFileSync(target, PNG.sync.write(out));
console.log(
  `${width}x${height} -> ${outWidth}x${outHeight} | zaten şeffaf: ${alreadyTransparent}`,
);
