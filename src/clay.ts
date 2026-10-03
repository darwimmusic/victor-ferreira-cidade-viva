import * as THREE from 'three'

// Tipos de peça (aAppear.z) — decidem o desenho de superfície no shader
export const K = {
  plain: 0,
  module: 1,
  cabinet: 2,
  truss: 3,
  speaker: 4,
  totem: 5,
  tree: 6,
  person: 7,
  walker: 8,
  seed: 9, // o primeiro bloco: cubo que vira módulo
} as const

// Uniforms compartilhados por toda a maquete: a cena inteira é função de uP
export const U = {
  uP: { value: 0 },
  uTime: { value: 0 },
  uMorph: { value: 0 },
  uJump: { value: 0 },
  uHole: { value: new THREE.Vector4(0, 0, 0, 0) },
  uNight: { value: 0 },
  uGrow: { value: 0 },
}

const VERT_HEAD = /* glsl */ `
attribute vec4 aAppear;   // início, duração, tipo, semente
attribute vec3 aFrom;     // de onde a peça chega (offset em mundo)
attribute vec3 aSize;     // tamanho real, para o desenho de superfície
attribute vec2 aUv;
uniform float uP;
uniform float uTime;
uniform float uMorph;
uniform float uJump;
uniform vec4 uHole;
uniform float uGrow; // crescimento da praça, passo a passo nas obras // x,z,raio,ativo: some com pessoas entre a câmera e o aparelho
varying vec2 vUv2;
varying vec3 vObjN;
varying vec3 vSize;
varying float vKind;
varying vec3 vWorld;
varying float vSeed;
float appearK() {
  if (aAppear.x < 0.0) return 1.0;
  // início >= 2: peça da praça, cresce com uGrow e se recolhe quando o evento começa
  if (aAppear.x >= 2.0) return smoothstep(aAppear.x - 2.0, aAppear.x - 2.0 + aAppear.y, uGrow) * (1.0 - smoothstep(0.455, 0.5, uP));
  return smoothstep(aAppear.x, aAppear.x + aAppear.y, uP);
}
`

const VERT_BEGIN = /* glsl */ `
#include <begin_vertex>
float kA = appearK();
float easeA = 1.0 - (1.0 - kA) * (1.0 - kA) * (1.0 - kA);
transformed *= kA < 0.0005 ? 0.0 : mix(0.82, 1.0, easeA);
if (aAppear.z > 8.5) transformed.x *= mix(0.5, 1.0, uMorph);
if (uHole.w > 0.5 && aAppear.z > 6.5 && aAppear.z < 8.5 && distance(instanceMatrix[3].xz, uHole.xy) < uHole.z) transformed *= 0.0;
vUv2 = aUv; vObjN = normal; vSize = aSize; vKind = aAppear.z; vSeed = aAppear.w;
`

const PLACE = /* glsl */ `
vec4 placed = instanceMatrix * vec4(transformed, 1.0);
placed.xyz += aFrom * (1.0 - easeA);
if (aAppear.z > 6.5 && aAppear.z < 7.5) placed.y += abs(sin(uTime * 5.2 + aAppear.w * 40.0)) * 0.32 * uJump;
`

const VERT_PROJECT = /* glsl */ `
${PLACE}
vWorld = (modelMatrix * placed).xyz;
vec4 mvPosition = viewMatrix * modelMatrix * placed;
gl_Position = projectionMatrix * mvPosition;
`

const VERT_WORLDPOS = /* glsl */ `
vec4 worldPosition = modelMatrix * placed;
`

const FRAG_HEAD = /* glsl */ `
uniform float uMorph;
uniform float uNight;
uniform float uTime;
varying float vSeed;
varying vec2 vUv2;
varying vec3 vObjN;
varying vec3 vSize;
varying float vKind;
varying vec3 vWorld;
float box(vec2 uv, vec2 a, vec2 b) {
  vec2 s = step(a, uv) * step(uv, b);
  return s.x * s.y;
}
float rectLine(vec2 uv, vec2 a, vec2 b, vec2 fw) {
  vec2 d = min(abs(uv - a), abs(uv - b)) / max(fw, vec2(1e-5));
  float inside = box(uv, a - fw * 2.0, b + fw * 2.0);
  return inside * (1.0 - smoothstep(0.5, 1.5, min(d.x, d.y)));
}
`

const FRAG_SURFACE = /* glsl */ `
#include <color_fragment>
vec3 clay = diffuseColor.rgb;
float winGlow = 0.0;
// semente arredondada: a interpolação deixa ruído de 1 ulp que o hash amplifica em chuvisco
float sd = floor(vSeed * 997.0 + 0.5) / 997.0;
vec2 uv = vUv2;
vec2 fw = fwidth(uv);
bool organic = vKind > 5.5 && vKind < 8.5;
if (!organic) {
  // aresta de SketchUp: 1px, independente do tamanho da peça
  vec2 e = min(uv, 1.0 - uv) / max(fw, vec2(1e-5));
  float edge = 1.0 - smoothstep(0.55, 1.55, min(e.x, e.y));

  bool isModule = vKind > 0.5 && vKind < 1.5 || vKind > 8.5;
  if (isModule) {
    float w = vKind > 8.5 ? smoothstep(0.35, 1.0, uMorph) : 1.0;
    if (abs(vObjN.x) > 0.9) {
      // testa envidraçada
      float g = box(uv, vec2(0.1, 0.1), vec2(0.9, 0.86));
      // vidro: mais escuro que a parede, com reflexo suave no alto
      clay = mix(clay, mix(clay * 0.78, clay * 0.9, smoothstep(0.1, 0.86, uv.y)), g * w);
      // cada janela tem seu limiar: acendem uma a uma conforme escurece
      float th = fract(sin(sd * 91.7) * 43758.5);
      float lit = smoothstep(th - 0.04, th + 0.04, uNight * 1.25 - 0.08) * step(0.12, fract(sin(sd * 33.1) * 24634.6));
      // luz interna: mais forte no alto (luminária), caindo para o piso
      winGlow = g * w * lit * (0.55 + 0.45 * smoothstep(0.1, 0.8, uv.y));
      // silhueta de alguém atravessando a sala (em parte das janelas)
      if (fract(sd * 13.7) < 0.45) {
        float px = 0.14 + 0.72 * (0.5 + 0.5 * sin(uTime * (0.25 + sd * 0.3) + sd * 20.0));
        float body = step(abs(uv.x - px), 0.045) * step(0.1, uv.y) * step(uv.y, 0.5);
        float head = step(length(vec2(uv.x - px, (uv.y - 0.58) * 1.0)), 0.042);
        winGlow *= 1.0 - max(body, head) * 0.88;
      }
      edge = max(edge, rectLine(uv, vec2(0.1, 0.1), vec2(0.9, 0.86), fw) * w);
      edge = max(edge, (1.0 - smoothstep(0.5, 1.5, abs(uv.x - 0.5) / fw.x)) * g * w * 0.7);
    } else if (abs(vObjN.z) > 0.9) {
      // rasgo horizontal
      float g = box(uv, vec2(0.34, 0.54), vec2(0.82, 0.7));
      clay = mix(clay, clay * 0.82, g * w);
      float th2 = fract(sin(sd * 57.3) * 24634.6);
      float lit2 = smoothstep(th2 - 0.04, th2 + 0.04, uNight * 1.2 - 0.12);
      winGlow = g * w * lit2;
      edge = max(edge, rectLine(uv, vec2(0.34, 0.54), vec2(0.82, 0.7), fw) * w);
    }
  } else if (vKind > 1.5 && vKind < 2.5) {
    clay *= 0.97;
  } else if (vKind > 2.5 && vKind < 3.5) {
    // treliça: diagonais em mundo
    float t = abs(fract((vWorld.x + vWorld.y + vWorld.z) * 1.6) - 0.5);
    float tw = fwidth(vWorld.x + vWorld.y + vWorld.z) * 1.6;
    edge = max(edge, (1.0 - smoothstep(0.0, tw * 1.4, t)) * 0.85);
    clay *= 0.96;
  } else if (vKind > 3.5 && vKind < 4.5) {
    float gr = abs(fract(uv.y * 7.0) - 0.5);
    edge = max(edge, (1.0 - smoothstep(0.0, fw.y * 7.0 * 1.2, gr)) * step(0.9, abs(vObjN.z)) * 0.6);
    clay *= 0.95;
  }
  clay = mix(clay, vec3(0.56), edge * 0.95);
}
diffuseColor.rgb = clay;
`

function inject(shader: THREE.WebGLProgramParametersWithUniforms, withFragment: boolean) {
  Object.assign(shader.uniforms, U)
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\n${VERT_HEAD}`)
    .replace('#include <begin_vertex>', VERT_BEGIN)
    .replace('#include <project_vertex>', VERT_PROJECT)
    .replace('#include <worldpos_vertex>', VERT_WORLDPOS)
  if (withFragment) {
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_HEAD}`)
      .replace('#include <color_fragment>', FRAG_SURFACE)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.72, 0.4) * winGlow * 1.25;`)
  }
}

export function clayMaterial(color = '#f3f3f1') {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0 })
  m.onBeforeCompile = (s) => inject(s, true)
  m.customProgramCacheKey = () => 'clay-v1'
  return m
}

export function clayDepth() {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking })
  m.onBeforeCompile = (s) => inject(s, false)
  m.customProgramCacheKey = () => 'clay-depth-v1'
  return m
}

// Uma peça da maquete: transformação final + quando/como ela entra
export type Piece = {
  pos: THREE.Vector3
  size: THREE.Vector3
  rotY?: number
  start: number
  dur: number
  kind: number
  from?: THREE.Vector3
}

// Cria um InstancedMesh animável a partir de uma geometria unitária
export function buildInstanced(geo: THREE.BufferGeometry, pieces: Piece[], mat: THREE.Material, depth: THREE.Material) {
  const g = geo.clone()
  if (!g.getAttribute('aUv')) {
    const uv = g.getAttribute('uv')
    g.setAttribute('aUv', uv ? uv.clone() : new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2))
  }
  const n = pieces.length
  const appear = new Float32Array(n * 4)
  const from = new Float32Array(n * 3)
  const size = new Float32Array(n * 3)
  const mesh = new THREE.InstancedMesh(g, mat, n)
  const m4 = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  pieces.forEach((p, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.rotY ?? 0)
    m4.compose(p.pos, q, p.size)
    mesh.setMatrixAt(i, m4)
    appear.set([p.start, p.dur, p.kind, Math.random()], i * 4)
    const f = p.from ?? new THREE.Vector3()
    from.set([f.x, f.y, f.z], i * 3)
    size.set([p.size.x, p.size.y, p.size.z], i * 3)
  })
  g.setAttribute('aAppear', new THREE.InstancedBufferAttribute(appear, 4))
  g.setAttribute('aFrom', new THREE.InstancedBufferAttribute(from, 3))
  g.setAttribute('aSize', new THREE.InstancedBufferAttribute(size, 3))
  mesh.customDepthMaterial = depth
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.frustumCulled = false
  return mesh
}

export const appearOf = (p: number, start: number, dur: number) =>
  start < 0 ? 1 : Math.min(1, Math.max(0, (p - start) / dur))
