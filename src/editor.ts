// Editor de câmeras (?edit=1 ou ?camera): órbita ou caminhada livre (WASD), salvar, atribuir, gravar no projeto
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export type ShotDef = { id: string; name: string; tgt: number[]; dist: number; el: number; az: number; tod: number | null }
export type ShotStore = { shots: ShotDef[]; assign: Record<string, string>; order: string[] }

const deg = THREE.MathUtils.radToDeg
const rad = THREE.MathUtils.degToRad

export function placeFromShot(s: ShotDef, pos: THREE.Vector3, tgt: THREE.Vector3) {
  tgt.set(s.tgt[0], s.tgt[1], s.tgt[2])
  pos.set(Math.sin(rad(s.az)) * Math.cos(rad(s.el)), Math.sin(rad(s.el)), Math.cos(rad(s.az)) * Math.cos(rad(s.el))).multiplyScalar(s.dist).add(tgt)
}

export function startEditor(opts: {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  canvas: HTMLCanvasElement
  store: ShotStore
  projects: { id: string; title: string }[]
  state: { P: number; tod: number }
  onSelect?: (index: number) => void
}) {
  const { scene, camera, canvas, store, projects, state } = opts
  const view = { siteUI: true, panel: true }
  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.maxPolarAngle = Math.PI * 0.495
  let sel = store.shots[0]?.id ?? ''

  // ── caminhar (WASD + mouse) ──
  const walk = { on: false, yaw: 0, pitch: 0, speed: 8, keys: new Set<string>() }
  const dir = new THREE.Vector3()
  const lookDir = () => dir.set(Math.sin(walk.yaw) * Math.cos(walk.pitch), Math.sin(walk.pitch), Math.cos(walk.yaw) * Math.cos(walk.pitch)).normalize()
  const ray = new THREE.Raycaster()
  // distância até o que está no centro da tela: vira o alvo da câmera
  const aimDistance = () => {
    ray.set(camera.position, lookDir().clone())
    const hit = ray.intersectObjects(scene.children, true).find((h) => h.distance > 0.5 && (h.object as THREE.Mesh).isMesh)
    return hit ? Math.min(hit.distance, 200) : 25
  }
  const startWalk = () => {
    const d = controls.target.clone().sub(camera.position).normalize()
    walk.yaw = Math.atan2(d.x, d.z)
    walk.pitch = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1))
    walk.on = true
    controls.enabled = false
    canvas.requestPointerLock()
    render()
  }
  const stopWalk = () => {
    if (!walk.on) return
    walk.on = false
    controls.target.copy(camera.position).addScaledVector(lookDir().clone(), aimDistance())
    controls.enabled = true
    render()
  }
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement !== canvas) stopWalk()
  })
  addEventListener('mousemove', (e) => {
    if (!walk.on || document.pointerLockElement !== canvas) return
    walk.yaw -= e.movementX * 0.0022
    walk.pitch = THREE.MathUtils.clamp(walk.pitch - e.movementY * 0.0022, -1.45, 1.45)
  })
  addEventListener('keydown', (e) => {
    if (walk.on) walk.keys.add(e.code)
  })
  addEventListener('keyup', (e) => walk.keys.delete(e.code))

  const go = (s: ShotDef) => {
    if (walk.on) document.exitPointerLock()
    placeFromShot(s, camera.position, controls.target)
    if (s.tod !== null) state.tod = s.tod
    sel = s.id
    const k = store.order.indexOf(s.id)
    if (k >= 0) opts.onSelect?.(k)
    render()
  }
  const current = (): Omit<ShotDef, 'id' | 'name' | 'tod'> => {
    if (walk.on) controls.target.copy(camera.position).addScaledVector(lookDir().clone(), aimDistance())
    const v = camera.position.clone().sub(controls.target)
    const dist = v.length()
    return {
      tgt: controls.target.toArray().map((n) => +n.toFixed(2)),
      dist: +dist.toFixed(2),
      el: +deg(Math.asin(v.y / dist)).toFixed(1),
      az: +deg(Math.atan2(v.x, v.z)).toFixed(1),
    }
  }

  const panel = document.createElement('div')
  panel.id = 'vf-editor'
  Object.assign(panel.style, { position: 'fixed', left: '16px', top: '16px', bottom: '16px', width: '340px', zIndex: '60', background: 'rgba(20,22,30,.94)', color: '#eee', font: '12px/1.4 Geist Variable, system-ui', borderRadius: '14px', padding: '14px', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.4)' })
  document.body.appendChild(panel)
  const b = (id: string, t: string, extra = '') => `<button data-b="${id}" style="cursor:pointer;border:1px solid #444;background:#2a2e3c;color:#eee;border-radius:8px;padding:6px 9px;font:inherit;${extra}">${t}</button>`

  function render() {
    const assignOf = (sid: string) => Object.entries(store.assign).filter(([, v]) => v === sid).map(([k]) => projects.find((p) => p.id === k)?.title ?? k)
    const walkStyle = walk.on ? 'background:#ffb020;border-color:#ffb020;color:#111' : ''
    panel.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px"><div style="font-size:15px;font-weight:600">Editor de câmeras</div><span style="margin-left:auto;opacity:.6">P esconde</span></div>
      <div style="display:flex;gap:6px;margin-top:8px">${b('ui', view.siteUI ? 'Interface do site: ligada (U)' : 'Interface do site: desligada (U)', `flex:1;${view.siteUI ? 'background:#1f6feb;border-color:#1f6feb' : ''}`)}</div>
      <div style="opacity:.6;margin-top:2px">Órbita: arraste para girar · botão direito move · roda dá zoom</div>
      ${b('walk', walk.on ? 'Caminhando · Esc para sair' : 'Caminhar (WASD + mouse)', `width:100%;margin-top:10px;padding:9px;font-weight:600;${walkStyle}`)}
      <div style="opacity:.6;margin-top:4px">W/S frente e trás · A/D lados · E sobe · Q desce · Shift corre</div>
      <label style="display:block;margin-top:6px">Velocidade <input id="eSp" type="range" min="2" max="40" step="1" value="${walk.speed}" style="width:100%"></label>
      <label style="display:block;margin-top:10px">Montagem da cidade <input id="eP" type="range" min="0" max="1" step="0.005" value="${state.P}" style="width:100%"></label>
      <label style="display:block;margin-top:6px">Hora do dia <span id="eTv"></span><input id="eT" type="range" min="0" max="1" step="0.01" value="${state.tod}" style="width:100%"></label>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">${b('save', 'Salvar esta câmera', 'background:#3b5bff;border-color:#3b5bff')}${b('update', 'Atualizar selecionada')}${b('del', 'Excluir selecionada')}</div>
      <label style="display:flex;gap:6px;align-items:center;margin-top:8px"><input id="eFix" type="checkbox" checked> guardar a hora atual nesta câmera</label>
      <div style="margin-top:12px;font-weight:600">Câmeras (${store.shots.length}) · na ordem do roteiro</div>
      <div id="eList" style="margin-top:6px;display:flex;flex-direction:column;gap:4px">
        ${store.shots
          .map((s) => {
            const a = assignOf(s.id)
            return `<div data-id="${s.id}" style="cursor:pointer;padding:7px 9px;border-radius:8px;background:${s.id === sel ? '#3b5bff' : '#2a2e3c'}">
              <div>${store.order.indexOf(s.id) >= 0 ? '● ' : '○ '}${s.name}${s.tod !== null ? ` · ${Math.round(s.tod * 100)}% do dia` : ''}</div>
              ${a.length ? `<div style="opacity:.7;font-size:11px">→ ${a.join(', ')}</div>` : ''}</div>`
          })
          .join('')}
      </div>
      <div style="margin-top:12px;font-weight:600">Atribuir a selecionada a um projeto</div>
      <select id="eProj" style="width:100%;margin-top:6px;padding:6px;background:#2a2e3c;color:#eee;border:1px solid #444;border-radius:8px">
        ${projects.map((p) => `<option value="${p.id}">${p.title} ${store.assign[p.id] ? '· ' + (store.shots.find((s) => s.id === store.assign[p.id])?.name ?? '') : ''}</option>`).join('')}
      </select>
      <div style="display:flex;gap:6px;margin-top:6px">${b('assign', 'Atribuir')}${b('clear', 'Limpar atribuição')}</div>
      <div style="margin-top:12px;opacity:.7">● entra no roteiro (na ordem da lista) · Alt+clique liga/desliga</div>
      <div style="margin-top:14px">${b('write', 'Gravar no projeto', 'width:100%;padding:10px;background:#1fae62;border-color:#1fae62;font-weight:600')}</div>
      <div id="eMsg" style="margin-top:8px;opacity:.8"></div>`
    const $ = (s: string) => panel.querySelector(s) as HTMLInputElement
    const on = (id: string, fn: () => void) => ((panel.querySelector(`[data-b="${id}"]`) as HTMLButtonElement).onclick = fn)
    $('#eTv').textContent = `${Math.round(state.tod * 100)}%`
    $('#eSp').oninput = (ev) => (walk.speed = +(ev.target as HTMLInputElement).value)
    $('#eP').oninput = (ev) => (state.P = +(ev.target as HTMLInputElement).value)
    $('#eT').oninput = (ev) => {
      state.tod = +(ev.target as HTMLInputElement).value
      $('#eTv').textContent = `${Math.round(state.tod * 100)}%`
    }
    panel.querySelectorAll('#eList > div').forEach((d) =>
      d.addEventListener('click', (ev) => {
        const id = (d as HTMLElement).dataset.id!
        if ((ev as MouseEvent).altKey) {
          const k = store.order.indexOf(id)
          if (k >= 0) store.order.splice(k, 1)
          else store.order.push(id)
          return render()
        }
        go(store.shots.find((s) => s.id === id)!)
      }),
    )
    const fix = () => ($('#eFix').checked ? +state.tod.toFixed(2) : null)
    on('walk', () => (walk.on ? document.exitPointerLock() : startWalk()))
    on('ui', () => toggleUI())
    on('save', () => {
      const p = current()
      const name = prompt('Nome da câmera', 'Nova câmera')
      if (!name) return
      const s: ShotDef = { id: `c${Date.now().toString(36)}`, name, ...p, tod: fix() }
      store.shots.push(s)
      store.order.push(s.id)
      sel = s.id
      render()
    })
    on('update', () => {
      const s = store.shots.find((x) => x.id === sel)
      if (!s) return
      Object.assign(s, current(), { tod: fix() })
      render()
    })
    on('del', () => {
      if (!sel || !confirm('Excluir esta câmera?')) return
      store.shots = store.shots.filter((s) => s.id !== sel)
      store.order = store.order.filter((i) => i !== sel)
      for (const k of Object.keys(store.assign)) if (store.assign[k] === sel) delete store.assign[k]
      sel = store.shots[0]?.id ?? ''
      render()
    })
    on('assign', () => {
      if (!sel) return
      store.assign[$('#eProj').value] = sel
      render()
    })
    on('clear', () => {
      delete store.assign[$('#eProj').value]
      render()
    })
    on('write', async () => {
      const r = await fetch('/__save-shots', { method: 'POST', body: JSON.stringify(store) })
      $('#eMsg').textContent = r.ok ? 'Gravado em src/shots.json ✓' : 'Falhou ao gravar'
    })
  }
  // interface do site por cima da cena, sem receber clique; U alterna, P esconde o editor
  const style = document.createElement('style')
  document.head.appendChild(style)
  const tab = document.createElement('button')
  tab.textContent = 'Editor (P)'
  Object.assign(tab.style, { position: 'fixed', left: '16px', bottom: '16px', zIndex: '61', display: 'none', cursor: 'pointer', border: 0, borderRadius: '99px', padding: '8px 14px', background: '#20232e', color: '#eee', font: '12px system-ui' })
  tab.onclick = () => togglePanel()
  document.body.appendChild(tab)
  function applyView() {
    style.textContent =
      'body[data-edit] > *:not(canvas):not(#vf-editor):not(#vf-tab), body[data-edit] > *:not(canvas):not(#vf-editor):not(#vf-tab) * { pointer-events: none !important; }' +
      (view.siteUI ? '' : 'body[data-edit] > *:not(canvas):not(#vf-editor):not(#vf-tab) { visibility: hidden !important; }')
    panel.style.display = view.panel ? 'block' : 'none'
    tab.style.display = view.panel ? 'none' : 'block'
  }
  function toggleUI() {
    view.siteUI = !view.siteUI
    applyView()
    render()
  }
  function togglePanel() {
    view.panel = !view.panel
    applyView()
  }
  tab.id = 'vf-tab'
  document.body.setAttribute('data-edit', '')
  addEventListener('keydown', (ev) => {
    if (walk.on || (ev.target as HTMLElement)?.tagName === 'INPUT' || (ev.target as HTMLElement)?.tagName === 'SELECT') return
    if (ev.code === 'KeyU') toggleUI()
    if (ev.code === 'KeyP') togglePanel()
  })
  applyView()

  render()
  const first = store.shots[0]
  if (first) go(first)

  return {
    update(dt = 1 / 60) {
      if (!walk.on) {
        controls.update()
        return
      }
      const f = lookDir().clone().setY(0).normalize()
      const r = new THREE.Vector3(-f.z, 0, f.x)
      const v = new THREE.Vector3()
      const k = walk.keys
      if (k.has('KeyW')) v.add(f)
      if (k.has('KeyS')) v.sub(f)
      if (k.has('KeyD')) v.add(r)
      if (k.has('KeyA')) v.sub(r)
      if (k.has('KeyE')) v.y += 1
      if (k.has('KeyQ')) v.y -= 1
      const sp = walk.speed * (k.has('ShiftLeft') || k.has('ShiftRight') ? 3 : 1)
      if (v.lengthSq()) camera.position.addScaledVector(v.normalize(), sp * dt)
      camera.position.y = Math.max(0.4, camera.position.y)
      camera.lookAt(camera.position.clone().add(lookDir()))
    },
  }
}
