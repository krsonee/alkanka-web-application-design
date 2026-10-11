import sharp from 'sharp'
const src = await sharp('public/images/og.png').resize(512,512,{fit:'cover'}).png().toBuffer()
const W=512,H=512,N=16
const frames=[]
for(let i=0;i<N;i++){
  const t=i/N
  const s=1.02+0.02*Math.sin(t*2*Math.PI)
  const w=Math.round(W*s),h=Math.round(H*s)
  let f=await sharp(src).resize(w,h).extract({left:Math.round((w-W)/2),top:Math.round((h-H)/2),width:W,height:H}).png().toBuffer()
  const x=Math.round(-W*0.6+t*W*2.2)
  const shine=Buffer.from(`<svg width="${W}" height="${H}"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><rect x="${x}" y="-100" width="${W*0.35}" height="${H+200}" fill="url(#g)" transform="rotate(20 ${W/2} ${H/2})"/></svg>`)
  f=await sharp(f).composite([{input:shine}]).png().toBuffer()
  frames.push(f)
}
const gif=await sharp(frames,{join:{animated:true}}).gif({delay:Array(N).fill(70),loop:0,effort:7}).toBuffer()
await sharp(gif,{animated:true}).toFile('/tmp/st/out.gif')
const meta=await sharp(gif,{animated:true}).metadata()
console.log(gif.length, meta.pages, meta.format)
