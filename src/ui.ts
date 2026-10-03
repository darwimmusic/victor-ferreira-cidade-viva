// Camada HTML: menu, textos de sessão, painel de obras, tela do totem/monitor, galeria
export type Obra = { id: string; title: string; client: string; company: string; year: number; role: string; summary: string; plan: string; front: string; images: string[]; numbers: { value: string; unit: string; label: string }[] }
export type App = { id: string; title: string; client: string; company: string; year: number; kind: string; color: string; summary: string; screens: string[] }
export type Sistema = { id: string; title: string; company: string; year: number; summary: string; screens: string[] }

const css = (o: Record<string, string | number | undefined>) => Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}:${v}`).join(';')
const el = (html: string) => {
  const t = document.createElement('template')
  t.innerHTML = html.trim()
  return t.content.firstElementChild as HTMLElement
}
const EASE = 'cubic-bezier(.22,1,.36,1)'
const btn = (extra = '') => `cursor:pointer;border:1px solid var(--ui-fg);background:var(--ui-btn);color:var(--ui-fg);font:inherit;transition:background .6s,color .6s;${extra.replace(/background:#111;color:#fff/g, 'background:var(--ui-fg);color:var(--ui-bg-solid)')}`
const logo: Record<string, string> = {
  'F2 Solutions': '/logos/f2-logo-navy.png',
  'TM1 Brand Experience': '/logos/tm1-mono.png',
  'Musik Pro': '/logos/musik-pro.png',
  'RG Produções': '/logos/rg.png',
  'AIdeas Lab': '/logos/aideas.png',
}
const companyMark = (c: string, h = 20) =>
  logo[c] ? `<img src="${logo[c]}" alt="${c}" style="height:${h}px;width:auto;object-fit:contain;display:block" onerror="this.outerHTML='<span>${c}</span>'"/>` : `<span style="font-size:12px;letter-spacing:.12em;text-transform:uppercase">${c === 'Autoral' ? '◇ Autoral' : c}</span>`

export type Section = { id: string; label: string; kicker: string; title: string; body: string }
export const isMobile = () => innerWidth < 820

export function buildUI(sections: Section[], handlers: { go: (i: number) => void; openGallery: () => void }) {
  const mob = isMobile()
  // ── menu fixo ──
  const menu = el(`<header style="${css({ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 30, display: 'flex', alignItems: 'center', gap: mob ? '12px' : '28px', padding: mob ? '12px 14px' : '18px 32px', background: 'var(--ui-bg)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(0,0,0,.06)', fontSize: '13px' })}">
    <span style="font-weight:500;letter-spacing:-.01em;white-space:nowrap">Victor Ferreira</span>
    <nav style="display:flex;gap:${mob ? 14 : 22}px;overflow-x:auto;scrollbar-width:none;flex:1;justify-content:${mob ? 'flex-start' : 'center'};font-weight:300">
      ${sections.map((s, i) => `<a data-i="${i}" style="cursor:pointer;opacity:.55;text-underline-offset:6px;transition:opacity .3s;white-space:nowrap">${s.label}</a>`).join('')}
    </nav>
    <button id="btnGal" style="${btn('border-radius:99px;padding:8px 16px;white-space:nowrap')}">Projetos</button>
  </header>`)
  document.body.appendChild(menu)
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => handlers.go(+a.dataset.i!)))
  menu.querySelector('#btnGal')!.addEventListener('click', handlers.openGallery)

  // ── cartão da história: grande, no centro da atenção ──
  const cardStyle = mob
    ? { position: 'fixed', left: '12px', right: '12px', bottom: '12px', zIndex: 24, background: 'var(--ui-bg)', backdropFilter: 'blur(14px)', border: '1px solid var(--ui-ln)', borderRadius: '18px', padding: '18px 18px 16px', boxShadow: '0 20px 60px -20px rgba(0,0,0,.25)', transition: `opacity .6s, transform .8s ${EASE}` }
    : { position: 'fixed', left: '48px', top: '50%', width: '460px', zIndex: 24, background: 'var(--ui-bg)', backdropFilter: 'blur(14px)', border: '1px solid var(--ui-ln)', borderRadius: '20px', padding: '30px 30px 26px', boxShadow: '0 40px 90px -40px rgba(0,0,0,.35)', transition: `opacity .6s, transform .8s ${EASE}`, transform: 'translateY(-50%)', transformOrigin: 'left center' }
  const card = el(`<section style="${css(cardStyle)}">
    <div style="display:flex;align-items:center;gap:10px;font-size:12px;color:var(--ui-mu);letter-spacing:.12em;text-transform:uppercase"><span id="cK"></span><span id="cN" style="margin-left:auto;font-variant-numeric:tabular-nums;letter-spacing:.04em"></span></div>
    <h2 id="cT" style="margin:${mob ? 10 : 16}px 0 0;font-size:${mob ? 30 : 46}px;font-weight:200;letter-spacing:-.045em;line-height:1"></h2>
    <p id="cB" style="margin:${mob ? 10 : 16}px 0 0;font-size:${mob ? 15 : 17}px;font-weight:300;line-height:1.5;color:var(--ui-fg2)"></p>
    <div style="height:2px;background:#eee;margin-top:${mob ? 14 : 22}px;border-radius:2px;overflow:hidden"><div id="cP" style="height:100%;width:0;background:#111"></div></div>
    <div style="display:flex;gap:8px;margin-top:14px">
      <button id="cPrev" style="${btn('border-radius:99px;padding:10px 16px;font-size:13px')}">↑</button>
      <button id="cNext" style="${btn('flex:1;border-radius:99px;padding:10px 16px;font-size:13px;background:#111;color:#fff')}">Continuar ↓</button>
    </div>
  </section>`)
  document.body.appendChild(card)
  let cur = 0
  card.querySelector('#cNext')!.addEventListener('click', () => handlers.go(cur === sections.length - 1 ? 0 : cur + 1))
  card.querySelector('#cPrev')!.addEventListener('click', () => handlers.go(cur - 1))

  const dots = el(`<div style="${css({ position: 'fixed', right: '28px', top: '50%', transform: 'translateY(-50%)', zIndex: 20, display: mob ? 'none' : 'flex', flexDirection: 'column', gap: '12px' })}">
    ${sections.map((s, i) => `<button data-i="${i}" title="${s.label}" style="cursor:pointer;width:9px;height:9px;border-radius:50%;border:1px solid #111;background:transparent;padding:0"></button>`).join('')}
  </div>`)
  document.body.appendChild(dots)
  dots.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => handlers.go(+(b as HTMLElement).dataset.i!)))

  const $ = (id: string) => card.querySelector(id) as HTMLElement
  return {
    setSection(i: number) {
      cur = i
      const s = sections[i]
      menu.querySelectorAll('a').forEach((a, k) => Object.assign((a as HTMLElement).style, { opacity: k === i ? '1' : '.55', textDecoration: k === i ? 'underline' : 'none' }))
      dots.querySelectorAll('button').forEach((b, k) => ((b as HTMLElement).style.background = k === i ? '#111' : 'transparent'))
      $('#cK').textContent = s.kicker
      $('#cN').textContent = `${String(i + 1).padStart(2, '0')} / ${String(sections.length).padStart(2, '0')}`
      $('#cT').textContent = s.title
      $('#cB').textContent = s.body
      $('#cPrev').style.display = i === 0 ? 'none' : 'block'
      $('#cNext').textContent = i === sections.length - 1 ? 'Voltar ao início ↑' : 'Continuar ↓'
      card.animate([{ opacity: 0, filter: 'blur(6px)' }, { opacity: 1, filter: 'blur(0)' }], { duration: 900, easing: EASE })
    },
    progress(k: number) {
      $('#cP').style.width = `${Math.round(k * 100)}%`
    },
    showCard(on: boolean, compact = false) {
      card.style.opacity = on ? '1' : '0'
      card.style.pointerEvents = on ? 'auto' : 'none'
      if (!mob) Object.assign(card.style, compact ? { top: '88px', transform: 'scale(.8)', transformOrigin: 'top left' } : { top: '50%', transform: 'translateY(-50%)', transformOrigin: 'left center' })
    },
  }
}

// ── visualizador de pranchas (obras) ─────────────────────────────────
export function buildObrasPanel(obras: Obra[], h: { prev: () => void; next: () => void; view: (v: 'iso' | 'frontal' | 'planta') => void }) {
  const mob = isMobile()
  const panelStyle = mob
    ? { position: 'fixed', left: 0, right: 0, bottom: 0, height: '64vh', zIndex: 25, background: 'var(--ui-bg)', borderRadius: '18px 18px 0 0', boxShadow: '0 -20px 60px -20px rgba(0,0,0,.25)', display: 'flex', flexDirection: 'column', opacity: 0, pointerEvents: 'none', transition: `opacity .5s, transform .8s ${EASE}`, transform: 'translateY(30px)' }
    : { position: 'fixed', top: '80px', right: '24px', bottom: '24px', width: 'min(820px, 58vw)', zIndex: 25, background: 'var(--ui-bg)', backdropFilter: 'blur(10px)', border: '1px solid var(--ui-ln)', borderRadius: '18px', boxShadow: '0 40px 100px -40px rgba(0,0,0,.35)', display: 'flex', flexDirection: 'column', overflow: 'hidden', opacity: 0, pointerEvents: 'none', transition: `opacity .5s, transform .8s ${EASE}`, transform: 'translateX(30px)' }
  const pad = mob ? 12 : 22
  const p = el(`<aside style="${css(panelStyle)}">
    <div style="display:flex;align-items:center;gap:12px;padding:${mob ? '14px 16px 10px' : '18px 22px 12px'}">
      <span id="oN" style="font-size:12px;color:var(--ui-mu);font-variant-numeric:tabular-nums"></span>
      <span id="oCo"></span>
      <div style="margin-left:auto;display:flex;gap:6px">
        <button id="oP" style="${btn('width:42px;height:42px;border-radius:50%;font-size:17px')}">←</button>
        <button id="oX" style="${btn('width:42px;height:42px;border-radius:50%;font-size:17px;background:#111;color:#fff')}">→</button>
      </div>
    </div>
    <div id="oImgWrap" style="position:relative;flex:1;min-height:0;margin:0 ${pad}px;background:var(--ui-img);border-radius:12px;overflow:hidden;cursor:zoom-in">
      <img id="oImg" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;transition:opacity .35s"/>
      <span id="oTag" style="position:absolute;left:12px;top:12px;font-size:11px;letter-spacing:.12em;background:#111;color:#fff;padding:5px 9px;border-radius:99px"></span>
      <span style="position:absolute;right:12px;bottom:12px;font-size:11px;color:var(--ui-mu);background:var(--ui-bg);padding:5px 9px;border-radius:99px">clique para ampliar</span>
    </div>
    <div id="oThumbs" style="display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;padding:12px ${pad}px 0"></div>
    <div style="display:grid;grid-template-columns:${mob ? '1fr' : '1.2fr 1fr'};gap:${mob ? 10 : 22}px;padding:${mob ? '12px 16px 16px' : '16px 22px 22px'}">
      <div>
        <div id="oT" style="font-size:${mob ? 22 : 28}px;font-weight:200;letter-spacing:-.035em;line-height:1.05"></div>
        <div id="oC" style="font-size:13px;color:var(--ui-mu);margin-top:6px"></div>
        <div id="oS" style="font-size:14px;line-height:1.5;margin-top:10px;color:var(--ui-fg2);display:${mob ? 'none' : 'block'}"></div>
      </div>
      <div id="oNum" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;align-content:start"></div>
    </div>
  </aside>`)
  const lb = el(`<div style="${css({ position: 'fixed', inset: 0, zIndex: 45, background: 'rgba(255,255,255,.98)', display: 'none', cursor: 'zoom-out' })}"><img alt="" style="position:absolute;left:3vw;top:3vh;width:94vw;height:94vh;object-fit:contain"/><span style="position:absolute;top:18px;right:22px;font-size:13px">Fechar ✕</span></div>`)
  document.body.append(p, lb)
  lb.addEventListener('click', () => (lb.style.display = 'none'))
  p.querySelector('#oP')!.addEventListener('click', h.prev)
  p.querySelector('#oX')!.addEventListener('click', h.next)
  const $ = (id: string) => p.querySelector(id) as HTMLElement
  const img = $('#oImg') as HTMLImageElement
  $('#oImgWrap').addEventListener('click', () => {
    ;(lb.querySelector('img') as HTMLImageElement).src = img.src
    lb.style.display = 'block'
  })
  let items: { src: string; tag: string; view: 'iso' | 'frontal' | 'planta' }[] = []
  const pick = (k: number, moveCam = true) => {
    const it = items[k]
    if (!it) return
    img.style.opacity = '0'
    setTimeout(() => ((img.src = it.src), (img.style.opacity = '1')), 180)
    $('#oTag').textContent = it.tag
    p.querySelectorAll('#oThumbs button').forEach((b, j) => ((b as HTMLElement).style.outline = j === k ? '2px solid #111' : 'none'))
    if (moveCam) h.view(it.view)
  }
  return {
    get lightbox() {
      return lb.style.display === 'block'
    },
    closeLightbox() {
      lb.style.display = 'none'
    },
    show(on: boolean) {
      p.style.opacity = on ? '1' : '0'
      p.style.pointerEvents = on ? 'auto' : 'none'
      p.style.transform = on ? 'none' : mob ? 'translateY(30px)' : 'translateX(30px)'
    },
    set(i: number) {
      const o = obras[i]
      if (!o) return
      items = [
        ...(o.plan ? [{ src: o.plan, tag: 'PLANTA', view: 'planta' as const }] : []),
        ...(o.front ? [{ src: o.front, tag: 'VISTA', view: 'frontal' as const }] : []),
        ...(o.images || []).filter((s) => s !== o.plan && s !== o.front).map((s, k) => ({ src: s, tag: `IMAGEM ${k + 1}`, view: 'iso' as const })),
      ]
      $('#oN').textContent = `${String(i + 1).padStart(2, '0')} / ${String(obras.length).padStart(2, '0')}`
      $('#oCo').innerHTML = companyMark(o.company, 18)
      $('#oT').textContent = o.title
      $('#oC').textContent = `${o.client} · ${o.year}`
      $('#oS').textContent = o.summary || o.role
      $('#oNum').innerHTML = (o.numbers || [])
        .slice(0, 4)
        .map((n) => `<div style="border-top:1px solid var(--ui-fg);padding-top:6px"><div style="font-size:${mob ? 18 : 24}px;font-weight:200;letter-spacing:-.03em">${n.value}<span style="font-size:12px;margin-left:3px;color:var(--ui-mu)">${n.unit}</span></div><div style="font-size:11px;color:var(--ui-mu);line-height:1.3">${n.label}</div></div>`)
        .join('')
      $('#oThumbs').innerHTML = items
        .map((it) => `<button style="${css({ cursor: 'pointer', flex: 'none', width: mob ? '72px' : '96px', height: mob ? '52px' : '66px', border: '1px solid var(--ui-ln)', borderRadius: '8px', padding: 0, overflow: 'hidden', background: 'var(--ui-img)', position: 'relative' })}"><img alt="" src="${it.src}" style="width:100%;height:100%;object-fit:cover"/><span style="position:absolute;left:4px;bottom:3px;font-size:9px;background:#fff;padding:1px 4px;border-radius:4px">${it.tag}</span></button>`)
        .join('')
      p.querySelectorAll('#oThumbs button').forEach((b, k) => b.addEventListener('click', () => pick(k)))
      pick(0, false)
      h.view('iso')
    },
  }
}

// ── tela de aparelho (totem em retrato / monitor em paisagem) ───────
type Item = { title: string; client?: string; company: string; year: number; kind?: string; color?: string; summary: string; screens: string[] }
export function buildDevice(kind: 'totem' | 'monitor', items: Item[], h: { prev: () => void; next: () => void; open: (i: number) => void; home: () => void }) {
  const screen = el(`<div style="${css({ position: 'fixed', zIndex: 22, overflow: 'hidden', background: kind === 'totem' ? '#0c0c10' : '#0e0e10', opacity: 0, pointerEvents: 'none', transition: 'opacity .5s', borderRadius: kind === 'totem' ? '6px' : '2px', boxShadow: '0 0 60px rgba(80,120,255,.18)' })}"></div>`)
  const cap = el(`<div style="${css({ position: 'fixed', zIndex: 22, opacity: 0, pointerEvents: 'none', transition: 'opacity .5s', textAlign: 'center', width: '420px' })}"></div>`)
  const L = el(`<button style="${btn('position:fixed;z-index:23;width:54px;height:54px;border-radius:50%;font-size:20px;opacity:0;pointer-events:none;transition:opacity .5s')}">←</button>`)
  const R = el(`<button style="${btn('position:fixed;z-index:23;width:54px;height:54px;border-radius:50%;font-size:20px;background:#111;color:#fff;opacity:0;pointer-events:none;transition:opacity .5s')}">→</button>`)
  document.body.append(screen, cap, L, R)
  L.addEventListener('click', h.prev)
  R.addEventListener('click', h.next)

  let timer = 0
  let slide = 0
  const launcher = () => {
    clearInterval(timer)
    const cols = 4
    screen.innerHTML = `<div style="${css({ position: 'absolute', inset: 0, overflowY: 'auto', scrollbarWidth: 'none', padding: '7% 6%', background: 'radial-gradient(120% 80% at 50% 0%, #22264a 0%, #0c0c10 60%)', color: '#fff' })}">
      <div style="font-size:clamp(10px,1.1vw,15px);opacity:.6;letter-spacing:.14em">${kind === 'totem' ? 'APPS · ATIVAÇÕES' : 'SISTEMAS · SOFTWARES'}</div>
      <div style="font-size:clamp(16px,2vw,30px);font-weight:200;letter-spacing:-.03em;margin:4px 0 7%">${kind === 'totem' ? 'Escolha um app' : 'Escolha um sistema'}</div>
      <div style="display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:clamp(6px,1vw,14px)">
        ${items
          .map(
            (a, i) => `<button data-i="${i}" style="${css({ cursor: 'pointer', border: 0, background: 'transparent', color: '#fff', padding: 0, textAlign: 'center' })}">
          <div style="${css({ aspectRatio: '1', borderRadius: '22%', background: `linear-gradient(145deg, ${a.color || '#4b5cff'}, #111)`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,.4)' })}">${a.screens[0] ? `<img src="${a.screens[0]}" style="display:block;width:100%;height:100%;object-fit:cover;opacity:.9"/>` : `<span style="font-size:22px">${a.title[0]}</span>`}</div>
          <div style="font-size:clamp(8px,.8vw,12px);margin-top:6px;opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.title}</div></button>`,
          )
          .join('')}
      </div></div>`
    screen.querySelectorAll('button[data-i]').forEach((b) => b.addEventListener('click', () => h.open(+(b as HTMLElement).dataset.i!)))
    cap.innerHTML = `<div style="font-size:12px;color:var(--ui-mu)">${items.length} ${kind === 'totem' ? 'apps' : 'sistemas'} · toque para abrir</div>`
  }
  const app = (i: number) => {
    clearInterval(timer)
    const a = items[i]
    if (!a) return launcher()
    slide = 0
    const imgs = a.screens.length ? a.screens : []
    screen.innerHTML = `<div style="position:absolute;inset:0;background:#000">
      ${imgs.map((s, k) => `<img src="${s}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:${kind === 'totem' ? 'cover' : 'contain'};opacity:${k === 0 ? 1 : 0};transition:opacity .8s" data-k="${k}"/>`).join('')}
      ${imgs.length ? '' : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--ui-mu);font-size:13px">telas em breve</div>`}
      <div style="position:absolute;bottom:10px;left:0;right:0;display:flex;justify-content:center;gap:5px">${imgs.map((_, k) => `<span data-d="${k}" style="width:6px;height:6px;border-radius:50%;background:#fff;opacity:${k === 0 ? 1 : 0.35}"></span>`).join('')}</div>
    </div>`
    if (imgs.length > 1)
      timer = window.setInterval(() => {
        slide = (slide + 1) % imgs.length
        screen.querySelectorAll('img[data-k]').forEach((im) => ((im as HTMLElement).style.opacity = (im as HTMLElement).dataset.k === String(slide) ? '1' : '0'))
        screen.querySelectorAll('span[data-d]').forEach((d) => ((d as HTMLElement).style.opacity = (d as HTMLElement).dataset.d === String(slide) ? '1' : '0.35'))
      }, 2600)
    cap.innerHTML = `<div style="font-size:12px;color:var(--ui-mu);font-variant-numeric:tabular-nums;margin-bottom:8px">${String(i + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')} · role para o próximo</div><div style="display:flex;justify-content:center;margin-bottom:8px">${companyMark(a.company, 18)}</div>
      <div style="font-size:24px;font-weight:200;letter-spacing:-.03em">${a.title}</div>
      <div style="font-size:13px;color:var(--ui-mu);margin-top:4px">${[a.client, a.kind, a.year].filter(Boolean).join(' · ')}</div>
      <div style="font-size:13px;color:var(--ui-fg2);margin-top:8px;line-height:1.45">${a.summary}</div>`
  }
  launcher()
  let visible = false
  return {
    launcher,
    app,
    show(on: boolean) {
      visible = on
      for (const e of [screen, cap, L, R]) {
        e.style.opacity = on ? '1' : '0'
        e.style.pointerEvents = on ? 'auto' : 'none'
      }
      if (!on) clearInterval(timer)
    },
    // posiciona a tela sobre o retângulo projetado do aparelho 3D
    place(r: { x: number; y: number; w: number; h: number }) {
      if (!visible) return
      Object.assign(screen.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` })
      const cy = r.y + r.h / 2 - 27
      Object.assign(L.style, { left: `${r.x - 90}px`, top: `${cy}px` })
      Object.assign(R.style, { left: `${r.x + r.w + 36}px`, top: `${cy}px` })
      Object.assign(cap.style, { left: `${r.x + r.w / 2 - 210}px`, top: `${r.y + r.h + 22}px` })
    },
  }
}

// ── galeria ──────────────────────────────────────────────────────────
export function buildGallery(data: { obras: Obra[]; apps: App[]; sistemas: Sistema[] }, pick: (kind: 'obras' | 'apps' | 'sistemas', i: number) => void) {
  const g = el(`<div style="${css({ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(250,250,248,.97)', backdropFilter: 'blur(8px)', overflowY: 'auto', opacity: 0, pointerEvents: 'none', transition: 'opacity .45s' })}">
    <div style="max-width:1280px;margin:0 auto;padding:40px 32px 80px">
      <div style="display:flex;align-items:center;gap:16px">
        <div style="font-size:48px;font-weight:200;letter-spacing:-.045em">Projetos</div>
        <div id="gTabs" style="display:flex;gap:6px;margin-left:24px"></div>
        <button id="gClose" style="${btn('margin-left:auto;border-radius:99px;padding:10px 18px')}">Fechar ✕</button>
      </div>
      <div id="gGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;margin-top:28px"></div>
    </div></div>`)
  document.body.appendChild(g)
  const tabs: { k: 'obras' | 'apps' | 'sistemas'; t: string }[] = [
    { k: 'obras', t: `Obras (${data.obras.length})` },
    { k: 'apps', t: `Apps (${data.apps.length})` },
    { k: 'sistemas', t: `Sistemas (${data.sistemas.length})` },
  ]
  let cur: 'obras' | 'apps' | 'sistemas' = 'obras'
  const render = () => {
    g.querySelector('#gTabs')!.innerHTML = tabs.map((t) => `<button data-k="${t.k}" style="${btn(`border-radius:99px;padding:8px 14px;font-size:13px;${t.k === cur ? 'background:#111;color:#fff' : ''}`)}">${t.t}</button>`).join('')
    g.querySelectorAll('#gTabs button').forEach((b) => b.addEventListener('click', () => ((cur = (b as HTMLElement).dataset.k as 'obras'), render())))
    const list = data[cur] as (Obra | App | Sistema)[]
    g.querySelector('#gGrid')!.innerHTML = list
      .map((o, i) => {
        const img = 'plan' in o ? o.front || o.plan : o.screens?.[0]
        return `<button data-i="${i}" style="${css({ cursor: 'pointer', textAlign: 'left', border: '1px solid var(--ui-ln)', background: '#fff', padding: 0, font: 'inherit', color: '#111' })}">
        <div style="aspect-ratio:${cur === 'apps' ? '3/4' : '4/3'};background:#f1f1ef;overflow:hidden">${img ? `<img src="${img}" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block"/>` : ''}</div>
        <div style="padding:12px 14px 14px"><div style="font-size:16px;line-height:1.25">${o.title}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;font-size:12px;color:var(--ui-mu)"><span>${'client' in o && o.client ? o.client + ' · ' : ''}${o.year}</span>${companyMark(o.company, 14)}</div></div></button>`
      })
      .join('')
    g.querySelectorAll('#gGrid button').forEach((b) => b.addEventListener('click', () => pick(cur, +(b as HTMLElement).dataset.i!)))
  }
  g.querySelector('#gClose')!.addEventListener('click', () => api.show(false))
  const api = {
    show(on: boolean) {
      g.style.opacity = on ? '1' : '0'
      g.style.pointerEvents = on ? 'auto' : 'none'
      if (on) render()
    },
    get open() {
      return g.style.opacity === '1'
    },
  }
  return api
}

// ── telão de LED: slides de tecnologia/IA encaixados no retângulo do LED ──
export type Tech = { id: string; kicker: string; title: string; desc: string; image?: string; pixel?: boolean }
export function buildLed(items: Tech[]) {
  const scr = el(`<div style="${css({ position: 'fixed', zIndex: 22, overflow: 'hidden', background: '#05060a', opacity: 0, pointerEvents: 'none', transition: 'opacity .6s' })}"></div>`)
  document.body.appendChild(scr)
  let visible = false
  let last = -2
  return {
    show(on: boolean) {
      visible = on
      scr.style.opacity = on ? '1' : '0'
    },
    set(i: number) {
      if (i === last) return
      last = i
      const t = items[i]
      if (!t) return
      const n = `${String(i + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}`
      scr.style.background = t.pixel ? 'transparent' : '#05060a'
      scr.innerHTML = t.pixel
        ? `<div style="position:absolute;left:4%;bottom:6%;color:#111;background:#fff;padding:1.2% 1.6%;border-radius:6px">
             <div style="font-size:1.1vw;letter-spacing:.14em;opacity:.6">${t.kicker} · ${n}</div>
             <div style="font-size:2.6vw;font-weight:200;letter-spacing:-.04em;line-height:1">${t.title}</div>
             <div style="font-size:1vw;max-width:30vw;margin-top:.4vw;line-height:1.35">${t.desc}</div></div>`
        : `<div style="position:absolute;inset:0;display:grid;grid-template-columns:${t.image ? '0.9fr 1.3fr' : '1fr'};gap:4%;padding:5% 5%;color:#fff;background:radial-gradient(120% 90% at 0% 0%, #1b1f3a 0%, #05060a 60%)">
             <div style="display:flex;flex-direction:column;justify-content:center">
               <div style="font-size:1vw;letter-spacing:.18em;opacity:.55">${t.kicker} · ${n}</div>
               <div style="font-size:${t.image ? 3.4 : 5.2}vw;font-weight:200;letter-spacing:-.05em;line-height:.95;margin-top:.8vw">${t.title}</div>
               <div style="font-size:1.15vw;line-height:1.4;opacity:.8;margin-top:1vw;max-width:34vw">${t.desc}</div>
             </div>
             ${t.image ? `<div style="position:relative;border-radius:.6vw;overflow:hidden;box-shadow:0 0 60px rgba(120,140,255,.25)"><img alt="" src="${t.image}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:top"/></div>` : ''}
           </div>`
      scr.animate([{ opacity: 0, filter: 'brightness(2.2) blur(6px)' }, { opacity: 1, filter: 'none' }], { duration: 700, easing: EASE })
    },
    place(r: { x: number; y: number; w: number; h: number }) {
      if (!visible) return
      Object.assign(scr.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` })
    },
  }
}
