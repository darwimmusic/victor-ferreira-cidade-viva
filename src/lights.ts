import * as THREE from 'three'

// Fachos de luz do show: cones aditivos que desbotam ao longo do comprimento e nas bordas
const vert = /* glsl */ `
varying float vAlong;
varying float vRim;
void main() {
  vAlong = -position.y / 14.0;               // 0 na lâmpada, 1 na ponta
  vec3 n = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vRim = abs(dot(n, normalize(-mv.xyz)));   // 1 de frente, 0 na borda
  gl_Position = projectionMatrix * mv;
}`
const frag = /* glsl */ `
uniform vec3 uColor;
uniform float uOn;
varying float vAlong;
varying float vRim;
void main() {
  float a = pow(1.0 - clamp(vAlong, 0.0, 1.0), 1.6) * pow(vRim, 1.8) * 0.5 * uOn;
  gl_FragColor = vec4(uColor * a, a);
}`

type Beam = { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; phase: number; hue: number; tilt: number; up: boolean }

export function makeShowLights(truss: { y: number; z: number; xs: number[] }, floor: { y: number; z: number; xs: number[] }) {
  const group = new THREE.Group()
  const beams: Beam[] = []
  const add = (x: number, y: number, z: number, radius: number, up: boolean, hue: number, phase: number) => {
    const geo = new THREE.ConeGeometry(radius, 14, 32, 1, true)
    geo.translate(0, -7, 0) // ponta (lâmpada) na origem, cone para -y
    const mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
      uniforms: { uColor: { value: new THREE.Color() }, uOn: { value: 0 } },
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(x, y, z)
    mesh.frustumCulled = false
    group.add(mesh)
    beams.push({ mesh, mat, phase, hue, tilt: up ? Math.PI : 0, up })
  }
  truss.xs.forEach((x, i) => add(x, truss.y, truss.z, 1.25, false, i % 2 ? 0.58 : 0.9, i * 0.7))
  floor.xs.forEach((x, i) => add(x, floor.y, floor.z, 0.9, true, 0.95 - i * 0.02, i * 1.3))

  return {
    group,
    update(time: number, on: number) {
      group.visible = on > 0.01
      if (!group.visible) return
      for (const b of beams) {
        const t = time * (b.up ? 0.35 : 0.6) + b.phase
        if (b.up) {
          b.mesh.rotation.set(Math.PI - 0.18 + Math.sin(t) * 0.08, 0, Math.sin(t * 0.7) * 0.25)
        } else {
          // moving head: varre a plateia e a praça
          b.mesh.rotation.set(-0.55 + Math.sin(t) * 0.45, 0, Math.sin(t * 0.8 + 1) * 0.6)
        }
        const hue = (b.hue + Math.sin(time * 0.08 + b.phase) * 0.06 + 1) % 1
        b.mat.uniforms.uColor.value.setHSL(hue, 0.9, 0.58)
        b.mat.uniforms.uOn.value = on * (0.75 + 0.25 * Math.sin(time * 2.1 + b.phase * 3))
      }
    },
  }
}
