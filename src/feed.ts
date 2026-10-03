// Feed de apps dentro do totem: rolagem contínua como no celular + ficha ao lado
import type { App } from './ui'

export type FeedApp = App & { what?: string; event?: string; partner?: string; agency?: string | null; agencyLogo?: string; landscape?: boolean }

const EASE = 'cubic-bezier(.22,1,.36,1)'
const LOGO: Record<string, string> = {
  'F2 Solutions': '/logos/f2-logo-navy.png',
  'TM1 Brand Experience': '/logos/tm1-mono.png',
  'Musik Pro': '/logos/musik-pro.png',
  'RG Produções': '/logos/rg.png',
  'AIdeas Lab': '/logos/aideas.png',
}
const mark = (name?: string | null, src?: string) => {
  if (!name) return ''
  const s = src || LOGO[name]
  return s ? `<img alt="${name}" src="${s}" style="height:22px;width:auto;object-fit:contain;display:block"/>` : `<span style="font-size:13px;font-weight:500">${name}</span>`
}

export function buildFeed(apps: FeedApp[], onEdge: (dir: number) => void) {
  const mob = innerWidth < 820
  const screen = document.createElement('div')
  Object.assign(screen.style, { position: 'fixed', zIndex: '22', overflow: 'hidden', background: '#07070a', borderRadius: '6px', opacity: '0', pointerEvents: 'none', transition: 'opacity .5s', touchAction: 'none', boxShadow: '0 0 60px rgba(80,120,255,.16)' })
  const track = document.createElement('div')
  Object.assign(track.style, { position: 'absolute', left: '0', right: '0', top: '0', willChange: 'transform' })
  screen.appendChild(track)

  const cards = apps.map((a) => {
    const c = document.createElement('div')
    Object.assign(c.style, { position: 'relative', overflow: 'hidden', background: '#07070a' })
    const first = a.screens[0]
    c.innerHTML = `
      ${first ? `<img alt="" src="${first}" style="position:absolute;inset:-8%;width:116%;height:116%;object-fit:cover;filter:blur(22px) brightness(.55);transform:scale(1.05)"/>` : ''}
      ${a.screens.map((s, k) => `<img alt="" data-k="${k}" src="${s}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:${a.landscape ? 'contain' : 'cover'};opacity:${k ? 0 : 1};transition:opacity .7s"/>`).join('')}
      ${a.screens.length ? '' : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--ui-mu);font-size:12px">telas em breve</div>`}
      <div style="position:absolute;left:0;right:0;bottom:0;padding:18% 7% 7%;background:linear-gradient(transparent,rgba(0,0,0,.78));color:#fff">
        <div style="font-size:clamp(8px,.8vw,11px);letter-spacing:.14em;opacity:.7;text-transform:uppercase">${a.kind || 'Ativação'}</div>
        <div style="font-size:clamp(12px,1.35vw,20px);font-weight:300;letter-spacing:-.02em;line-height:1.1;margin-top:3px">${a.title}</div>
        <div style="display:flex;gap:4px;margin-top:8px">${a.screens.map((_, k) => `<span data-d="${k}" style="flex:1;height:2px;background:#fff;opacity:${k ? 0.3 : 1};border-radius:2px"></span>`).join('')}</div>
      </div>`
    track.appendChild(c)
    return c
  })

  // ficha da ativação, ao lado do totem (embaixo no celular)
  const info = document.createElement('aside')
  Object.assign(info.style, mob
    ? { position: 'fixed', left: '12px', right: '12px', bottom: '12px', zIndex: '24', background: 'var(--ui-bg)', backdropFilter: 'blur(12px)', border: '1px solid var(--ui-ln)', borderRadius: '16px', padding: '14px 16px', opacity: '0', pointerEvents: 'none', transition: `opacity .5s` }
    : { position: 'fixed', zIndex: '24', width: '340px', background: 'var(--ui-bg)', backdropFilter: 'blur(12px)', border: '1px solid var(--ui-ln)', borderRadius: '18px', padding: '22px', boxShadow: '0 30px 80px -30px rgba(0,0,0,.3)', opacity: '0', pointerEvents: 'none', transition: `opacity .5s, transform .6s ${EASE}` })
  document.body.append(screen, info)

  let pos = 0
  let target = 0
  let cur = -1
  let visible = false
  let cardH = 1
  let idle = 0
  let slide = 0
  let slideT = 0
  let base = 0
  let gesture = false

  const renderInfo = (i: number) => {
    const a = apps[i]
    if (!a) return
    info.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;font-size:12px;color:var(--ui-mu)">
        <span style="font-variant-numeric:tabular-nums">${String(i + 1).padStart(2, '0')} / ${String(apps.length).padStart(2, '0')}</span>
        <span style="margin-left:auto;letter-spacing:.1em;text-transform:uppercase">${a.kind || ''}</span>
      </div>
      <div style="font-size:${mob ? 20 : 26}px;font-weight:200;letter-spacing:-.035em;line-height:1.08;margin-top:10px">${a.title}</div>
      <div style="font-size:13px;color:var(--ui-mu);margin-top:6px">${[a.client, a.event, a.year].filter(Boolean).join(' · ')}</div>
      <div style="font-size:14px;line-height:1.5;color:var(--ui-fg2);margin-top:12px;${mob ? 'display:none' : ''}">${a.what || a.summary || ''}</div>
      <div style="display:flex;gap:18px;margin-top:16px;align-items:flex-end;border-top:1px solid var(--ui-ln);padding-top:12px">
        <div><div style="font-size:10px;color:var(--ui-mu);letter-spacing:.14em;margin-bottom:6px">REALIZADO COM</div>${mark(a.partner || a.company)}</div>
        ${a.agency ? `<div><div style="font-size:10px;color:var(--ui-mu);letter-spacing:.14em;margin-bottom:6px">AGÊNCIA</div>${mark(a.agency, a.agencyLogo)}</div>` : ''}
      </div>
      <div style="font-size:11px;color:var(--ui-mu);margin-top:12px">Role para o próximo app</div>`
    info.animate([{ opacity: 0.3 }, { opacity: 1 }], { duration: 450 })
  }

  const api = {
    get index() {
      return Math.round(pos)
    },
    show(on: boolean) {
      visible = on
      for (const e of [screen, info]) {
        e.style.opacity = on ? '1' : '0'
        e.style.pointerEvents = on ? 'auto' : 'none'
      }
    },
    jump(i: number) {
      target = pos = Math.max(0, Math.min(apps.length - 1, i))
    },
    // rolagem: move a trilha continuamente; parar = encaixa no app mais próximo
    wheel(delta: number) {
      if (!gesture) ((gesture = true), (base = Math.round(pos)))
      target += delta / Math.max(cardH, 200) * 0.85
      target = Math.max(-0.35, Math.min(apps.length - 1 + 0.35, target))
      idle = performance.now()
    },
    update(dt: number, now: number) {
      if (now - idle > 170) {
        if (target > apps.length - 1 + 0.2) {
          target = apps.length - 1
          onEdge(1)
        } else if (target < -0.2) {
          target = 0
          onEdge(-1)
        } else if (gesture) {
          // gesto curto já basta: passou de 12% do app, vai para o vizinho
          const d = target - base
          target = Math.abs(d) > 0.12 ? base + Math.sign(d) * Math.max(1, Math.round(Math.abs(d))) : base
          if (target > apps.length - 1) (target = apps.length - 1), onEdge(1)
          else if (target < 0) (target = 0), onEdge(-1)
        }
        gesture = false
      }
      pos += (target - pos) * (1 - Math.exp(-9 * dt))
      track.style.transform = `translate3d(0, ${-pos * cardH}px, 0)`
      const i = Math.max(0, Math.min(apps.length - 1, Math.round(pos)))
      if (i !== cur) {
        cur = i
        slide = 0
        slideT = now
        renderInfo(i)
      }
      // telas do app atual trocam sozinhas
      const a = apps[cur]
      if (a && a.screens.length > 1 && now - slideT > 2400) {
        slideT = now
        slide = (slide + 1) % a.screens.length
        cards[cur].querySelectorAll('img[data-k]').forEach((im) => ((im as HTMLElement).style.opacity = (im as HTMLElement).dataset.k === String(slide) ? '1' : '0'))
        cards[cur].querySelectorAll('span[data-d]').forEach((d) => ((d as HTMLElement).style.opacity = Number((d as HTMLElement).dataset.d) <= slide ? '1' : '0.3'))
      }
    },
    place(r: { x: number; y: number; w: number; h: number }) {
      if (!visible) return
      Object.assign(screen.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` })
      if (Math.abs(cardH - r.h) > 0.5) {
        cardH = r.h
        cards.forEach((c) => (c.style.height = `${r.h}px`))
      }
      if (!mob) Object.assign(info.style, { left: `${r.x + r.w + 40}px`, top: `${r.y + r.h / 2 - 170}px` })
    },
  }

  // arrastar dentro da tela = dedo no celular
  let dragY: number | null = null
  screen.addEventListener('pointerdown', (e) => {
    dragY = e.clientY
    screen.setPointerCapture(e.pointerId)
  })
  screen.addEventListener('pointermove', (e) => {
    if (dragY === null) return
    api.wheel(-(e.clientY - dragY) / 0.85)
    dragY = e.clientY
  })
  screen.addEventListener('pointerup', () => (dragY = null))
  return api
}
