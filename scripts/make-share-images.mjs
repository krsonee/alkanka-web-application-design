// Writes a light JPG copy of every page and game artwork into public/images/share and
// records them in lib/share-images.json. Link-preview tags point at these copies because
// WhatsApp and Telegram drop the preview when the image is much heavier than 300 KB.
// The originals are left untouched; the site keeps rendering them.
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, parse } from 'node:path'
import sharp from 'sharp'

const SOURCE_DIRS = ['heroes', 'games']
const OUT_DIR = 'public/images/share'
const MANIFEST = 'lib/share-images.json'
const MAX_WIDTH = 1200
const MAX_BYTES = 280 * 1024
const QUALITIES = [84, 78, 72, 66, 60]
const SOURCE = /\.(png|jpe?g)$/i
const onCi = Boolean(process.env.VERCEL || process.env.CI)

mkdirSync(OUT_DIR, { recursive: true })

async function encode(src, out) {
  for (const quality of QUALITIES) {
    const buffer = await sharp(src)
      .rotate()
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .flatten({ background: '#0b0b0f' })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer()
    if (buffer.length <= MAX_BYTES || quality === QUALITIES.at(-1)) {
      writeFileSync(out, buffer)
      return
    }
  }
}

const manifest = {}
let made = 0
for (const dir of SOURCE_DIRS) {
  const folder = join('public/images', dir)
  if (!existsSync(folder)) continue
  for (const file of readdirSync(folder).filter((f) => SOURCE.test(f)).sort()) {
    const src = join(folder, file)
    const name = `${dir}-${parse(file).name}.jpg`
    const out = join(OUT_DIR, name)
    const stale = !existsSync(out) || (!onCi && statSync(src).mtimeMs > statSync(out).mtimeMs)
    if (stale) {
      await encode(src, out)
      made++
    }
    const { width, height } = await sharp(out).metadata()
    manifest[`/images/${dir}/${file}`] = { url: `/images/share/${name}`, width, height }
  }
}

writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`[make-share-images] ${Object.keys(manifest).length} images, ${made} generated`)
