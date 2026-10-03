import * as THREE from 'three'

// Interfaces abstratas dos totens (sem texto legível): a única cor do mundo
function uiCanvas(kind: number) {
  const c = document.createElement('canvas')
  c.width = 414
  c.height = 736
  const g = c.getContext('2d')!
  const grad = (a: string, b: string, y0 = 0, y1 = c.height) => {
    const l = g.createLinearGradient(0, y0, c.width, y1)
    l.addColorStop(0, a)
    l.addColorStop(1, b)
    return l
  }
  const rr = (x: number, y: number, w: number, h: number, r: number) => {
    g.beginPath()
    g.roundRect(x, y, w, h, r)
    g.fill()
  }
  g.save()
  g.translate(79, 0)
  g.fillStyle = ['#0b1026', '#12081f', '#061a1a', '#101010', '#0a0f22'][kind]
  g.fillRect(-79, 0, c.width, c.height)
  if (kind === 0) {
    // cards de app
    g.fillStyle = grad('#6a5cff', '#00d4ff')
    rr(24, 60, 208, 240, 22)
    for (let i = 0; i < 4; i++) {
      g.fillStyle = ['#ff4fa3', '#ffd23f', '#3dffb0', '#7c8cff'][i]
      rr(24 + (i % 2) * 108, 330 + Math.floor(i / 2) * 150, 100, 130, 18)
    }
    g.fillStyle = 'rgba(255,255,255,0.9)'
    rr(60, 640, 136, 40, 20)
  } else if (kind === 1) {
    // jogo
    g.fillStyle = grad('#ff2e88', '#7b2cff', 0, 736)
    g.fillRect(0, 0, 256, 736)
    g.fillStyle = 'rgba(255,255,255,0.18)'
    for (let i = 0; i < 9; i++) rr(20 + (i % 3) * 76, 380 + Math.floor(i / 3) * 76, 64, 64, 12)
    g.fillStyle = '#ffe24a'
    g.beginPath()
    g.arc(128, 220, 70, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#fff'
    rr(56, 640, 144, 44, 22)
  } else if (kind === 2) {
    // câmera / photobooth
    g.fillStyle = grad('#00e5c0', '#008cff')
    rr(28, 70, 200, 470, 26)
    g.strokeStyle = 'rgba(255,255,255,0.85)'
    g.lineWidth = 5
    g.beginPath()
    g.ellipse(128, 270, 58, 76, 0, 0, Math.PI * 2)
    g.stroke()
    g.fillStyle = '#fff'
    g.beginPath()
    g.arc(128, 630, 38, 0, Math.PI * 2)
    g.fill()
  } else if (kind === 3) {
    // QR
    g.fillStyle = '#fff'
    rr(38, 200, 180, 180, 16)
    g.fillStyle = '#101010'
    for (let y = 0; y < 11; y++)
      for (let x = 0; x < 11; x++) if ((x * 7 + y * 13 + x * y) % 3 === 0 || (x < 3 && y < 3) || (x > 7 && y < 3) || (x < 3 && y > 7)) g.fillRect(52 + x * 14, 214 + y * 14, 13, 13)
    g.fillStyle = grad('#ffb800', '#ff4d00')
    rr(38, 440, 180, 60, 30)
  } else {
    // dashboard
    g.fillStyle = grad('#2b6bff', '#9b5cff')
    rr(22, 60, 212, 180, 18)
    g.strokeStyle = '#3dffb0'
    g.lineWidth = 5
    g.beginPath()
    for (let i = 0; i < 12; i++) g.lineTo(30 + i * 18, 420 - Math.sin(i * 0.9) * 50 - i * 6)
    g.stroke()
    for (let i = 0; i < 5; i++) {
      g.fillStyle = ['#ff4fa3', '#ffd23f', '#3dffb0', '#00d4ff', '#fff'][i]
      g.fillRect(32 + i * 42, 640 - (40 + i * 22), 26, 40 + i * 22)
    }
  }
  g.restore()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

export function makeScreens(totems: THREE.Vector3[], tablets: THREE.Vector3[]) {
  const group = new THREE.Group()
  const mats: THREE.MeshBasicMaterial[] = []
  const add = (p: THREE.Vector3, w: number, h: number, kind: number, zOff: number) => {
    const m = new THREE.MeshBasicMaterial({ map: uiCanvas(kind), transparent: true, opacity: 0, toneMapped: false })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m)
    mesh.position.set(p.x, p.y + 0.08, p.z + zOff)
    group.add(mesh)
    mats.push(m)
  }
  totems.forEach((p, i) => add(p, 1.08, 1.92, i % 5, 0.145))
  tablets.forEach((p, i) => add(p, 0.6, 0.4, (i + 3) % 5, 0.035))
  return {
    group,
    set(on: number) {
      mats.forEach((m, i) => (m.opacity = Math.min(1, Math.max(0, on * 1.6 - i * 0.08))))
    },
  }
}

// Conteúdo do LED: ondas vivas + grade de pixel
export function makeLed(center: THREE.Vector3, size: THREE.Vector2) {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    toneMapped: false,
    uniforms: { uTime: { value: 0 }, uOn: { value: 0 }, uMode: { value: 0 }, uCab: { value: size.clone() }, uCells: { value: new THREE.Vector2(size.x * 16, size.y * 16) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv; uniform float uTime; uniform float uOn; uniform vec2 uCells; uniform float uMode; uniform vec2 uCab;
      void main(){
        vec2 cell = floor(vUv * uCells) / uCells;
        float w = sin(cell.x * 6.0 + uTime * 0.9) * 0.5 + sin(cell.y * 9.0 - uTime * 1.3 + cell.x * 3.0) * 0.5;
        vec3 a = vec3(1.0, 0.18, 0.53), b = vec3(0.0, 0.83, 1.0), c = vec3(0.42, 0.36, 1.0);
        vec3 col = mix(mix(a, c, smoothstep(-1.0, 0.2, w)), b, smoothstep(0.1, 1.0, w));
        vec2 f = fract(vUv * uCells);
        float dot_ = smoothstep(0.5, 0.36, length(f - 0.5));
        float reveal = smoothstep(0.0, 0.08, uOn * 1.1 - (1.0 - vUv.y) * 0.9 - 0.02);
        vec3 waves = col * (0.55 + 0.6 * dot_);
        // pixel map: gabinetes de 50x50 cm (2 por metro), LEDs visíveis, cabo em zigue-zague
        vec2 grid = uCab * 2.0;
        vec2 cab = vUv * grid;
        vec2 ci = floor(cab);
        vec2 cf = fract(cab);
        float checker = mod(ci.x + ci.y, 2.0);
        vec3 pm = mix(vec3(0.55, 1.0, 0.12), vec3(0.93, 1.0, 0.82), checker);
        // LEDs: 12x12 por gabinete
        vec2 lf = fract(cf * 12.0);
        float ledDot = smoothstep(0.42, 0.22, length(lf - 0.5));
        pm *= 0.62 + 0.45 * ledDot;
        // ordem do cabo: coluna a coluna, subindo e descendo
        float rows = grid.y;
        float o = ci.x * rows + (mod(ci.x, 2.0) < 0.5 ? ci.y : rows - 1.0 - ci.y);
        float total = grid.x * rows;
        float prog = fract(uTime * 0.06) * total * 1.15;
        pm = mix(vec3(0.03), pm, step(o, prog));
        pm = mix(pm, vec3(1.0), (1.0 - smoothstep(0.0, 1.2, abs(o - floor(prog)))) * 0.85);
        // cabo: linha pelo centro da coluna + ligação entre colunas
        float cable = 1.0 - smoothstep(0.015, 0.035, abs(cf.x - 0.5));
        float lastRow = mod(ci.x, 2.0) < 0.5 ? rows - 1.0 : 0.0;
        float link = step(abs(ci.y - lastRow), 0.1) * (1.0 - smoothstep(0.015, 0.035, abs(cf.y - 0.5))) * step(0.5, cf.x);
        pm = mix(pm, vec3(0.05, 0.75, 1.0), max(cable, link) * step(o, prog) * 0.9);
        // bordas dos gabinetes
        float border = 1.0 - smoothstep(0.0, 0.03, min(min(cf.x, 1.0 - cf.x), min(cf.y, 1.0 - cf.y)));
        pm = mix(pm, vec3(0.06), border * 0.9);
        gl_FragColor = vec4(mix(waves, pm, uMode), reveal);
      }`,
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size.x - 0.04, size.y - 0.04), mat)
  mesh.position.copy(center)
  return { mesh, mat }
}

// Linhas de dados: totens/tablets → servidor → LED
export function makeDataLines(from: THREE.Vector3[], server: THREE.Vector3, led: THREE.Vector3) {
  const group = new THREE.Group()
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    uniforms: { uTime: { value: 0 }, uOn: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv; uniform float uTime; uniform float uOn;
      void main(){
        float drawn = step(vUv.x, uOn * 1.15);
        float pulse = smoothstep(0.0, 0.08, fract(vUv.x * 5.0 - uTime * 0.7)) * smoothstep(0.35, 0.1, fract(vUv.x * 5.0 - uTime * 0.7));
        vec3 col = mix(vec3(0.0, 0.83, 1.0), vec3(1.0, 0.18, 0.53), vUv.x);
        gl_FragColor = vec4(col, drawn * (0.35 + 0.65 * pulse) * uOn);
      }`,
  })
  const tube = (a: THREE.Vector3, b: THREE.Vector3, lift: number) => {
    const mid = a.clone().lerp(b, 0.5)
    mid.y += lift
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b)
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 96, 0.075, 8), mat))
  }
  from.forEach((p) => tube(p.clone().add(new THREE.Vector3(0, 1.1, 0)), server.clone().add(new THREE.Vector3(0, 0.7, 0)), 3))
  tube(server.clone().add(new THREE.Vector3(0, 0.7, 0)), led.clone().add(new THREE.Vector3(0, -1, 0.3)), 6)
  return { group, mat }
}
