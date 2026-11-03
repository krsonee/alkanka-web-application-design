// Generates `<file>.png.webp` / `<file>.jpg.webp` next to every raster image in the
// served folders. next.config.mjs rewrites browser requests for the original URL to
// this sibling when the browser accepts WebP, so the rewrite target must always exist.
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

export const WEBP_DIRS = ['public/images', 'public/postlar']
const SOURCE = /\.(png|jpe?g)$/i
const onCi = Boolean(process.env.VERCEL || process.env.CI)

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })

const sources = WEBP_DIRS.filter((d) => existsSync(d)).flatMap(walk).filter((f) => SOURCE.test(f))

const pending = sources.filter((src) => {
  const out = `${src}.webp`
  if (!existsSync(out)) return true
  return !onCi && statSync(src).mtimeMs > statSync(out).mtimeMs
})

let made = 0
let failed = 0
const queue = [...pending]
async function worker() {
  while (queue.length) {
    const src = queue.shift()
    try {
      await sharp(src).rotate().webp({ quality: 80, alphaQuality: 90, effort: 4 }).toFile(`${src}.webp`)
      made++
    } catch (error) {
      failed++
      console.error(`[make-webp] ${src}: ${error.message}`)
    }
  }
}
await Promise.all(Array.from({ length: 4 }, worker))

console.log(`[make-webp] ${sources.length} images, ${made} generated, ${failed} failed`)
if (failed) process.exit(1)
