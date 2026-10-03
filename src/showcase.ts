import * as THREE from 'three'

// Módulo aberto em corte de maquete: prancha no piso, paredes cortadas, teto erguido, painel frontal
const loader = new THREE.TextureLoader()
const cache = new Map<string, THREE.Texture>()
export function tex(url: string) {
  let t = cache.get(url)
  if (!t) {
    t = loader.load(url)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    cache.set(url, t)
  }
  return t
}

const W = 6
const D = 3
const WALL = 1.1
const T = 0.14

export function makeShowcase() {
  const g = new THREE.Group()
  const white = new THREE.MeshStandardMaterial({ color: '#f3f3f1', roughness: 0.92 })
  const poche = new THREE.MeshStandardMaterial({ color: '#bdbdb8', roughness: 1 })
  const edge = new THREE.LineBasicMaterial({ color: '#8e8e8a' })

  const addBox = (w: number, h: number, d: number, x: number, y: number, z: number, parent: THREE.Object3D) => {
    const geo = new THREE.BoxGeometry(w, h, d)
    const m = new THREE.Mesh(geo, [white, white, poche, white, white, white]) // topo cortado em poché
    m.position.set(x, y, z)
    m.castShadow = m.receiveShadow = true
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edge)
    m.add(e)
    parent.add(m)
    return m
  }

  // laje de piso
  const slab = addBox(W, 0.12, D, 0, 0.06, 0, g)
  slab.material = [white, white, white, white, white, white]
  // paredes cortadas na altura da cintura
  addBox(W, WALL, T, 0, WALL / 2, -D / 2 + T / 2, g)
  addBox(T, WALL, D, -W / 2 + T / 2, WALL / 2, 0, g)
  addBox(T, WALL, D, W / 2 - T / 2, WALL / 2, 0, g)
  addBox(W * 0.34, WALL, T, -W / 2 + W * 0.17, WALL / 2, D / 2 - T / 2, g)
  addBox(W * 0.34, WALL, T, W / 2 - W * 0.17, WALL / 2, D / 2 - T / 2, g)

  // prancha no piso
  const planMat = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false })
  const plan = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.5, D - 0.5), planMat)
  plan.rotation.x = -Math.PI / 2
  plan.position.y = 0.125
  g.add(plan)

  // teto erguido (fantasma)
  const roofMat = new THREE.MeshStandardMaterial({ color: '#f3f3f1', roughness: 0.92, transparent: true, opacity: 0.55 })
  const roofGeo = new THREE.BoxGeometry(W, 0.18, D)
  const roof = new THREE.Mesh(roofGeo, roofMat)
  roof.add(new THREE.LineSegments(new THREE.EdgesGeometry(roofGeo), new THREE.LineBasicMaterial({ color: '#9a9a96', transparent: true, opacity: 0.7 })))
  g.add(roof)

  // painel da vista frontal (gira para a câmera)
  const board = new THREE.Group()
  const boardMat = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false, transparent: true, opacity: 0 })
  const boardImg = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), boardMat)
  board.add(boardImg)
  g.add(board)

  let lift = 0
  let front = 0
  let planAspect = 1.4
  let frontAspect = 1.5

  const fitPlan = () => {
    const maxW = W - 0.5
    const maxD = D - 0.5
    const w = Math.min(maxW, maxD * planAspect)
    plan.scale.set(w / maxW, w / planAspect / maxD, 1)
  }

  return {
    group: g,
    set(planUrl: string | null, frontUrl: string | null) {
      if (planUrl) {
        const t = tex(planUrl)
        planMat.map = t
        planMat.needsUpdate = true
        const img = t.image as HTMLImageElement | undefined
        const apply = () => {
          const im = t.image as HTMLImageElement
          planAspect = im.width / im.height
          fitPlan()
        }
        if (img && img.width) apply()
        else t.onUpdate = apply
      }
      if (frontUrl) {
        const t = tex(frontUrl)
        boardMat.map = t
        boardMat.needsUpdate = true
        const im = t.image as HTMLImageElement | undefined
        const apply = () => {
          const i = t.image as HTMLImageElement
          frontAspect = i.width / i.height
        }
        if (im && im.width) apply()
        else t.onUpdate = apply
      }
      lift = 0
    },
    // chamado a cada frame: abertura do teto, painel frontal virado para a câmera
    update(dt: number, open: number, frontal: number, camAz: number) {
      lift += (open - lift) * (1 - Math.exp(-4 * dt))
      front += (frontal - front) * (1 - Math.exp(-5 * dt))
      roof.position.y = 3 - 0.09 + lift * 4.2
      roofMat.opacity = 0.55 * (1 - front)
      roof.visible = roofMat.opacity > 0.02
      const h = 3.6
      board.scale.set(h * frontAspect, h, 1)
      board.position.set(0, WALL + 2.2 + h / 2 + (1 - front) * 0.6, 0)
      board.rotation.y = camAz - g.rotation.y
      boardMat.opacity = front
      board.visible = front > 0.01
    },
  }
}

// Monitores da mesa de som (house mix): tela em +z, virada para o operador atrás da mesa
export function makeMonitors(foh: THREE.Vector3) {
  const g = new THREE.Group()
  const body = new THREE.MeshStandardMaterial({ color: '#f3f3f1', roughness: 0.9 })
  const edge = new THREE.LineBasicMaterial({ color: '#8e8e8a' })
  const screens: THREE.Mesh[] = []
  // [x, giro, largura, altura, altura do centro acima da mesa]
  const specs = [
    [-1.55, 0.28, 1.1, 0.62, 0.95],
    [0, 0, 1.7, 0.96, 1.2],
    [1.55, -0.28, 1.1, 0.62, 0.95],
  ]
  for (const [x, ry, w, h, cy] of specs) {
    const m = new THREE.Group()
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, h + 0.05, 0.04), body)
    frame.add(new THREE.LineSegments(new THREE.EdgesGeometry(frame.geometry), edge))
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.06, cy - h / 2, 0.06), body)
    stand.position.y = -h / 2 - (cy - h / 2) / 2
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: '#0e0e10', toneMapped: false }))
    scr.position.z = 0.021
    m.add(frame, stand, scr)
    m.position.set(foh.x + x, foh.y + 0.55 + cy, foh.z + 0.2)
    m.rotation.y = ry
    m.traverse((o) => ((o as THREE.Mesh).castShadow = true))
    g.add(m)
    screens.push(scr)
  }
  return { group: g, screens }
}
