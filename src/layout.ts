import * as THREE from 'three'
import { K, type Piece } from './clay'

// Gerador determinístico (mesma cidade em toda recarga)
let seed = 7
const rnd = () => {
  seed = (seed * 16807) % 2147483647
  return (seed - 1) / 2147483646
}
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const sm = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// ── dimensões do complexo ───────────────────────────────────────────
export const CELL = 3 // módulo = 2 x 1 x 1 células (6 x 3 x 3 m)
export const OUT = { x: 30, z: 24 } // meia-largura externa
export const PLAZA = { x: 18, z: 12 } // meia-largura da praça
const H = 3

const built = (x: number, z: number) => Math.abs(x) < OUT.x && Math.abs(z) < OUT.z && !(Math.abs(x) < PLAZA.x && Math.abs(z) < PLAZA.z)

// andares por célula: 1 na frente (z+) até 6 no fundo, com degraus para a praça
function levelsAt(x: number, z: number) {
  const back = sm(OUT.z, -OUT.z, z)
  let L = 1 + Math.round(7 * Math.pow(back, 1.3))
  const nearPlaza = Math.max(Math.abs(x) - PLAZA.x, Math.abs(z) - PLAZA.z)
  if (nearPlaza < CELL && z > -PLAZA.z) L -= 1
  return Math.max(1, L)
}

export type Layout = {
  modules: Piece[]
  context: Piece[]
  trees: Piece[]
  people: Piece[]
  walkers: { index: number; t: number; speed: number; lane: number }[]
  event: Piece[]
  totems: THREE.Vector3[]
  tablets: THREE.Vector3[]
  server: THREE.Vector3
  seedPos: THREE.Vector3
  furniture: Piece[]
  lamps: THREE.Vector3[]
  plaza: Piece[]
  plazaTrees: Piece[]
  plazaPeople: Piece[]
  ledCenter: THREE.Vector3
  ledSize: THREE.Vector2
}

export function buildLayout(): Layout {
  const modules: Piece[] = []
  const cells: number[] = []
  for (let x = -OUT.x + CELL / 2; x < OUT.x; x += CELL) cells.push(x)
  const rows: number[] = []
  for (let z = -OUT.z + CELL / 2; z < OUT.z; z += CELL) rows.push(z)

  // módulos: nível par corre em x, ímpar corre em z (evita sobreposição, dá o trançado BIG)
  for (let lvl = 0; lvl < 9; lvl++) {
    const alongX = lvl % 2 === 0
    const A = alongX ? rows : cells
    const Bs = alongX ? cells : rows
    for (const a of A) {
      for (let i = 0; i + 1 < Bs.length; i += 2) {
        const b0 = Bs[i]
        const b1 = Bs[i + 1]
        const c0 = alongX ? [b0, a] : [a, b0]
        const c1 = alongX ? [b1, a] : [a, b1]
        if (!built(c0[0], c0[1]) || !built(c1[0], c1[1])) continue
        const L = Math.min(levelsAt(c0[0], c0[1]), levelsAt(c1[0], c1[1]))
        if (lvl >= L) continue
        if (lvl === L - 1 && lvl > 0 && rnd() < 0.14) continue // terraços
        const mid = (b0 + b1) / 2
        rnd(); // balanço desligado: invadia o vizinho e criava faces coincidentes
        const cant = 0
        const pos = alongX ? V(mid + cant, lvl * H + H / 2, a) : V(a, lvl * H + H / 2, mid + cant)
        // junta de 5 cm entre módulos: acaba com faces coplanares sobrepostas
        modules.push({ pos, size: V(5.9, H - 0.08, 2.9), rotY: alongX ? 0 : Math.PI / 2, start: 1, dur: 0.02, kind: K.module, from: V(0, 10 + lvl * 3, 0) })
      }
    }
  }

  // semente: módulo térreo da frente, mais perto do centro
  let si = 0
  let best = Infinity
  modules.forEach((m, i) => {
    if (m.pos.y > H) return
    const d = Math.abs(m.pos.x) * 0.5 + Math.abs(m.pos.z - (PLAZA.z + CELL / 2))
    if (d < best) (best = d), (si = i)
  })
  const seedPos = modules[si].pos.clone()
  modules[si].kind = K.seed
  modules[si].start = -1

  // ordem de crescimento: a partir da semente, de baixo para cima
  const order = modules
    .map((m, i) => ({ i, d: m.pos.distanceTo(seedPos) + m.pos.y * 1.6 }))
    .filter((o) => o.i !== si)
    .sort((a, b) => a.d - b.d)
  order.forEach((o, r) => {
    const m = modules[o.i]
    if (r < 11) {
      m.start = 0.125 + r * 0.0075
      m.dur = 0.018
    } else {
      m.start = 0.215 + ((r - 11) / (order.length - 11)) * 0.17
      m.dur = 0.022
    }
  })

  // massas de contexto (vizinhança simples)
  const context: Piece[] = []
  const ctxSpots = [
    [-46, -10, 14, 9, 22], [-46, 18, 14, 6, 16], [46, -14, 14, 12, 18], [46, 14, 14, 7, 20],
    [-14, -40, 22, 15, 12], [16, -40, 20, 10, 12], [-20, 40, 18, 5, 12], [20, 40, 16, 6, 12],
  ]
  ctxSpots.forEach(([x, z, w, h, d], i) => {
    context.push({ pos: V(x, h / 2, z), size: V(w, h, d), start: 0.33 + i * 0.008, dur: 0.03, kind: K.plain, from: V(0, -h, 0) })
  })

  // árvores: ao longo da rua e nos cantos da praça
  const trees: Piece[] = []
  const ring = (t: number, off: number) => {
    const X = OUT.x + off
    const Z = OUT.z + off
    const per = 4 * (X + Z)
    let s = ((t % 1) + 1) % 1 * per
    if (s < 2 * X) return V(-X + s, 0, Z)
    s -= 2 * X
    if (s < 2 * Z) return V(X, 0, Z - s)
    s -= 2 * Z
    if (s < 2 * X) return V(X - s, 0, -Z)
    s -= 2 * X
    return V(-X, 0, -Z + s)
  }
  for (let i = 0; i < 64; i++) {
    const p = ring(i / 64 + rnd() * 0.004, 5.5)
    const s = 0.8 + rnd() * 0.5
    trees.push({ pos: p, size: V(s, s, s), rotY: rnd() * 6, start: 0.3 + (i / 64) * 0.1, dur: 0.02, kind: K.tree, from: V(0, 0, 0) })
  }
  ;[[-15, -9], [15, -9], [-15, 9], [15, 9], [-16.5, 0], [16.5, 0]].forEach(([x, z], i) => {
    trees.push({ pos: V(x, 0, z), size: V(1, 1, 1), rotY: i, start: 0.4 + i * 0.006, dur: 0.02, kind: K.tree })
  })

  // ── evento na praça (palco no fundo, virado para z+) ──────────────
  const event: Piece[] = []
  const add = (pos: THREE.Vector3, size: THREE.Vector3, start: number, dur: number, kind: number, from = V(0, 0, 0), rotY = 0) =>
    event.push({ pos, size, start, dur, kind, from, rotY })

  const SZ = -6
  add(V(0, 0.7, SZ), V(16, 1.4, 7), 0.545, 0.035, K.plain, V(0, -1.6, 0))
  add(V(-5, 0.35, SZ + 4.1), V(2.4, 0.7, 1.2), 0.575, 0.015, K.plain, V(0, -1, 0))
  add(V(5, 0.35, SZ + 4.1), V(2.4, 0.7, 1.2), 0.58, 0.015, K.plain, V(0, -1, 0))

  // parede de LED: 12 x 6 gabinetes, sobe coluna a coluna
  const cols = 12
  const rws = 6
  const ledZ = SZ - 2.9
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < rws; r++) {
      const i = c * rws + r
      add(V(-5.5 + c, 1.9 + r, ledZ), V(0.98, 0.98, 0.3), 0.6 + (i / (cols * rws)) * 0.05, 0.012, K.cabinet, V(0, 5, 0))
    }
  const ledCenter = V(0, 1.4 + rws / 2, ledZ + 0.16)
  const ledSize = new THREE.Vector2(cols, rws)

  // truss
  const TY = 10
  ;[[-8.8, SZ - 3.4], [8.8, SZ - 3.4], [-8.8, SZ + 3.2], [8.8, SZ + 3.2]].forEach(([x, z], i) =>
    add(V(x, TY / 2, z), V(0.45, TY, 0.45), 0.66 + i * 0.004, 0.014, K.truss, V(0, -TY, 0)),
  )
  add(V(0, TY, SZ - 3.4), V(18.05, 0.45, 0.45), 0.683, 0.012, K.truss, V(0, 6, 0))
  add(V(0, TY, SZ + 3.2), V(18.05, 0.45, 0.45), 0.687, 0.012, K.truss, V(0, 6, 0))
  add(V(-8.8, TY, SZ - 0.1), V(0.45, 0.45, 7.05), 0.69, 0.012, K.truss, V(0, 6, 0))
  add(V(8.8, TY, SZ - 0.1), V(0.45, 0.45, 7.05), 0.692, 0.012, K.truss, V(0, 6, 0))
  add(V(0, TY, SZ - 0.1), V(18.05, 0.3, 0.3), 0.694, 0.012, K.truss, V(0, 6, 0))

  // line arrays
  for (const sx of [-7.6, 7.6])
    for (let k = 0; k < 7; k++)
      add(V(sx, TY - 1.2 - k * 0.52, SZ + 3.0), V(1.1, 0.48, 0.9), 0.7 + k * 0.002, 0.01, K.speaker, V(0, 4, 0), sx > 0 ? -0.18 : 0.18)
  // moving heads
  for (let k = 0; k < 9; k++) add(V(-6 + k * 1.5, TY - 0.55, SZ + 3.2), V(0.45, 0.6, 0.45), 0.712 + k * 0.0015, 0.008, K.plain, V(0, 2, 0))
  for (let k = 0; k < 7; k++) add(V(-5 + k * 1.66, TY - 0.55, SZ - 3.4), V(0.45, 0.6, 0.45), 0.72 + k * 0.0015, 0.008, K.plain, V(0, 2, 0))
  // telas laterais
  add(V(-12.2, 5.2, SZ + 2), V(4.6, 2.8, 0.25), 0.722, 0.014, K.cabinet, V(0, 6, 0), 0.35)
  add(V(12.2, 5.2, SZ + 2), V(4.6, 2.8, 0.25), 0.726, 0.014, K.cabinet, V(0, 6, 0), -0.35)
  add(V(-12.2, 1.9, SZ + 2), V(0.2, 3.8, 0.2), 0.72, 0.01, K.truss, V(0, -4, 0))
  add(V(12.2, 1.9, SZ + 2), V(0.2, 3.8, 0.2), 0.72, 0.01, K.truss, V(0, -4, 0))
  // gradil
  for (let k = 0; k < 14; k++) add(V(-7.8 + k * 1.2, 0.55, SZ + 5.4), V(1.15, 1.1, 0.07), 0.73 + k * 0.001, 0.008, K.plain, V(0, 2, 0))
  // FOH + cercado
  add(V(0, 0.55, 6.5), V(3.2, 1.1, 1.6), 0.74, 0.012, K.plain, V(0, -1.2, 0))
  add(V(0, 1.4, 6.9), V(3.2, 0.7, 0.25), 0.742, 0.012, K.plain, V(0, -1.2, 0))
  for (const [x, z, w, d] of [[0, 5.2, 4.4, 0.06], [0, 8.2, 4.4, 0.06], [-2.2, 6.7, 0.06, 3], [2.2, 6.7, 0.06, 3]])
    add(V(x, 0.5, z), V(w, 1, d), 0.745, 0.01, K.plain, V(0, 1.6, 0))
  // cases
  for (let k = 0; k < 6; k++) add(V(10.5 + (k % 2) * 1.3, 0.45 + Math.floor(k / 2) * 0.0, SZ - 1 + Math.floor(k / 2) * 1.2), V(1.2, 0.9, 1.1), 0.735 + k * 0.002, 0.01, K.plain, V(0, 3, 0))

  // totens e tablets na frente do palco
  // um único totem: o feed de apps
  const totems = [V(0, 1.15, 1.2)]
  add(totems[0], V(1.2, 2.3, 0.28), 0.782, 0.012, K.totem, V(0, -2.6, 0))
  const tablets: THREE.Vector3[] = []
  const server = V(0, 0, 0)

  // pessoas: plateia na praça + pedestres na rua
  const people: Piece[] = []
  let placed = 0
  let guard = 0
  while (placed < 300 && guard++ < 6000) {
    const x = (rnd() - 0.5) * 30
    const z = SZ + 6.4 + rnd() * 10.5
    if (Math.abs(x) < 2.8 && z > 4.8 && z < 8.8) continue
    if (Math.abs(z - 1.2) < 1.4 && Math.abs(x) < 2) continue
    const d = Math.hypot(x * 0.5, z - SZ)
    people.push({ pos: V(x, 0, z), size: V(1, 0.9 + rnd() * 0.2, 1), rotY: rnd() * 6, start: 0.742 + sm(4, 18, d) * 0.035, dur: 0.012, kind: K.person, from: V(0, 0, 0) })
    placed++
  }
  const walkers: Layout['walkers'] = []
  for (let i = 0; i < 90; i++) {
    walkers.push({ index: people.length, t: rnd(), speed: (0.0035 + rnd() * 0.004) * (rnd() < 0.5 ? 1 : -1), lane: 2.2 + rnd() * 1.8 })
    people.push({ pos: V(0, 0, 0), size: V(1, 1, 1), start: 0.37 + rnd() * 0.05, dur: 0.02, kind: K.walker })
  }

  // mobiliário: bancos e postes na calçada, alternados com as árvores
  const furniture: Piece[] = []
  const lamps: THREE.Vector3[] = []
  const P0 = new THREE.Vector3()
  for (let i = 0; i < 40; i++) {
    const t = (i + 0.5) / 40
    streetPoint(t, 4.2, P0)
    const onX = Math.abs(Math.abs(P0.z) - (OUT.z + 4.2)) < 0.01
    const st = 0.34 + (i / 40) * 0.06
    if (i % 2 === 0) {
      furniture.push({ pos: P0.clone().setY(0.23), size: onX ? V(1.8, 0.46, 0.5) : V(0.5, 0.46, 1.8), start: st, dur: 0.02, kind: K.plain, from: V(0, 1, 0) })
    } else {
      furniture.push({ pos: P0.clone().setY(2.25), size: V(0.12, 4.5, 0.12), start: st, dur: 0.02, kind: K.plain, from: V(0, -4.5, 0) })
      furniture.push({ pos: P0.clone().setY(4.5), size: V(0.7, 0.14, 0.3), start: st, dur: 0.02, kind: K.plain, from: V(0, 2, 0) })
      lamps.push(P0.clone().setY(4.4))
    }
  }
  // ── praça que cresce a cada projeto (início = 2 + fração do crescimento) ──
  const plaza: Piece[] = []
  const g = (x: number, y: number, z: number, sx: number, sy: number, sz: number, at: number, kind: number = K.plain, rotY = 0) =>
    plaza.push({ pos: V(x, y, z), size: V(sx, sy, sz), start: 2 + at, dur: 0.08, kind, from: V(0, -sy, 0), rotY })
  // bancos em volta do lago
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2
    g(Math.cos(a) * 10.5, 0.23, -1 + Math.sin(a) * 7, 1.8, 0.46, 0.5, 0.12 + k * 0.006, K.plain, -a + Math.PI / 2)
  }
  // canteiros
  for (const [x, z] of [[-14, -8], [14, -8], [-14, 6], [14, 6], [-7, 9.5], [7, 9.5]]) g(x, 0.3, z, 3.2, 0.6, 1.4, 0.22 + Math.abs(x) * 0.002)
  // deque sobre o lago
  g(0, 0.12, 3.6, 2, 0.24, 3.2, 0.34)
  // quiosques
  for (const [x, z] of [[-15.5, -1], [15.5, -1]]) {
    g(x, 1.2, z, 2.4, 2.4, 2.4, 0.58)
    g(x, 2.55, z, 3.2, 0.2, 3.2, 0.6)
  }
  // pérgola no fundo da praça
  for (let k = 0; k < 9; k++) g(-10 + k * 2.5, 1.6, -10.4, 0.18, 3.2, 0.18, 0.72 + k * 0.004)
  for (let k = 0; k < 12; k++) g(-10.5 + k * 1.9, 3.3, -10.4, 0.14, 0.14, 2.6, 0.78 + k * 0.003)
  g(0, 3.24, -11.6, 21, 0.12, 0.12, 0.76)
  g(0, 3.24, -9.2, 21, 0.12, 0.12, 0.76)
  // árvores e gente na praça
  const plazaTrees: Piece[] = []
  for (const [x, z] of [[-12, -4], [12, -4], [-9, 7], [9, 7], [-4, -8], [5, -8], [-16.5, 9], [16.5, 9]])
    plazaTrees.push({ pos: V(x, 0, z), size: V(0.85, 0.85, 0.85), rotY: x, start: 2.45 + Math.abs(z) * 0.005, dur: 0.08, kind: K.tree, from: V(0, 0, 0) })
  const plazaPeople: Piece[] = []
  let n0 = 0
  let guard2 = 0
  while (n0 < 70 && guard2++ < 3000) {
    const x = (rnd() - 0.5) * 32
    const z = (rnd() - 0.5) * 21
    if ((x / 8.2) ** 2 + ((z + 1) / 5) ** 2 < 1) continue // lago
    plazaPeople.push({ pos: V(x, 0, z), size: V(1, 0.9 + rnd() * 0.2, 1), rotY: rnd() * 6, start: 2.02 + rnd() * 0.5, dur: 0.06, kind: K.person })
    n0++
  }
  return { modules, context, trees, people, walkers, event, totems, tablets, server, seedPos, ledCenter, ledSize, furniture, lamps, plaza, plazaTrees, plazaPeople }
}

// Posição de um pedestre na calçada que contorna o complexo
export function streetPoint(t: number, lane: number, out: THREE.Vector3) {
  const X = OUT.x + lane
  const Z = OUT.z + lane
  const per = 4 * (X + Z)
  let s = (((t % 1) + 1) % 1) * per
  if (s < 2 * X) return out.set(-X + s, 0, Z)
  s -= 2 * X
  if (s < 2 * Z) return out.set(X, 0, Z - s)
  s -= 2 * Z
  if (s < 2 * X) return out.set(X - s, 0, -Z)
  s -= 2 * X
  return out.set(-X, 0, -Z + s)
}
