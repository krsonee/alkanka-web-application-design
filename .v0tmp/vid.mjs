import { experimental_generateVideo as generateVideo } from 'ai'
import sharp from 'sharp'
import { writeFileSync } from 'node:fs'
const img = await sharp('public/images/og.png').resize(1280,720,{fit:'cover'}).png().toBuffer()
const t=Date.now()
try {
  const { video, providerMetadata } = await generateVideo({
    model: process.argv[2],
    prompt: { image: new Uint8Array(img), text: 'Subtle cinematic motion: light sweeps, sparkles, gentle camera push-in. Keep all text and layout unchanged.' },
    duration: Number(process.argv[3]),
  })
  writeFileSync('/tmp/st/out.mp4', video.uint8Array)
  console.log('ok', video.mediaType, video.uint8Array.length, (Date.now()-t)/1000+'s', JSON.stringify(providerMetadata).slice(0,300))
} catch (e) { console.log('ERR', (Date.now()-t)/1000, e.message, JSON.stringify(e.responseBody ?? e.cause?.message ?? '').slice(0,500)) }
