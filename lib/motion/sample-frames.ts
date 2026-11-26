/**
 * Picks frames out of an animated file in the browser. A request to the panel carries at most a few
 * megabytes, and a finished banner GIF is often heavier, so the file never leaves the screen: only
 * sixteen small frames of it and its length do.
 */

const SHOTS = 16
const LONGEST = 640

type Frame = { duration: number | null; displayWidth: number; displayHeight: number; close(): void }
type Decoder = {
  tracks: { ready: Promise<void>; selectedTrack: { frameCount: number } | null }
  decode(options: { frameIndex: number }): Promise<{ image: Frame }>
  close(): void
}
type DecoderClass = new (init: { data: ArrayBuffer; type: string }) => Decoder

export type Sampled = { shots: Blob[]; seconds: number }

/** `null` when this browser cannot open the file frame by frame. */
export async function sampleFrames(file: File): Promise<Sampled | null> {
  const Make = (globalThis as { ImageDecoder?: DecoderClass }).ImageDecoder
  if (!Make) return null
  let decoder: Decoder | null = null
  try {
    decoder = new Make({ data: await file.arrayBuffer(), type: file.type })
    await decoder.tracks.ready
    const count = decoder.tracks.selectedTrack?.frameCount ?? 0
    if (count < 1) return null
    const wanted = new Set<number>()
    const picks = Math.min(SHOTS, count)
    for (let i = 0; i < picks; i++) wanted.add(picks === 1 ? 0 : Math.round((i * (count - 1)) / (picks - 1)))

    const canvas = document.createElement('canvas')
    const pen = canvas.getContext('2d')
    if (!pen) return null
    const shots: Blob[] = []
    let micros = 0
    // Every frame is opened in order: a GIF frame is drawn over the one before it, and its time is only known once decoded.
    for (let i = 0; i < count; i++) {
      const { image } = await decoder.decode({ frameIndex: i })
      micros += image.duration ?? 0
      if (wanted.has(i)) {
        const scale = Math.min(1, LONGEST / Math.max(image.displayWidth, image.displayHeight))
        canvas.width = Math.max(8, Math.round(image.displayWidth * scale))
        canvas.height = Math.max(8, Math.round(image.displayHeight * scale))
        pen.fillStyle = '#000'
        pen.fillRect(0, 0, canvas.width, canvas.height)
        pen.drawImage(image as unknown as CanvasImageSource, 0, 0, canvas.width, canvas.height)
        const shot = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/jpeg', 0.86))
        if (shot) shots.push(shot)
      }
      image.close()
    }
    return shots.length ? { shots, seconds: count > 1 ? micros / 1_000_000 : 0 } : null
  } catch {
    return null
  } finally {
    decoder?.close()
  }
}
