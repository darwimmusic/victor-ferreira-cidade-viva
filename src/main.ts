import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import '@fontsource-variable/geist'
import { U, appearOf, buildInstanced, clayDepth, clayMaterial } from './clay'
import { OUT, PLAZA, buildLayout, streetPoint } from './layout'
import { makeLed, makeScreens } from './screens'
import { makeShowLights } from './lights'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { buildGallery, buildLed, buildObrasPanel, buildUI, isMobile, type App, type Obra, type Sistema, type Tech } from './ui'
import content from './content.json'
import { buildFeed, type FeedApp } from './feed'
import shotsJson from './shots.json'
import techJson from './tech.json'
import { startEditor, type ShotDef, type ShotStore } from './editor'

const DATA = content as { obras: Obra[]; apps: App[]; sistemas: Sistema[] }

// Telão de LED: tecnologia e IA (conteúdo em src/tech.json)
const TECH = techJson as Tech[]

const sm = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const damp = (c: number, t: number, l: number, dt: number) => c + (t - c) * (1 - Math.exp(-l * dt))
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const rad = THREE.MathUtils.degToRad

// ── renderer ──────────────────────────────────────────────────────────
const canvas = document.getElementById('gl') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
const mobile = Math.min(innerWidth, innerHeight) < 700
renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.75 : 2))
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.NoToneMapping
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(28, 1, 0.3, 900)
const hemi = new THREE.HemisphereLight('#ffffff', '#e4e4e0', 2.85)
scene.add(hemi)
const sun = new THREE.DirectionalLight('#ffffff', 1.45)
sun.position.set(-38, 70, 34)
sun.castShadow = true
sun.shadow.mapSize.set(mobile ? 2048 : 4096, mobile ? 2048 : 4096)
Object.assign(sun.shadow.camera, { left: -62, right: 62, top: 62, bottom: -62, near: 10, far: 180 })
sun.shadow.bias = -0.0009
sun.shadow.normalBias = 0.09
scene.add(sun)
// ── hora do dia: 0 manhã · 0.3 meio-dia · 0.62 pôr do sol · 0.8 crepúsculo · 1 noite ──
type Sky = { t: number; az: number; el: number; sun: string; si: number; sky: string; gnd: string; hi: number; bg: string }
const SKY: Sky[] = [
  { t: 0, az: 110, el: 18, sun: '#fff1dc', si: 1.25, sky: '#fbfaf6', gnd: '#e8e3da', hi: 2.55, bg: '#fbfaf7' },
  { t: 0.3, az: 150, el: 62, sun: '#ffffff', si: 1.45, sky: '#ffffff', gnd: '#e4e4e0', hi: 2.85, bg: '#ffffff' },
  { t: 0.62, az: 235, el: 9, sun: '#ffb070', si: 1.9, sky: '#ffe8d2', gnd: '#d9c8b8', hi: 1.7, bg: '#f7e6d6' },
  { t: 0.8, az: 250, el: 2, sun: '#ff8a6a', si: 0.5, sky: '#9aa6c8', gnd: '#6f6a74', hi: 1.05, bg: '#8e97b3' },
  { t: 1, az: 260, el: 25, sun: '#8fa6ff', si: 0.08, sky: '#3a4468', gnd: '#1a1d26', hi: 0.5, bg: '#10131c' },
]
const cA = new THREE.Color(), cB = new THREE.Color(), bg = new THREE.Color()
function applySky(t: number, sunAz: number | null = null) {
  let i = 0
  while (i < SKY.length - 2 && t > SKY[i + 1].t) i++
  const a = SKY[i], b = SKY[i + 1]
  const k = Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t)))
  const lerp = (x: number, y: number) => x + (y - x) * k
  const az = rad(sunAz ?? lerp(a.az, b.az)), el = rad(lerp(a.el, b.el))
  sun.position.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(90)
  sun.color.copy(cA.set(a.sun)).lerp(cB.set(b.sun), k)
  sun.intensity = lerp(a.si, b.si)
  hemi.color.copy(cA.set(a.sky)).lerp(cB.set(b.sky), k)
  hemi.groundColor.copy(cA.set(a.gnd)).lerp(cB.set(b.gnd), k)
  hemi.intensity = lerp(a.hi, b.hi)
  bg.copy(cA.set(a.bg)).lerp(cB.set(b.bg), k)
  return Math.min(1, Math.max(0, (t - 0.66) / 0.3))
}

// ── chão ──────────────────────────────────────────────────────────────
const GU = { uStreets: { value: 0 }, uPlaza: { value: 0 }, uMarks: { value: 0 }, uBg: { value: new THREE.Color('#ffffff') } }
const groundMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 })
groundMat.onBeforeCompile = (s) => {
  Object.assign(s.uniforms, GU)
  s.vertexShader = s.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
    .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed,1.0)).xyz;')
  s.fragmentShader = s.fragmentShader
    .replace(
      '#include <common>',
      `#include <common>
      varying vec3 vWP; uniform float uStreets; uniform float uPlaza; uniform float uMarks; uniform vec3 uBg;
      float hair(float d, float w){ return 1.0 - smoothstep(0.5, 1.5, abs(d) / w); }
      float rectEdge(vec2 p, vec2 h){ vec2 d = abs(p) - h; return max(d.x, d.y); }`,
    )
    .replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      vec2 p = vWP.xz;
      float fw = fwidth(p.x) + fwidth(p.y);
      float ink = 0.0;
      float e1 = rectEdge(p, vec2(${OUT.x.toFixed(1)} + 1.2, ${OUT.z.toFixed(1)} + 1.2));
      float e2 = rectEdge(p, vec2(${OUT.x.toFixed(1)} + 7.5, ${OUT.z.toFixed(1)} + 7.5));
      ink = max(ink, (hair(e1, fw) + hair(e2, fw)) * uStreets);
      if (abs(p.x) < ${PLAZA.x.toFixed(1)} && abs(p.y) < ${PLAZA.z.toFixed(1)}) {
        vec2 g = abs(fract(p / 1.5) - 0.5) * 1.5;
        ink = max(ink, (hair(g.x, fw) + hair(g.y, fw)) * 0.35 * uPlaza);
      }
      ink = max(ink, hair(rectEdge(p, vec2(${PLAZA.x.toFixed(1)}, ${PLAZA.z.toFixed(1)})), fw) * uPlaza);
      vec2 sp = p - vec2(0.0, -6.0);
      float mk = hair(rectEdge(sp, vec2(8.0, 3.5)), fw);
      mk = max(mk, hair(sp.x, fw) * step(abs(sp.y), 5.5) * 0.6);
      mk = max(mk, hair(sp.y, fw) * step(abs(sp.x), 10.0) * 0.6);
      ink = max(ink, mk * uMarks);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.58), clamp(ink, 0.0, 1.0) * 0.9);`,
    )
    .replace('#include <dithering_fragment>', `#include <dithering_fragment>\n gl_FragColor.rgb = mix(gl_FragColor.rgb, uBg, smoothstep(70.0, 150.0, length(vWP.xz)));`)
}
const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), groundMat)
ground.rotation.x = -Math.PI / 2
ground.receiveShadow = true
scene.add(ground)

// ── maquete ───────────────────────────────────────────────────────────
const L = buildLayout()
const clay = clayMaterial()
const depth = clayDepth()
const box = new THREE.BoxGeometry(1, 1, 1)
scene.add(buildInstanced(box, L.modules, clay, depth))
scene.add(buildInstanced(box, L.event, clay, depth))
scene.add(buildInstanced(box, L.furniture, clay, depth))
const treeGeo = (() => {
  const trunk = new THREE.CylinderGeometry(0.12, 0.16, 1.6, 7).toNonIndexed()
  trunk.translate(0, 0.8, 0)
  const crown = new THREE.IcosahedronGeometry(1.35, 1)
  crown.scale(1, 1.15, 1)
  crown.translate(0, 2.9, 0)
  for (const g of [trunk, crown]) g.deleteAttribute('uv')
  return mergeGeometries([trunk, crown])!
})()
scene.add(buildInstanced(treeGeo, L.trees, clay, depth))
const personGeo = (() => {
  const body = new THREE.CapsuleGeometry(0.21, 0.78, 3, 8).toNonIndexed()
  body.translate(0, 0.6, 0)
  const head = new THREE.SphereGeometry(0.16, 10, 8).toNonIndexed()
  head.translate(0, 1.42, 0)
  for (const g of [body, head]) g.deleteAttribute('uv')
  return mergeGeometries([body, head])!
})()
const people = buildInstanced(personGeo, L.people, clay, depth)
scene.add(people)

// praça que cresce a cada projeto
scene.add(buildInstanced(box, L.plaza, clay, depth))
scene.add(buildInstanced(treeGeo, L.plazaTrees, clay, depth))
scene.add(buildInstanced(personGeo, L.plazaPeople, clay, depth))
const lakeMat = new THREE.MeshStandardMaterial({ color: '#dde8ee', roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0 })
const lake = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.06, 72), lakeMat)
lake.scale.set(8, 1, 4.8)
lake.position.set(0, 0.035, -1)
lake.receiveShadow = true
const lakeEdge = new THREE.LineLoop(
  new THREE.BufferGeometry().setFromPoints(Array.from({ length: 96 }, (_, k) => new THREE.Vector3(Math.cos((k / 96) * Math.PI * 2) * 8.05, 0.07, -1 + Math.sin((k / 96) * Math.PI * 2) * 4.85))),
  new THREE.LineBasicMaterial({ color: '#8e8e8a', transparent: true, opacity: 0 }),
)
scene.add(lake, lakeEdge)

// luz de show (só à noite, no evento)
const show = makeShowLights({ y: 9.1, z: -2.8, xs: [-6, -4.5, -3, -1.5, 0, 1.5, 3, 4.5, 6] }, { y: 1.5, z: -8.2, xs: [-5, -3, -1, 1, 3, 5] })
scene.add(show.group)
let grow = 0

// tema da interface acompanha a hora: claro de dia, escuro à noite
const THEME = {
  light: { '--ui-bg': 'rgba(255,255,255,.93)', '--ui-bg-solid': '#fff', '--ui-fg': '#111', '--ui-fg2': '#333', '--ui-mu': '#777', '--ui-ln': '#e6e6e3', '--ui-btn': '#fff', '--ui-img': '#f4f4f2' },
  dark: { '--ui-bg': 'rgba(17,20,29,.86)', '--ui-bg-solid': '#11141d', '--ui-fg': '#f2f1ee', '--ui-fg2': '#cdd0d8', '--ui-mu': '#8b91a1', '--ui-ln': 'rgba(255,255,255,.12)', '--ui-btn': '#1a1e2b', '--ui-img': '#0b0d13' },
}
let darkUI = false
function setTheme(dark: boolean) {
  if (dark === darkUI) return
  darkUI = dark
  for (const [k, v] of Object.entries(dark ? THEME.dark : THEME.light)) document.documentElement.style.setProperty(k, v)
}

// luz dos postes: halo na lâmpada + poça de luz no chão (só à noite)
const radial = (() => {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  r.addColorStop(0, 'rgba(255,255,255,1)')
  r.addColorStop(0.25, 'rgba(255,255,255,.55)')
  r.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = r
  g.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
})()
const lampGlow = new THREE.Points(
  new THREE.BufferGeometry().setFromPoints(L.lamps),
  new THREE.PointsMaterial({ color: '#ffd49a', map: radial, size: 3.4, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
)
scene.add(lampGlow)
const poolMat = new THREE.MeshBasicMaterial({ color: '#ffb866', map: radial, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(9, 9), poolMat, L.lamps.length)
L.lamps.forEach((p, i) => pools.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(p.x, 0.03, p.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2), new THREE.Vector3(1, 1, 1))))
scene.add(pools)

const screens = makeScreens(L.totems, L.tablets)
scene.add(screens.group)
const led = makeLed(L.ledCenter, L.ledSize)
scene.add(led.mesh)

// painéis laterais também são LED
const sideLeds = [-1, 1].map((sgn) => {
  const s = makeLed(new THREE.Vector3(0, 0, 0), new THREE.Vector2(4.6, 2.8))
  s.mesh.rotation.y = -sgn * 0.35
  s.mesh.position.set(sgn * 12.2, 5.2, -4).add(new THREE.Vector3(Math.sin(-sgn * 0.35), 0, Math.cos(-sgn * 0.35)).multiplyScalar(0.14))
  scene.add(s.mesh)
  return s
})

// o LED ilumina a plateia (luz de área na cor do conteúdo) + luz dos laterais
RectAreaLightUniformsLib.init()
const ledLight = new THREE.RectAreaLight('#ff3d9a', 0, L.ledSize.x, L.ledSize.y)
ledLight.position.copy(L.ledCenter).add(new THREE.Vector3(0, 0, 0.4))
ledLight.lookAt(0, 1, 12)
scene.add(ledLight)
const sideLights = [-1, 1].map((sgn) => {
  const l = new THREE.PointLight('#35d5ff', 0, 28, 1.6)
  l.position.set(sgn * 11, 5.2, -1.5)
  scene.add(l)
  return l
})

// ── câmera da história ────────────────────────────────────────────────
const S = L.seedPos
type Key = [number, THREE.Vector3, number, number, number]
const keys: Key[] = [
  [0.0, S.clone().setY(2.6), 52, 31, 38],
  [0.055, S.clone().setY(2.6), 52, 31, 38],
  [0.12, S.clone().setY(2.6), 56, 32, 40],
  [0.2, S.clone().add(new THREE.Vector3(0, 3, -3)), 70, 33, 41],
  [0.3, new THREE.Vector3(0, 3, 2), 104, 34, 42],
  [0.4, new THREE.Vector3(0, 3, -1), 124, 35, 42],
  [0.47, new THREE.Vector3(0, 3, -3), 66, 46, 40],
  [0.53, new THREE.Vector3(0, 3, -3), 64, 46, 40],
  [0.6, new THREE.Vector3(0, 3, -4), 62, 47, 40],
  [0.745, new THREE.Vector3(0, 3.5, -3), 62, 45, 40],
  [0.8, new THREE.Vector3(0, 3.2, -3), 58, 40, 38],
  [0.885, new THREE.Vector3(1.8, 3, -1), 60, 40, 38],
  [0.97, new THREE.Vector3(0, 13, -1), 150, 36, 44],
  [1.0, new THREE.Vector3(0, 13, -1), 150, 36, 44],
]
const q0 = new URLSearchParams(location.search)
const orbit = (tgt: THREE.Vector3, dist: number, el: number, az: number, out: THREE.Vector3) =>
  out.set(Math.sin(rad(az)) * Math.cos(rad(el)), Math.sin(rad(el)), Math.cos(rad(az)) * Math.cos(rad(el))).multiplyScalar(dist).add(tgt)
function storyCam(p: number, outPos: THREE.Vector3, outTgt: THREE.Vector3) {
  let i = 0
  while (i < keys.length - 2 && p > keys[i + 1][0]) i++
  const a = keys[i]
  const b = keys[i + 1]
  const t = sm(0, 1, (p - a[0]) / (b[0] - a[0]))
  outTgt.copy(a[1]).lerp(b[1], t)
  const dist = Math.exp(Math.log(a[2]) + (Math.log(b[2]) - Math.log(a[2])) * t)
  orbit(outTgt, dist, a[3] + (b[3] - a[3]) * t, a[4] + (b[4] - a[4]) * t, outPos)
}

// ── câmeras das obras: vêm de src/shots.json (edite em ?edit=1) ─────────
const STORE = JSON.parse(JSON.stringify(shotsJson)) as ShotStore
function shotFor(i: number): ShotDef {
  const id = STORE.assign[DATA.obras[i]?.id] ?? STORE.order[i % Math.max(1, STORE.order.length)]
  return STORE.shots.find((s) => s.id === id) ?? STORE.shots[0]
}
const EDIT = q0.has('edit') || q0.has('camera')

// ── sessões (com passos internos: a rolagem troca de projeto dentro delas) ─
type Mode = 'story' | 'obras' | 'apps' | 'tech'
const SECTIONS: { id: string; label: string; kicker: string; title: string; body: string; p: number; mode: Mode }[] = [
  { id: 'inicio', label: 'Início', kicker: 'Portfólio', title: 'Victor Ferreira', body: 'Arquiteto e desenvolvedor. Projeto o espaço do evento, assino a estrutura e programo o que as pessoas tocam. Continue para ver a cidade se montar.', p: 0, mode: 'story' },
  { id: 'arquitetura', label: 'Arquitetura', kicker: 'Capítulo 1 · Arquitetura', title: 'Tudo começa num bloco.', body: 'Cada evento nasce de um projeto técnico: planta, estrutura, cálculo e aprovação. Projetos para Coca-Cola, Disney, Starbucks, Mercado Livre e NBA House.', p: 0.42, mode: 'story' },
  { id: 'obras', label: 'Obras', kicker: 'Capítulo 1 · Obras', title: 'Obras', body: 'Role para passar pelos projetos.', p: 0.42, mode: 'obras' },
  { id: 'eventos', label: 'Eventos', kicker: 'Capítulo 2 · Eventos', title: 'Depois, o evento.', body: 'Palco, LED, som, luz e público dimensionados juntos. 21 mil pessoas no Lula 2026. 235 aparelhos de luz no estande do Itaú no Rock in Rio.', p: 0.83, mode: 'story' },
  { id: 'apps', label: 'Apps', kicker: 'Capítulo 3 · Apps', title: 'E o que as pessoas tocam.', body: 'Apps, jogos e photobooths com IA para Google Cloud, Volvo, Fanta, Cinemark e Cinépolis. Role para passar o feed.', p: 0.86, mode: 'apps' },
  { id: 'tecnologia', label: 'Tecnologia', kicker: 'Capítulo 4 · Tecnologia', title: 'Na house mix.', body: 'Produtos, ferramentas e IA, no telão. Role para passar.', p: 0.86, mode: 'tech' },
  { id: 'cidade', label: 'Cidade', kicker: 'Epílogo', title: 'Uma cidade de projetos.', body: 'Tudo o que foi construído, num lugar só. Abra “Projetos” para explorar qualquer trabalho.', p: 0.975, mode: 'story' },
  { id: 'contato', label: 'Contato', kicker: 'Contato', title: 'Vamos construir o próximo.', body: 'Tudo volta a ser um bloco. Arquiteto e urbanista (CAU), em São Paulo. Escreva para começar o seu projeto.', p: 0, mode: 'story' },
]
const stepsOf = (m: Mode) => (m === 'obras' ? DATA.obras.length : m === 'apps' ? DATA.apps.length : m === 'tech' ? TECH.length : 0)

const q = new URLSearchParams(location.search)
const fixedP = q.get('p')
let section = Math.min(SECTIONS.length - 1, +(q.get('s') ?? 0))
let P = fixedP ? +fixedP : SECTIONS[section].p
let tween: { from: number; to: number; t0: number; dur: number } | null = null
let step = +(q.get('i') ?? 0)
let lock = 0
let deviceDelay = 0

const intro = document.getElementById('intro')!
const outro = document.getElementById('outro')!
intro.style.display = 'none'
outro.style.display = 'none'
const ui = buildUI(SECTIONS, { go: (i) => goTo(i), openGallery: () => gallery.show(true) })
const obrasPanel = buildObrasPanel(DATA.obras, { prev: () => advance(-1), next: () => advance(1), view: () => {} })
const feed = buildFeed(DATA.apps as FeedApp[], (d) => goTo(section + d, d < 0 ? -1 : 0))
const ledScreen = buildLed(TECH)
const gallery = buildGallery(DATA, (kind, i) => {
  gallery.show(false)
  if (kind === 'obras') goTo(2, i)
  if (kind === 'apps') goTo(4, i)
  if (kind === 'sistemas') goTo(5, 0)
})

function setStep(i: number) {
  const m = SECTIONS[section].mode
  step = i
  if (m === 'obras') obrasPanel.set(i)
  if (m === 'apps') feed.jump(i)
  if (m === 'tech') ledScreen.set(i)
  lock = performance.now() + 650
}
// avança um passo; na borda, troca de sessão
function advance(d: number) {
  const n = stepsOf(SECTIONS[section].mode)
  if (n && step + d >= 0 && step + d < n) setStep(step + d)
  else goTo(section + d, d < 0 ? -1 : 0)
}

function goTo(i: number, startStep = 0) {
  i = Math.max(0, Math.min(SECTIONS.length - 1, i))
  section = i
  const s = SECTIONS[i]
  const dist = Math.abs(s.p - P)
  if (i === SECTIONS.length - 1) (freeze.pos.copy(cam.pos), freeze.tgt.copy(cam.tgt))
  const slow = i === SECTIONS.length - 1 ? 10000 : 7000 // o contato desmonta devagar, orgânico
  tween = dist > 0.001 ? { from: P, to: s.p, t0: performance.now(), dur: Math.min(slow, Math.max(1400, dist * 14000)) } : null
  lock = performance.now() + (tween ? tween.dur * 0.6 : 900)
  ui.setSection(i)
  const n = stepsOf(s.mode)
  obrasPanel.show(s.mode === 'obras')
  feed.show(false)
  ledScreen.show(false)
  if (n) setStep(startStep < 0 ? n - 1 : Math.min(startStep, n - 1))
  lock = Math.max(lock, performance.now() + 900)
  deviceDelay = performance.now() + 1400
  const mob = isMobile()
  ui.showCard(s.mode === 'story' || (!mob && s.mode === 'apps'), s.mode !== 'story')
}

// ── entrada ───────────────────────────────────────────────────────────
let wheelAcc = 0
addEventListener(
  'wheel',
  (e) => {
    if (EDIT || gallery.open) return
    e.preventDefault()
    if (performance.now() < lock) return
    if (SECTIONS[section].mode === 'apps') return feed.wheel(e.deltaY)
    wheelAcc += e.deltaY
    if (Math.abs(wheelAcc) > 40) {
      advance(Math.sign(wheelAcc))
      wheelAcc = 0
    }
  },
  { passive: false },
)
let touch: { x: number; y: number } | null = null
addEventListener('touchstart', (e) => (touch = { x: e.touches[0].clientX, y: e.touches[0].clientY }), { passive: true })
addEventListener('touchend', (e) => {
  if (!touch || gallery.open) return
  const dx = e.changedTouches[0].clientX - touch.x
  const dy = e.changedTouches[0].clientY - touch.y
  touch = null
  if (performance.now() < lock) return
  if (SECTIONS[section].mode === 'apps' && Math.abs(dy) > 30) feed.wheel(-dy * 2.2)
  else if (Math.abs(dy) > 50 && Math.abs(dy) > Math.abs(dx)) advance(dy < 0 ? 1 : -1)
  else if (Math.abs(dx) > 50) advance(dx < 0 ? 1 : -1)
})
addEventListener('keydown', (e) => {
  if (EDIT) return
  if (e.key === 'Escape') {
    if (obrasPanel.lightbox) obrasPanel.closeLightbox()
    else if (gallery.open) gallery.show(false)
    return
  }
  if (gallery.open || performance.now() < lock) return
  if (SECTIONS[section].mode === 'apps' && ['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', ' '].includes(e.key)) return feed.wheel(['ArrowUp', 'ArrowLeft'].includes(e.key) ? -600 : 600)
  if (['ArrowDown', 'PageDown', ' ', 'ArrowRight'].includes(e.key)) advance(1)
  if (['ArrowUp', 'PageUp', 'ArrowLeft'].includes(e.key)) advance(-1)
})

function resize() {
  renderer.setSize(innerWidth, innerHeight, false)
  camera.aspect = innerWidth / innerHeight
  camera.fov = Math.min(55, (2 * Math.atan(Math.tan(rad(25)) / camera.aspect) * 180) / Math.PI)
  camera.updateProjectionMatrix()
}
resize()
addEventListener('resize', resize)

// ── retângulo 3D projetado na tela ──────────────────────────────────────
const corner = new THREE.Vector3()
function screenRect(mesh: THREE.Mesh, w: number, h: number) {
  mesh.updateWorldMatrix(true, false)
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const [x, y] of [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]) {
    const v = corner.set(x, y, 0).applyMatrix4(mesh.matrixWorld).project(camera)
    const sx = (v.x * 0.5 + 0.5) * innerWidth
    const sy = (-v.y * 0.5 + 0.5) * innerHeight
    x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy)
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}
const heroTotem = L.totems[0]
const heroScreen = screens.group.children[0] as THREE.Mesh
const FOH = new THREE.Vector3(0, 0.55, 6.5)

// ── câmera por modo ───────────────────────────────────────────────────
const want = { pos: new THREE.Vector3(), tgt: new THREE.Vector3() }
const cam = { pos: new THREE.Vector3(), tgt: new THREE.Vector3(), init: false }
const freeze = { pos: new THREE.Vector3(), tgt: new THREE.Vector3() }
let clock = 0
const drag = { az: 0, el: 0, on: false, x: 0, y: 0 }
canvas.addEventListener('pointerdown', (e) => SECTIONS[section].mode === 'obras' && Object.assign(drag, { on: true, x: e.clientX, y: e.clientY }))
addEventListener('pointerup', () => (drag.on = false))
addEventListener('pointermove', (e) => {
  if (!drag.on) return
  drag.az = Math.max(-60, Math.min(60, drag.az - (e.clientX - drag.x) * 0.2))
  drag.el = Math.max(-6, Math.min(30, drag.el + (e.clientY - drag.y) * 0.12))
  drag.x = e.clientX
  drag.y = e.clientY
})
let tod = 0.3
const camDir = new THREE.Vector3()
function modeCam(mode: Mode) {
  if (mode === 'obras') {
    const s = shotFor(step)
    const az = s.az + drag.az + Math.sin(clock * 0.1) * 3
    orbit(want.tgt.set(s.tgt[0], s.tgt[1], s.tgt[2]), s.dist, s.el + drag.el, az, want.pos)
    const right = new THREE.Vector3(Math.cos(rad(az)), 0, -Math.sin(rad(az)))
    if (isMobile()) {
      want.tgt.y -= s.dist * 0.16
      want.pos.y -= s.dist * 0.16
    }
    // desktop: sem deslocamento automático, o enquadramento do editor (com o painel visível) é o do site
    void right
  } else if (mode === 'apps') {
    want.tgt.set(heroTotem.x, heroTotem.y + 0.12, heroTotem.z)
    want.pos.set(heroTotem.x, heroTotem.y + 0.35, heroTotem.z + 4.6)
  } else if (mode === 'tech') {
    // house mix: atrás da técnica, olhando o telão
    want.tgt.set(0, L.ledCenter.y + 0.3, L.ledCenter.z)
    want.pos.set(FOH.x, 4.6, FOH.z + 5.6)
  } else if (section === SECTIONS.length - 1 && P > 0.06) {
    want.pos.copy(freeze.pos)
    want.tgt.copy(freeze.tgt)
  } else storyCam(P, want.pos, want.tgt)
}

// ── laço ──────────────────────────────────────────────────────────────
const tmp = new THREE.Vector3()
const m4 = new THREE.Matrix4()
const qq = new THREE.Quaternion()
const one = new THREE.Vector3(1, 1, 1)
let last = performance.now()
const t0 = last
goTo(section, step)
tween = null
P = fixedP ? +fixedP : SECTIONS[section].p

const edState = { P: 0.42, tod: 0.3 }
let editor: ReturnType<typeof startEditor> | null = null
if (EDIT) {
  editor = startEditor({ onSelect: (k) => goTo(2, k), scene, camera, canvas, store: STORE, projects: DATA.obras.map((o) => ({ id: o.id, title: o.title })), state: edState })
}

function frame(now: number) {
  const dt = Math.min((now - last) / 1000, 1 / 30)
  last = now
  const time = (now - t0) / 1000
  clock = time
  if (tween) {
    const k = Math.min(1, (now - tween.t0) / tween.dur)
    P = tween.from + (tween.to - tween.from) * easeInOut(k)
    ui.progress(k)
    if (k >= 1) tween = null
  }
  const mode = SECTIONS[section].mode
  if (EDIT) P = edState.P

  // dia e noite
  // o sol anda devagar e sempre para a frente: cada projeto é um pedaço do dia
  const n = Math.max(1, DATA.obras.length - 1)
  const storyTod = section <= 1 || section === SECTIONS.length - 1 ? 0.3 : 1 // evento, apps, tecnologia e cidade à noite; o contato amanhece
  const todTarget = mode === 'obras' ? (shotFor(step).tod ?? Math.min(step / n, 1)) : storyTod
  if (EDIT) tod = edState.tod
  else tod = damp(tod, todTarget, 0.9, dt)
  // nas obras o sol fica às costas da câmera (um pouco de lado, para dar volume): a fachada vista está sempre iluminada
  camera.getWorldDirection(camDir)
  const camAz = (Math.atan2(-camDir.x, -camDir.z) * 180) / Math.PI
  const night = applySky(tod, mode === 'obras' || EDIT ? camAz + 28 : null)
  U.uNight.value = night
  setTheme(night > 0.45)
  // praça cresce com os projetos; some quando o evento ocupa o lugar
  const growTarget = mode === 'obras' ? (step >= 4 ? 1 : 0) : section < 2 || section === SECTIONS.length - 1 ? 0 : 1
  grow = EDIT ? 1 : grow + Math.max(-dt / 7, Math.min(dt / 7, growTarget - grow))
  U.uGrow.value = grow
  const lakeK = sm(0.3, 0.4, grow) * (1 - sm(0.455, 0.5, P))
  lakeMat.opacity = lakeK * 0.95
  ;(lakeEdge.material as THREE.LineBasicMaterial).opacity = lakeK
  lake.visible = lakeEdge.visible = lakeK > 0.01
  show.update(time, sm(0.8, 0.83, P) * night * (mode === 'obras' ? 0 : 1))
  renderer.setClearColor(bg)
  GU.uBg.value.copy(bg)
  const lampsOn = sm(0.2, 0.7, night) * (P > 0.33 ? 1 : 0)
  ;(lampGlow.material as THREE.PointsMaterial).opacity = lampsOn
  poolMat.opacity = lampsOn * 0.42

  U.uP.value = P
  U.uTime.value = time
  U.uMorph.value = sm(0.058, 0.11, P)
  U.uJump.value = sm(0.78, 0.81, P) * (mode === 'story' ? 1 : 0.35)
  GU.uStreets.value = sm(0.3, 0.38, P)
  GU.uPlaza.value = sm(0.33, 0.42, P)
  GU.uMarks.value = sm(0.495, 0.525, P) * (1 - sm(0.56, 0.6, P))
  screens.set(sm(0.8, 0.84, P))
  led.mat.uniforms.uOn.value = sm(0.785, 0.83, P)
  led.mat.uniforms.uTime.value = time
  for (const s of sideLeds) {
    s.mat.uniforms.uOn.value = sm(0.79, 0.83, P)
    s.mat.uniforms.uTime.value = time + 1.7
  }
  // iluminação global leve do show: LED central + laterais, na cor do conteúdo
  const showK = sm(0.79, 0.83, P) * night * (mode === 'obras' ? 0 : 1)
  const hue = 0.8 + Math.sin(time * 0.35) * 0.12 // magenta · violeta · azul, como o conteúdo
  ledLight.color.setHSL(hue, 0.85, 0.6)
  ledLight.intensity = showK * 1.4
  sideLights.forEach((l, k) => {
    l.color.setHSL((hue - 0.28 + k * 0.06 + 1) % 1, 0.8, 0.6)
    l.intensity = showK * 26
  })
  hemi.intensity += showK * 0.45
  led.mat.uniforms.uMode.value = damp(led.mat.uniforms.uMode.value, mode === 'tech' && TECH[step]?.pixel ? 1 : 0, 3, dt)
  const hole = U.uHole.value
  if (mode === 'apps') hole.set(heroTotem.x, heroTotem.z + 3.2, 3.4, 1)
  else if (mode === 'tech') hole.set(FOH.x, FOH.z + 4.5, 4, 1)
  else hole.set(0, 0, 0, 0)

  for (const w of L.walkers) {
    w.t += w.speed * dt
    streetPoint(w.t, w.lane, tmp)
    tmp.y = Math.abs(Math.sin(time * 7 + w.index)) * 0.05
    const k = appearOf(P, L.people[w.index].start, L.people[w.index].dur)
    m4.compose(tmp, qq, one.set(1, 1, 1).multiplyScalar(k > 0 ? 1 : 0))
    people.setMatrixAt(w.index, m4)
  }
  people.instanceMatrix.needsUpdate = true

  if (EDIT) {
    editor!.update(dt)
    renderer.render(scene, camera)
    requestAnimationFrame(frame)
    return
  }
  modeCam(mode)
  if (!cam.init) (cam.pos.copy(want.pos), cam.tgt.copy(want.tgt), (cam.init = true))
  const lam = section === SECTIONS.length - 1 ? 1.6 : mode === 'story' ? (tween ? 9 : 4) : 2.2
  cam.pos.set(damp(cam.pos.x, want.pos.x, lam, dt), damp(cam.pos.y, want.pos.y, lam, dt), damp(cam.pos.z, want.pos.z, lam, dt))
  cam.tgt.set(damp(cam.tgt.x, want.tgt.x, lam, dt), damp(cam.tgt.y, want.tgt.y, lam, dt), damp(cam.tgt.z, want.tgt.z, lam, dt))
  camera.position.copy(cam.pos)
  camera.lookAt(cam.tgt)

  const settled = cam.pos.distanceTo(want.pos) < 0.3 && now > deviceDelay
  if (mode === 'apps') {
    feed.show(settled)
    feed.place(screenRect(heroScreen, 1.08, 1.92))
    feed.update(dt, now)
  }
  if (mode === 'tech') {
    ledScreen.show(settled)
    ledScreen.place(screenRect(led.mesh, L.ledSize.x - 0.04, L.ledSize.y - 0.04))
  }

  renderer.render(scene, camera)
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
