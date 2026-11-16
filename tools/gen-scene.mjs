// Generates the pixel-cosmos backdrop SVG (320x180 logical pixels) into hooks/scene.ts
import { writeFileSync } from 'node:fs'

const W = 320, H = 180
let seed = 1337
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)

// ---------- value noise ----------
const hash = (x, y) => {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
const sm = t => t * t * (3 - 2 * t)
const vnoise = (x, y) => {
  const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi)
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1)
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf
}
const fbm = (x, y, o = 4) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); f *= 2; a *= 0.5 } return s / (1 - Math.pow(0.5, o)) }
const bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
const dith = (x, y) => (bayer[y & 3][x & 3] / 16 - 0.47)

// ---------- raster → run-length paths ----------
// grid: Map color -> Set of "x,y"; we build per layer
class Layer {
  constructor() { this.px = new Map() }
  set(x, y, c) { if (x < 0 || y < 0 || x >= W || y >= H || !c) return; this.px.set(y * W + x, c) }
  get(x, y) { return this.px.get(y * W + x) }
  paths(attrs = '') {
    const byColor = new Map()
    for (let y = 0; y < H; y++) {
      let x = 0
      while (x < W) {
        const c = this.px.get(y * W + x)
        if (!c) { x++; continue }
        let n = 1
        while (x + n < W && this.px.get(y * W + x + n) === c) n++
        if (!byColor.has(c)) byColor.set(c, [])
        byColor.get(c).push([x, y, n])
        x += n
      }
    }
    let out = ''
    for (const [c, runs] of byColor) {
      // relative moves keep numbers short
      let d = '', px = 0, py = 0
      for (const [x, y, n] of runs) {
        d += `m${x - px} ${y - py}h${n}v1h-${n}z`
        px = x; py = y
      }
      d = 'M' + d.slice(1)
      out += `<path fill="${c}"${attrs} d="${d}"/>`
    }
    return out
  }
}

// ---------- nebula (dark blue band, image 1) ----------
const neb = new Layer()
const nebPal = ['#131a3c', '#18224a', '#1f2c5c']
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  // diagonal band from lower-left up to upper-right
  const cy = 150 - x * 0.42 + Math.sin(x * 0.03) * 14
  const dist = Math.abs(y - cy) / 34
  const top = (y < 40 && x > 150) ? Math.max(0, 1 - Math.abs(y - 22 + (x - 230) * 0.05) / 16) * 0.55 : 0
  const v = fbm(x * 0.045, y * 0.07, 4) * 1.05 - dist * 0.75 + top + dith(x, y) * 0.07
  if (v > 0.58) neb.set(x, y, nebPal[2])
  else if (v > 0.47) neb.set(x, y, nebPal[1])
  else if (v > 0.37) neb.set(x, y, nebPal[0])
}

// ---------- galaxy painter ----------
function galaxy(L, cx, cy, R, rot, tilt, pal, th, opts = {}) {
  const { arms = 2, wind = 3.0, armPow = 2.4, core = 1.7, coreR = 5, noiseF = 0.12, sparkle = null, sparkleLayer = null } = opts
  const ca = Math.cos(rot), sa = Math.sin(rot)
  const ext = Math.ceil(R * 1.1)
  for (let y = Math.floor(cy - ext); y <= cy + ext; y++) for (let x = Math.floor(cx - ext); x <= cx + ext; x++) {
    const dx = x - cx, dy = y - cy
    const u = dx * ca + dy * sa, v = (-dx * sa + dy * ca) / tilt
    const r = Math.hypot(u, v)
    if (r > R) continue
    const t = Math.atan2(v, u)
    const n = fbm(x * noiseF + cx, y * noiseF + cy, 3)
    const arm = Math.pow(0.5 + 0.5 * Math.cos(arms * (t - wind * Math.log(r / 3 + 1)) + n * 1.6), armPow)
    const edge = Math.max(0, 1 - r / R)
    let d = core * Math.exp(-r / coreR) + arm * Math.pow(edge, 0.7) * (0.5 + 0.9 * n) + edge * edge * 0.22 * n
    d += dith(x, y) * 0.06
    let lvl = -1
    for (let i = 0; i < th.length; i++) if (d > th[i]) lvl = i
    if (lvl >= 0) L.set(x, y, pal[lvl])
    if (sparkle && sparkleLayer && arm > 0.6 && r > R * 0.2 && rnd() < 0.018) sparkleLayer.push([x, y, sparkle[Math.floor(rnd() * sparkle.length)]])
  }
}

const gal = new Layer()
const sparkA = [], sparkB = []
// Big magenta spiral (image 1) — upper right
const magPal = ['#21142f', '#2f1944', '#46205d', '#652a78', '#8d3790', '#b84ea6', '#e07fc4', '#f8c4e8', '#ffffff']
const magTh = [0.06, 0.13, 0.22, 0.33, 0.47, 0.64, 0.95, 1.25, 1.5]
galaxy(gal, 232, 66, 74, -0.38, 0.46, magPal, magTh, { armPow: 1.3, wind: 2.7, coreR: 6, core: 1.9, sparkle: ['#ff9be0', '#ffd6f4', '#9ef6ff'], sparkleLayer: sparkA })
// Warm spiral (image 1, top-left)
const orPal = ['#2a1820', '#4a2422', '#743a26', '#a3582c', '#cf7d35', '#eda64c', '#ffd889', '#fff6dc']
const orTh = [0.08, 0.17, 0.28, 0.42, 0.6, 0.85, 1.15, 1.45]
galaxy(gal, 50, 42, 30, 0.5, 0.82, orPal, orTh, { wind: 2.6, coreR: 4, core: 1.9, armPow: 2, noiseF: 0.2, sparkle: ['#7af7e6', '#ffb3c8'], sparkleLayer: sparkB })
// distant chain (image 4) — small banded galaxies
const smalls = [
  [118, 24, 9, -0.25, 0.45, ['#1d2a5a', '#3b4fa0', '#7f72d8', '#e88aa8', '#ffd38a', '#fff3d0']],
  [300, 150, 8, 0.3, 0.5, ['#14354a', '#1f6a80', '#3fb6b8', '#c96a4a', '#ffd38a', '#fff']],
  [20, 118, 6, -0.4, 0.5, ['#3a1838', '#6b2a5c', '#c24f7a', '#f2a066', '#ffe2a8', '#fff']],
  [178, 8, 5, 0.1, 0.55, ['#22205a', '#5a4ab0', '#a07ae0', '#ffb070', '#fff0c0', '#fff']],
]
for (const [x, y, R, rot, tilt, pal] of smalls)
  galaxy(gal, x, y, R, rot, tilt, pal, [0.1, 0.3, 0.55, 0.85, 1.2, 1.55], { arms: 2, wind: 1.2, armPow: 1, coreR: R / 3, core: 1.8, noiseF: 0.4 })

// core glow overlay (pulses)
const glow = new Layer()
const glowAt = (cx, cy, rx, ry, rot, c1, c2) => {
  const ca = Math.cos(rot), sa = Math.sin(rot)
  for (let y = cy - ry - 2; y <= cy + ry + 2; y++) for (let x = cx - rx - 2; x <= cx + rx + 2; x++) {
    const dx = x - cx, dy = y - cy, u = dx * ca + dy * sa, v = -dx * sa + dy * ca
    const q = (u / rx) ** 2 + (v / ry) ** 2 + dith(x, y) * 0.25
    if (q < 0.45) glow.set(x, y, c1); else if (q < 1) glow.set(x, y, c2)
  }
}
glowAt(232, 66, 10, 5, -0.38, '#ffffff', '#ffd9f2')
glowAt(50, 42, 4, 4, 0, '#ffffff', '#fff1c4')

// ---------- purple cloud bank (image 3) — bottom ----------
const cloud = new Layer()
const cPal = ['#120a1f', '#1b1030', '#271541', '#371c55', '#4d2668', '#6d3478', '#94468a']
const puffs = []
for (let i = 0; i < 26; i++) puffs.push([i * 13 + rnd() * 10 - 5, 182 - rnd() * 16 - (i % 4 === 0 ? 10 : 0), 7 + rnd() * 13])
for (let y = 120; y < H; y++) for (let x = 0; x < W; x++) {
  let best = -1, shade = 0
  for (const [px, py, pr] of puffs) {
    const q = Math.hypot(x - px, (y - py) * 1.15) / pr
    if (q < 1) {
      const lit = 1 - Math.hypot(x - px + pr * 0.35, (y - py + pr * 0.55) * 1.15) / (pr * 1.25) // light from upper-left
      if (1 - q > best) { best = 1 - q; shade = lit }
    }
  }
  if (best < 0) continue
  const n = fbm(x * 0.15, y * 0.15, 2) * 0.25 + dith(x, y) * 0.12
  const s = shade + n
  const s2 = s - Math.max(0, (y - 150) / 30) * 0.5
  let i = s2 > 0.7 ? 6 : s2 > 0.55 ? 5 : s2 > 0.4 ? 4 : s2 > 0.24 ? 3 : s2 > 0.08 ? 2 : 1
  cloud.set(x, y, cPal[i])
}
// outline-ish shadow between puffs
for (const [k, c] of [...cloud.px]) { const x = k % W, y = (k / W) | 0; if (!cloud.get(x, y - 1) && y > 120 && c === cPal[1]) cloud.set(x, y, cPal[0]) }

// ---------- stars ----------
const used = new Set()
const groups = [[], [], [], []]
const starCols = ['#ffffff', '#cfe8ff', '#8ff0ff', '#ffb6e1', '#ffd27a']
for (let i = 0; i < 420; i++) {
  const x = Math.floor(rnd() * W), y = Math.floor(rnd() * H)
  if (cloud.get(x, y) || used.has(y * W + x)) continue
  used.add(y * W + x)
  groups[i % 4].push([x, y, starCols[Math.floor(rnd() * rnd() * starCols.length)]])
}
const dots = (pts) => {
  const by = new Map()
  for (const [x, y, c] of pts) { if (!by.has(c)) by.set(c, []); by.get(c).push(`M${x} ${y}h1v1h-1z`) }
  return [...by].map(([c, d]) => `<path fill="${c}" d="${d.join('')}"/>`).join('')
}

// cross-stars (+ sparkles with long arms)
const cross = (x, y, len, core, arm, i) => {
  let d1 = '', d2 = ''
  for (let k = 1; k <= len; k++) {
    const t = k <= len / 2 + 0.5 ? 'a' : 'b'
    const seg = `M${x + k} ${y}h1v1h-1zM${x - k} ${y}h1v1h-1zM${x} ${y + k}h1v1h-1zM${x} ${y - k}h1v1h-1z`
    if (t === 'a') d1 += seg; else d2 += seg
  }
  const halo = `M${x - 1} ${y - 1}h3v3h-3z`
  return `<g class="x x${i % 4}" style="transform-origin:${x + 0.5}px ${y + 0.5}px"><path fill="${arm}" opacity=".35" d="${halo}"/><path fill="${arm}" d="${d1}"/><path fill="${arm}" opacity=".45" d="${d2}"/><path fill="${core}" d="M${x} ${y}h1v1h-1z"/></g>`
}
const crosses = [
  [150, 112, 4, '#ffffff', '#3ef0e0'], [268, 132, 4, '#ffffff', '#40f5d6'], [205, 120, 3, '#fffbe0', '#ffc93c'],
  [300, 74, 4, '#ffffff', '#c9b6ff'], [36, 22, 2, '#ffffff', '#7af7e6'], [96, 70, 2, '#fff', '#ffb04a'],
  [8, 96, 2, '#fff', '#ffb04a'], [312, 20, 2, '#fff', '#ffcf6a'], [130, 46, 2, '#fff', '#5ad1ff'],
  [184, 30, 2, '#fff', '#ffb04a'], [70, 140, 3, '#fff', '#5ad1ff'], [248, 106, 2, '#fff', '#ff8ad8'],
  [112, 96, 2, '#fff', '#ff5a6a'],
].map((a, i) => cross(...a, i)).join('')

// ---------- comets (image 1, dashed tail) ----------
const comet = (cls, len, tail) => {
  // drawn heading +x (right), head at origin; rotated via CSS
  let d = '', d2 = '', d3 = ''
  for (let k = 2; k < len; k++) {
    if (k > 12 && k % 3 === 0) continue // dashed far tail
    const yo = k > len * 0.6 ? 0 : 0
    if (k < 7) d += `M${-k} ${yo}h1v1h-1z`; else if (k < 15) d2 += `M${-k} ${yo}h1v1h-1z`; else d3 += `M${-k} ${yo}h1v1h-1z`
  }
  return `<g class="cm ${cls}"><path fill="${tail[2]}" opacity=".5" d="${d3}"/><path fill="${tail[1]}" d="${d2}"/><path fill="${tail[0]}" d="${d}M-2 -1h3v1h-3zM-2 1h3v1h-3z"/><path fill="#ffffff" d="M0 0h2v1h-2zM-1 -1h2v3h-2z"/></g>`
}
const comets = comet('c1', 26, ['#b9fbff', '#3fd8e8', '#2a7fb8']) + comet('c2', 20, ['#ffe2b0', '#ff9a4a', '#a3582c']) + comet('c3', 22, ['#ffd0f2', '#d06ac0', '#6b2a78'])

const sparkPaths = (pts, cls) => `<g class="${cls}">${dots(pts)}</g>`

const css = `
.tw0{animation:tw 5s steps(4) infinite}.tw1{animation:tw 7s steps(5) -2s infinite}.tw2{animation:tw 9s steps(3) -5s infinite}.tw3{opacity:.55}
@keyframes tw{0%,100%{opacity:1}40%{opacity:.25}70%{opacity:.8}}
.sp{animation:tw 3.2s steps(3) infinite}.sp2{animation:tw 4.6s steps(3) -1.7s infinite}
.x{animation:xs 4s steps(6) infinite}.x1{animation-delay:-1s;animation-duration:5.5s}.x2{animation-delay:-2.3s;animation-duration:3.4s}.x3{animation-delay:-3.1s;animation-duration:6.2s}
@keyframes xs{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(.55);opacity:.6}}
.gl{animation:gl 7s ease-in-out infinite}@keyframes gl{0%,100%{opacity:.75}50%{opacity:1}}
.nb{animation:nb 60s steps(12) infinite alternate}@keyframes nb{from{transform:translate(0,0)}to{transform:translate(6px,-2px)}}
.cm{opacity:0;offset-rotate:0deg}
.c1{animation:c1 19s linear infinite 3s}.c2{animation:c2 27s linear infinite 11s}.c3{animation:c3 23s linear infinite 17s}
@keyframes c1{0%{opacity:0;transform:translate(330px,78px) rotate(165deg)}1%{opacity:1}14%{opacity:1}16%,100%{opacity:0;transform:translate(150px,126px) rotate(165deg)}}
@keyframes c2{0%{opacity:0;transform:translate(-20px,10px) rotate(24deg)}1%{opacity:1}13%{opacity:1}15%,100%{opacity:0;transform:translate(170px,95px) rotate(24deg)}}
@keyframes c3{0%{opacity:0;transform:translate(200px,-10px) rotate(140deg)}1%{opacity:1}10%{opacity:1}12%,100%{opacity:0;transform:translate(90px,82px) rotate(140deg)}}
#bg{transform-box:view-box}
@media (max-aspect-ratio:1/1){
 #big{transform:translate(160px,44px) scale(.62) translate(-232px,-66px)}
 #warm{transform:translate(146px,128px) scale(.7) translate(-50px,-42px)}
}
@media (prefers-reduced-motion:reduce){*{animation:none!important}.cm{display:none}}
`.replace(/\n/g, '')

// split galaxy layer into big / warm / small groups for responsive moves
const pick = (L, f) => { const o = new Layer(); for (const [k, c] of L.px) { const x = k % W, y = (k / W) | 0; if (f(x, y)) o.px.set(k, c) } return o }
const inBig = (x, y) => x > 150 && y < 150 && Math.hypot(x - 232, y - 66) < 76
const inWarm = (x, y) => Math.hypot(x - 50, y - 42) < 34
const bigL = pick(gal, inBig), warmL = pick(gal, inWarm), smallL = pick(gal, (x, y) => !inBig(x, y) && !inWarm(x, y))
const bigGlow = pick(glow, inBig), warmGlow = pick(glow, inWarm)

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges"><style>${css}</style>` +
  `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a0818"/><stop offset=".6" stop-color="#110c24"/><stop offset="1" stop-color="#1a1030"/></linearGradient></defs>` +
  `<rect x="-200" y="-200" width="${W + 400}" height="${H + 400}" fill="url(#g)"/>` +
  `<g class="nb">${neb.paths()}</g>` +
  `<g class="tw3">${dots(groups[3])}</g>` +
  smallL.paths() +
  `<g id="warm">${warmL.paths()}<g class="gl">${warmGlow.paths()}</g>${sparkPaths(sparkB, 'sp2')}</g>` +
  `<g id="big">${bigL.paths()}<g class="gl">${bigGlow.paths()}</g>${sparkPaths(sparkA.filter((_, i) => i % 2), 'sp')}${sparkPaths(sparkA.filter((_, i) => !(i % 2)), 'sp2')}</g>` +
  `<g class="tw0">${dots(groups[0])}</g><g class="tw1">${dots(groups[1])}</g><g class="tw2">${dots(groups[2])}</g>` +
  crosses + comets +
  cloud.paths() +
  `</svg>`

console.error('chars', svg.length)
writeFileSync(process.argv[2] + '/scene.svg', svg)
writeFileSync(process.argv[2] + '/hooks/scene.ts', `// Generated pixel-art scene (320x180 logical pixels).\nexport const SCENE = ${JSON.stringify(svg)}\n`)
