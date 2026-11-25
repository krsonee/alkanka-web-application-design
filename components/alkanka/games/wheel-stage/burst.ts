const COIN =
  '<svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true"><circle cx="12" cy="12" r="12" style="fill:var(--gold)"/><circle cx="12" cy="12" r="8.2" style="fill:none;stroke:var(--gold-foreground);stroke-width:1.6;opacity:0.55"/></svg>'

const CHIPS = ['var(--gold)', 'var(--foreground)', 'color-mix(in oklch, var(--gold) 55%, var(--gold-foreground))']

/**
 * Win burst: gold coins and small chips thrown out from a point (the wheel's hub) in a ring, falling a little as
 * they fade. One fixed layer that removes itself, no re-render; nothing under reduced motion.
 */
export function burst(x: number, y: number, count = 30) {
  if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const layer = document.createElement('div')
  layer.setAttribute('aria-hidden', 'true')
  layer.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:0;height:0;z-index:60;pointer-events:none`
  document.body.appendChild(layer)
  let alive = count
  for (let i = 0; i < count; i++) {
    const coin = i % 3 === 0
    const el = document.createElement('span')
    const size = coin ? 18 + Math.random() * 10 : 7 + Math.random() * 6
    el.style.cssText = `position:absolute;left:${-size / 2}px;top:${-size / 2}px;width:${size}px;height:${size}px;`
    if (coin) el.innerHTML = COIN
    else {
      el.style.background = CHIPS[i % CHIPS.length]
      el.style.borderRadius = '2px'
    }
    layer.appendChild(el)
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5
    const distance = 120 + Math.random() * 170
    const dx = Math.cos(angle) * distance
    const dy = Math.sin(angle) * distance
    const spin = (Math.random() - 0.5) * 540
    el.animate(
      [
        { transform: 'translate(0, 0) rotate(0deg) scale(0.4)', opacity: 1 },
        { transform: `translate(${dx * 0.8}px, ${dy * 0.8}px) rotate(${spin * 0.7}deg) scale(1)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${dx}px, ${dy + 70}px) rotate(${spin}deg) scale(0.9)`, opacity: 0 },
      ],
      { duration: 900 + Math.random() * 500, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'forwards' },
    ).onfinish = () => {
      alive -= 1
      if (alive === 0) layer.remove()
    }
  }
}
