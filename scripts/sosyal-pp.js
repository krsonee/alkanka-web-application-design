const sharp = require("sharp")
const fs = require("fs")
const path = require("path")

const root = path.join(__dirname, "..", "public", "images")
const out = path.join(root, "sosyal-pp")
const sizes = { telegram: 640, youtube: 800, instagram: 1080 }
const navy = "#0b1730"

async function squareBuffer(file) {
  const img = sharp(file)
  const { width, height, hasAlpha } = await img.metadata()
  if (width === height) return img.flatten({ background: navy }).png().toBuffer()
  if (hasAlpha) {
    const side = Math.round(Math.max(width, height) * 1.15)
    return sharp({ create: { width: side, height: side, channels: 4, background: navy } })
      .composite([{ input: await img.png().toBuffer(), gravity: "south" }])
      .flatten({ background: navy })
      .png()
      .toBuffer()
  }
  // Wide scenes: keep slightly more than the height so the head stays inside the circular crop, then pad top/bottom with edge pixels.
  const cropW = Math.min(width, Math.round(height * 1.15))
  const pad = Math.round((cropW - height) / 2)
  return sharp(file)
    .extract({ left: Math.round((width - cropW) / 2), top: 0, width: cropW, height })
    .extend({ top: pad, bottom: cropW - height - pad, extendWith: "copy" })
    .png()
    .toBuffer()
}

;(async () => {
  const sources = [
    ...fs
      .readdirSync(path.join(root, "profil-fotograflari"))
      .filter((f) => f.includes("jako"))
      .map((f) => [path.join(root, "profil-fotograflari", f), f.replace(/\.png$/, "")]),
    ...fs
      .readdirSync(path.join(root, "mascots"))
      .filter((f) => f.startsWith("jako") && !f.includes("-cut") && f !== "jako-telegram.png")
      .map((f) => [path.join(root, "mascots", f), "maskot-" + f.replace(/\.png$/, "")]),
  ]
  for (const dir of Object.keys(sizes)) fs.mkdirSync(path.join(out, dir), { recursive: true })
  for (const [file, name] of sources) {
    const sq = await squareBuffer(file)
    for (const [dir, s] of Object.entries(sizes)) {
      await sharp(sq).resize(s, s).jpeg({ quality: 92, mozjpeg: true }).toFile(path.join(out, dir, `${name}-${s}.jpg`))
    }
  }
  console.log(sources.length, "karakter")
})()
