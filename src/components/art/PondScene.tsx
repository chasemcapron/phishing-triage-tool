/*
 * Gone Phishing: pond scene artwork (original flat-cartoon SVG).
 * Every colour comes from CSS custom properties in ./scene.css (day on :root,
 * night on :root[data-theme='dark']). All art is decorative: aria-hidden.
 *
 * ANCHORS (see also the exported constants below):
 *  SkyBackdrop  position:absolute; inset:0 inside a position:relative parent.
 *               Its bottom --pond-water-band px are water whose fill is exactly
 *               var(--water-surface), so CSS water can continue straight below.
 *               --pond-waterline = height above the backdrop's bottom edge where
 *               the shore banks meet the water: put Fisher/Bobber/extras there.
 *  Fisher       viewBox 0 0 320 200. ROD TIP = (320, 0) = the SVG's top-right
 *               corner. Waterline (dock posts enter the water) at y = 180, i.e.
 *               0.9 of the height, so 6.25% of the width above the SVG bottom.
 *  Bobber       viewBox 0 0 64 48. Line enters at top-centre (32, 9); centre it
 *               on the line. Waterline at y = 36 (0.75 of the height).
 *  LilyPads     viewBox 0 0 120 48, waterline y = 36 (0.75).
 *  Duck         viewBox 0 0 64 48, waterline y = 40 (0.833).
 */
import type { ReactNode } from 'react'
import { JackOLantern } from './Seasonal'
import './scene.css'

type ArtProps = { className?: string }
type N3 = [number, number, number]

export const FISHER_VIEWBOX = { width: 320, height: 200, waterline: 180, tip: [320, 0] } as const
export const BOBBER_VIEWBOX = { width: 64, height: 48, waterline: 36, lineX: 32 } as const

const cls = (...c: (string | undefined)[]) => c.filter(Boolean).join(' ')

function Art(p: { className?: string; viewBox?: string; fit?: string; children: ReactNode }) {
  return (
    <svg
      className={cls('pond-art', p.className)}
      viewBox={p.viewBox}
      preserveAspectRatio={p.fit}
      aria-hidden="true"
      focusable="false"
    >
      {p.children}
    </svg>
  )
}

/* ---------- Sky ---------- */

// Night star field [x%, y%, r, wide-only]: % positions, fixed-px radius; kept clear of hero text.
const STARS: [number, number, number, number?][] = [
  [3, 30, 1.4], [22, 4, 1.8], [19, 32, 1.1], [29, 11, 1], [38, 30, 1.1], [44, 8, 1.3], [47, 58, 1],
  [53, 31, 1.7], [58, 12, 1.1], [62, 50, 1.2], [67, 22, 1], [72, 64, 1.4, 1], [76, 38, 1.1], [95, 16, 1.2],
  [96, 50, 1.5], [88, 70, 1, 1], [80, 6, 1.1], [50, 80, 1.1, 1], [4, 92, 1], [13, 6, 1.2], [84, 46, 1], [59, 72, 1.2, 1],
]
const SPARKLES: N3[] = [[30, 3, 1], [56, 22, 0.8], [69, 9, 0.9], [78, 30, 0.75], [97, 70, 0.7]]
const SPARKLE = 'M0-6Q1-1 6 0Q1 1 0 6Q-1 1-6 0Q-1-1 0-6Z'

function Stars() {
  return (
    <Art className="pond-stars">
      {STARS.map(([x, y, r, w], i) => (
        <circle key={i} className={w ? 'pond-star pond-star--wide' : 'pond-star'} cx={`${x}%`} cy={`${y}%`} r={r} />
      ))}
      {SPARKLES.map(([x, y, s], i) => (
        <svg key={i} x={`${x}%`} y={`${y}%`} overflow="visible">
          <path className="pond-star pond-sparkle" d={SPARKLE} transform={`scale(${s})`} />
        </svg>
      ))}
    </Art>
  )
}

function SunMoon() {
  return (
    <Art className="pond-sun" viewBox="0 0 120 120">
      <g className="ps-day">
        <circle className="ps-glow2" cx="60" cy="60" r="58" />
        <circle className="ps-glow" cx="60" cy="60" r="45" />
        <circle className="ps-disc" cx="60" cy="60" r="31" />
        <path className="ps-hi" d="M42 56a19 19 0 0 1 16-17" />
      </g>
      <g className="ps-night">
        <circle className="pm-glow2" cx="60" cy="60" r="54" />
        <circle className="pm-glow" cx="60" cy="60" r="40" />
        <circle className="pm-disc" cx="60" cy="60" r="27" />
        <circle className="pm-crater" cx="51" cy="54" r="5.5" />
        <circle className="pm-crater" cx="68" cy="67" r="7" />
        <circle className="pm-crater" cx="64" cy="46" r="3" />
        <circle className="pm-crater" cx="52" cy="72" r="3.5" />
      </g>
    </Art>
  )
}

// Cloud = union of circles + a pill; drawn twice (shade offset down, then body).
const CLOUDS = {
  a: { vb: '24 8 168 88', c: [[52, 62, 26], [92, 44, 34], [136, 50, 28], [170, 64, 20]], p: [30, 58, 160, 30] },
  b: { vb: '20 4 90 62', c: [[40, 40, 18], [66, 30, 24], [92, 42, 16]], p: [24, 38, 84, 20] },
} as const

function Cloud({ v, n }: { v: keyof typeof CLOUDS; n: number }) {
  const { vb, c, p } = CLOUDS[v]
  const shape = (
    <>
      {c.map(([x, y, r]) => (
        <circle key={x} cx={x} cy={y} r={r} />
      ))}
      <rect x={p[0]} y={p[1]} width={p[2]} height={p[3]} rx={p[3] / 2} />
    </>
  )
  return (
    <Art className={`pond-cloud pond-cloud--${n}`} viewBox={vb}>
      <g className="pc-shade" transform="translate(0 6)">{shape}</g>
      <g className="pc-body">{shape}</g>
    </Art>
  )
}

/* ---------- Land ---------- */

// Round tree clusters on the far hills: [cx, cy, r]; their bases sink into TREE_BAND.
const TREES: N3[] = [
  [262, 86, 16], [288, 78, 21], [317, 84, 15], [340, 90, 12],
  [700, 76, 14], [726, 68, 20], [754, 74, 16], [779, 80, 12],
  [1128, 72, 15], [1155, 64, 21], [1185, 70, 14], [1208, 78, 10],
]
const TREE_BAND =
  'M0 134C120 134 200 92 262 90L340 94C400 98 460 134 560 134C620 134 660 80 700 80L780 84C830 88 880 130 960 130C1040 130 1090 76 1128 76L1208 80C1260 84 1300 128 1440 128V170H0Z'
const PINES: N3[] = [[372, 104, 30], [812, 92, 32], [1232, 88, 28], [244, 96, 24]]
const FLOWERS = [[140, 134, 'a'], [168, 140, 'b'], [520, 136, 'a'], [604, 131, 'b'], [1010, 141, 'a'], [1290, 128, 'b'], [1330, 134, 'a']] as const

function Hills() {
  return (
    <Art className="pond-hills" viewBox="0 0 1440 170" fit="xMidYMax slice">
      <path className="ph-far" d="M0 100C120 60 260 58 380 84S560 70 680 66S900 96 1020 90S1200 52 1320 60S1420 76 1440 82V170H0Z" />
      <path className="ph-tree" d={TREE_BAND} />
      {TREES.map(([x, y, r]) => (
        <circle key={x} className="ph-tree" cx={x} cy={y} r={r} />
      ))}
      {PINES.map(([x, y, h]) => (
        <path key={x} className="ph-pine" d={`M${x} ${y - h}L${x + 7} ${y}H${x - 7}Z`} />
      ))}
      <path className="ph-near" d="M0 128C140 110 260 112 380 126S640 120 780 118S1020 136 1160 130S1380 112 1440 116V170H0Z" />
      {FLOWERS.map(([x, y, c]) => (
        <circle key={x} className={`ph-flower ph-flower--${c}`} cx={x} cy={y} r="2.6" />
      ))}
      <path className="ph-shore" d="M0 150C240 141 480 145 720 147S1200 141 1440 147V170H0Z" />
    </Art>
  )
}

// Tapered, gently curved reed blade standing on baseline b.
const blade = (x: number, b: number, h: number, l: number) =>
  `M${x - 3.2} ${b}Q${x + l * 0.35 - 1} ${b - h * 0.6} ${x + l} ${b - h}Q${x + l * 0.4 + 2} ${b - h * 0.5} ${x + 3.2} ${b}Z`

type Reed = readonly [x: number, h: number, lean: number]
const BANKS: Record<'l' | 'r', { back: Reed[]; front: Reed[]; cat: Reed[]; flies: [number, number][] }> = {
  l: {
    back: [[70, 70, -6], [96, 96, 8], [122, 84, -10], [150, 112, 12], [176, 88, 18], [200, 70, 22]],
    front: [[232, 62, 10], [246, 46, -6], [258, 38, 8]],
    cat: [[140, 128, 6], [186, 112, -4], [222, 92, 10]],
    flies: [[60, 46], [118, 30], [214, 54]],
  },
  r: {
    back: [[60, 62, 6], [88, 92, -8], [118, 104, 10], [140, 78, -12], [168, 96, 14], [196, 64, 20]],
    front: [[230, 54, -8], [244, 68, 6]],
    cat: [[104, 136, -6], [160, 118, 8], [212, 90, -4]],
    flies: [[80, 40], [170, 24], [240, 60]],
  },
}
const W = 192 // bank waterline (viewBox y)

function Bank({ side }: { side: 'l' | 'r' }) {
  const b = BANKS[side]
  const reeds = (list: Reed[], k: string) =>
    list.map(([x, h, l]) => <path key={k + x} className="pb-reed" d={blade(x, W, h, l)} />)
  return (
    <Art className={`pond-bank pond-bank--${side}`} viewBox="0 0 300 200">
      <path className="pk-back" d="M0 64C54 56 112 70 160 104S240 170 270 192H0Z" />
      {reeds(b.back, 'b')}
      {b.cat.map(([x, h, l]) => (
        <g key={x} className="pb-cat">
          <path className="pb-stem" d={`M${x} ${W}Q${x} ${W - h * 0.6} ${x + l} ${W - h}v-30`} />
          <rect className="pb-head" x={x + l - 4.5} y={W - h - 26} width="9" height="26" rx="4.5" />
        </g>
      ))}
      <path className="pk-front" d="M0 92C64 86 130 104 180 140S236 182 244 192H0Z" />
      <path className="pk-tuft" d="M24 90q3-12 6 0q3-15 6 0q3-11 6 0ZM118 106q3-11 6 0q3-14 6 0ZM196 152q3-10 6 0q3-13 6 0Z" />
      <ellipse className="pk-rock" cx="204" cy="190" rx="14" ry="7" />
      {reeds(b.front, 'f')}
      <path className="pond-ripple" d="M168 196h40M222 195h36M236 199h22M10 197h120" />
      {b.flies.map(([x, y], i) => (
        <circle key={i} className="pond-firefly" cx={x} cy={y} r="2.6" />
      ))}
    </Art>
  )
}

/* ---------- Water surface ---------- */

// Fixed-pixel wave (no viewBox) so crests stay the same size at every width.
function wave(len: number, amp: number, y: number) {
  let d = `M${-len} ${y}q${len / 4} ${-amp * 2} ${len / 2} 0`
  for (let i = 0; i < 180; i++) d += `t${len / 2} 0`
  return `${d}V400H${-len}Z`
}
const WAVE_BACK = wave(56, 3, 6)
const WAVE_FRONT = wave(56, 3, 10)
const GLINTS: N3[] = [[9, 58, 26], [24, 76, 14], [38, 52, 30], [52, 74, 18], [64, 54, 24], [79, 72, 16], [90, 50, 12]]

function Water() {
  return (
    <Art className="pond-water">
      <path className="pw-back" d={WAVE_BACK} />
      <path className="pw-front" d={WAVE_FRONT} />
      {GLINTS.map(([x, y, w], i) => (
        <rect key={i} className="pw-glint" x={`${x}%`} y={`${y}%`} width={w} height="3" rx="1.5" />
      ))}
    </Art>
  )
}

/**
 * Full-bleed sky + landscape behind the header and hero. Absolutely fills its
 * nearest positioned ancestor (give that parent position:relative and a height,
 * and give the hero content position:relative so it stacks above).
 */
export function SkyBackdrop({ className }: ArtProps) {
  return (
    <div className={cls('pond-art pond-scene', className)} aria-hidden="true">
      <Stars />
      <SunMoon />
      <Cloud v="a" n={1} />
      <Cloud v="b" n={2} />
      <Cloud v="a" n={3} />
      <Cloud v="b" n={4} />
      <Cloud v="b" n={5} />
      <Art className="pond-birds" viewBox="0 0 60 24">
        <path className="pond-bird" d="M2 10q5-6 10 0q5-6 10 0M34 18q4-5 8 0q4-5 8 0" />
      </Art>
      <Hills />
      <Water />
      <Bank side="l" />
      <Bank side="r" />
    </div>
  )
}

/* ---------- Fisher ---------- */

const POSTS = [48, 128, 208]
const Boot = () => (
  <>
    <path className="pf-boot" d="M227 150H240L241 160Q251 160 252 166Q252 170 247 170H228Q225 170 225 166Z" />
    <rect className="pf-boot-dk" x="225" y="167" width="27" height="3.4" rx="1.7" />
  </>
)

/**
 * Cartoon fisher on the end of a dock. viewBox 0 0 320 200.
 * Rod tip is EXACTLY the top-right corner (320, 0): drop the line from the
 * element's top-right. Waterline at y = 180 (90% down; 0.0625 × width above
 * the SVG's bottom edge). The dock's left end grows out of a grassy tuft.
 */
export function Fisher({ className }: ArtProps) {
  return (
    <Art className={cls('pond-fisher', className)} viewBox="0 0 320 200">
      <circle className="pf-glow" cx="84" cy="116" r="26" />
      <circle className="pf-glow" cx="84" cy="116" r="15" />
      <path className="pk-back" d="M0 116C22 112 46 122 62 146C70 158 74 170 76 182H0Z" />
      {POSTS.map((x) => (
        <g key={x}>
          <rect className="pf-post" x={x - 6} y="122" width="12" height="58" rx="3" />
          <rect className="pf-post-sub" x={x - 6} y="180" width="12" height="18" rx="2" />
          <ellipse className="pond-ripple-o" cx={x} cy="181" rx="11" ry="2.4" />
        </g>
      ))}
      <rect className="pf-deck" x="30" y="128" width="196" height="12" rx="2" />
      <rect className="pf-deck-hi" x="30" y="128" width="196" height="3" rx="1.5" />
      <rect className="pf-deck-dk" x="34" y="140" width="188" height="5" />
      <path className="pf-seam" d="M58 131v9M86 131v9M114 131v9M142 131v9M170 131v9M198 131v9" />
      <path className="pk-front" d="M0 132C14 128 30 134 40 148C46 158 48 170 48 182H0Z" />
      <path className="pk-tuft" d="M18 132q3-12 6 0q3-15 6 0q3-11 6 0Z" />
      <path className="pb-reed" d={blade(8, 150, 54, -6)} />
      <path className="pb-reed" d={blade(18, 150, 40, 8)} />
      {/* lantern */}
      <path className="pf-lantern" d="M76 124h16v4H76ZM78 108h12l-2-3h-8Z" />
      <rect className="pf-glass" x="79" y="110" width="10" height="14" rx="2" />
      <path className="pf-handle" d="M80 105q4-7 8 0M84 110v14" />
      {/* bait bucket with a cheeky tail */}
      <path className="pf-tail" d="M141 113q-1-5 1-8l-5-5q4 0 6 3q2-3 6-3l-5 5q2 3 1 8Z" />
      <path className="pf-bucket" d="M131 112H153L150.5 128H133.5Z" />
      <rect className="pf-bucket-dk" x="130" y="110" width="24" height="4" rx="2" />
      <path className="pf-handle" d="M133 112Q142 96 151 112" />
      {/* Halloween only (seasonal.css) */}
      <g className="season-only season-only--halloween">
        <JackOLantern x={112} y={121} s={0.72} />
      </g>
      {/* back arm + leg */}
      <path className="pf-s-shirt-dk" d="M188 94L205 115" strokeWidth="10" />
      <circle className="pf-skin-dk" cx="205" cy="115" r="5.2" />
      <path className="pf-s-pants-dk" d="M186 121H224" strokeWidth="14" />
      <g className="pf-leg pf-leg--back">
        <path className="pf-s-pants-dk" d="M224 122L226 150" strokeWidth="12" />
        <g transform="translate(-7 -2)">
          <Boot />
        </g>
      </g>
      {/* torso */}
      <path className="pf-shirt" d="M172 128C168 112 172 96 184 90C192 86 204 86 210 92C216 100 216 116 212 128Z" />
      <path className="pf-shirt-dk" d="M172 128C168 112 172 96 184 90C178 102 177 116 179 128Z" />
      {/* front leg */}
      <path className="pf-s-pants" d="M190 122H230" strokeWidth="15" />
      <g className="pf-leg pf-leg--front">
        <path className="pf-s-pants" d="M230 122L233 152" strokeWidth="12.5" />
        <Boot />
      </g>
      {/* head */}
      <circle className="pf-skin" cx="197" cy="66" r="20" />
      <circle className="pf-skin" cx="216" cy="69" r="3.4" />
      <circle className="pf-skin-dk" cx="184" cy="70" r="5" />
      <path className="pf-hair" d="M177 57Q174 70 182 76Q181 67 186 60Z" />
      <ellipse className="pf-ink" cx="206" cy="65.5" rx="2.2" ry="2.9" />
      <circle className="pf-cheek" cx="209" cy="73.5" r="4.4" />
      <path className="pf-smile" d="M201 77.5q4 3 8-.5" />
      <path className="pf-hat" d="M178 54C178 38 188 32 198 32S218 38 218 54Z" />
      <path className="pf-hat-dk" d="M178.4 48Q198 44 217.6 48L218 54Q198 50 178 54Z" />
      <path className="pf-hat" d="M170 54Q198 47 226 54Q229 60 222 61Q198 56 174 61Q167 60 170 54Z" />
      {/* rod: grip, reel, blank to the tip at (320,0), line along the rod */}
      <path className="pf-s-grip" d="M195 125L209 111" strokeWidth="6.5" />
      <path className="pf-s-rod" d="M216 117l-3-3" strokeWidth="2.4" />
      <circle className="pf-reel" cx="218" cy="118" r="5.4" />
      <circle className="pf-reel-dk" cx="218" cy="118" r="1.8" />
      <path className="pf-s-rod" d="M209 111L264 56" strokeWidth="3.6" />
      <path className="pf-s-rod" d="M264 56L320 0" strokeWidth="2.4" />
      <path className="pf-s-line" d="M220 114L238 84.6L264.6 58.6L292.6 30.6L320 0" />
      {/* front arm (over the rod) */}
      <path className="pf-s-shirt" d="M201 92L210 111" strokeWidth="10.5" />
      <path className="pf-s-skin" d="M210 111L219 101" strokeWidth="7.5" />
      <circle className="pf-skin" cx="219" cy="101" r="5.6" />
    </Art>
  )
}

/* ---------- Bobber ---------- */

/** Red/white float. viewBox 0 0 64 48; line enters top-centre (32, 9); waterline y = 36. */
export function Bobber({ className }: ArtProps) {
  return (
    <Art className={cls('pond-bobber', className)} viewBox="0 0 64 48">
      <ellipse className="pond-ring" cx="32" cy="37" rx="15" ry="3.2" />
      <ellipse className="pond-ring pond-ring--2" cx="32" cy="37" rx="15" ry="3.2" />
      <g className="pb-float">
        <rect className="pb-stem-r" x="30.6" y="11" width="2.8" height="10" rx="1.4" />
        <circle className="pb-eye" cx="32" cy="10.6" r="1.8" />
        <path className="pb-white" d="M21 30A11 11 0 0 0 43 30Z" />
        <path className="pb-red" d="M21 30A11 11 0 0 1 43 30Z" />
        <rect className="pb-band" x="21" y="29" width="22" height="2.4" rx="1.2" />
        <ellipse className="pb-hi" cx="27.5" cy="24.5" rx="3" ry="2" transform="rotate(-30 27.5 24.5)" />
        <path className="pb-sub" d="M22.8 36A11 11 0 0 0 41.2 36Z" />
      </g>
    </Art>
  )
}

/* ---------- Logo ---------- */

/** Header mark: a little fish nosing a hook on a pond tile. viewBox 0 0 32 32. */
export function LogoMark({ className }: ArtProps) {
  return (
    <Art className={cls('pond-logo', className)} viewBox="0 0 32 32">
      <rect className="pl-tile" width="32" height="32" rx="8" />
      <path className="pl-wave" d="M0 26q4-2.2 8 0t8 0t8 0t8 0V24A8 8 0 0 1 24 32H8A8 8 0 0 1 0 24Z" />
      <path className="pl-hook" d="M24 0V5.4M24 9V15.5A3.6 3.6 0 0 1 16.8 15.5V12.6L18.9 14.6" />
      <circle className="pl-eye-ring" cx="24" cy="7.2" r="1.8" />
      <path className="pl-fish" d="M4.6 21C7 15.6 15.4 14.6 19.8 20.2C15.4 25.8 7 25.6 4.6 21ZM5.6 21L1.8 17Q2.9 21 1.8 25Z" />
      <path className="pl-fin" d="M9.4 16.8Q12 13 15.6 15.6Q12.4 15.8 10.6 17.4Z" />
      <circle className="pl-eye" cx="15.4" cy="19.6" r="1.9" />
      <circle className="pl-pupil" cx="15.9" cy="19.6" r="0.95" />
    </Art>
  )
}

/* ---------- Extras ---------- */

/**
 * Two lily pads, a lotus and a tiny frog. viewBox 0 0 120 48; waterline y = 36.
 * onFrogClick: an easter egg (mouse/touch only; the season picker is the accessible control).
 */
export function LilyPads({ className, onFrogClick, hop }: ArtProps & { onFrogClick?: () => void; hop?: boolean }) {
  return (
    <Art className={cls('pond-lily', className)} viewBox="0 0 120 48">
      <ellipse className="pond-ripple-o" cx="44" cy="39" rx="34" ry="5" />
      <path className="pp-pad-dk" d="M42 38L63.4 43.5A28 8.5 0 1 1 69.6 39.5Z" />
      <path className="pp-pad" d="M42 36L63.4 41.5A28 8.5 0 1 1 69.6 37.5Z" />
      <path className="pp-vein" d="M42 36L20 33M42 36L30 42M42 36L52 29M42 36L58 43" />
      <path className="pp-pad-dk" d="M92 40.5L76.6 37.6A17 5.5 0 1 1 79 42.2Z" />
      <path className="pp-pad" d="M92 39L76.6 36.1A17 5.5 0 1 1 79 40.7Z" />
      <g className="pp-lotus">
        <ellipse cx="96" cy="33" rx="3" ry="6.5" transform="rotate(-32 96 37)" />
        <ellipse cx="96" cy="33" rx="3" ry="6.5" transform="rotate(32 96 37)" />
        <ellipse cx="96" cy="32" rx="3.2" ry="7" />
      </g>
      <circle className="pp-lotus-c" cx="96" cy="36" r="2.2" />
      {/* Halloween only (seasonal.css): jack-o'-lanterns ride the pads in place of the lotus. */}
      <g className="season-only season-only--halloween">
        <JackOLantern x={95} y={31} s={0.78} />
        <JackOLantern x={61} y={33.6} s={0.5} />
      </g>
      <g className={cls('pp-frog', onFrogClick && 'pp-frog--egg', hop ? 'is-hopping' : undefined)} onClick={onFrogClick}>
        {/* Invisible, larger hit area: the frog itself is only ~12px wide on screen. */}
        {onFrogClick && <circle className="pp-frog-hit" cx="40" cy="27" r="22" />}
        <path className="pp-frog-b" d="M30 35Q28 22 40 21Q52 22 50 35Z" />
        <circle className="pp-frog-b" cx="34.4" cy="20.6" r="4.4" />
        <circle className="pp-frog-b" cx="45.6" cy="20.6" r="4.4" />
        <ellipse className="pp-belly" cx="40" cy="31" rx="6" ry="3.8" />
        <ellipse className="pp-foot" cx="33.5" cy="35" rx="3.6" ry="1.6" />
        <ellipse className="pp-foot" cx="46.5" cy="35" rx="3.6" ry="1.6" />
        <g className="pp-eyes">
          <circle className="pp-eye-w" cx="34.4" cy="20.2" r="2.8" />
          <circle className="pp-eye-w" cx="45.6" cy="20.2" r="2.8" />
          <circle className="pf-ink" cx="35" cy="20.4" r="1.4" />
          <circle className="pf-ink" cx="45" cy="20.4" r="1.4" />
        </g>
        <path className="pf-smile" d="M36 26.4q4 2.8 8 0" />
        <circle className="pf-cheek" cx="33.4" cy="26" r="1.8" />
        <circle className="pf-cheek" cx="46.6" cy="26" r="1.8" />
      </g>
    </Art>
  )
}

/** A floating duckling (asleep at night). viewBox 0 0 64 48; waterline y = 40. */
export function Duck({ className }: ArtProps) {
  return (
    <Art className={cls('pond-duck', className)} viewBox="0 0 64 48">
      <ellipse className="pond-ring" cx="32" cy="41" rx="15" ry="3" />
      <g className="pd-float">
        <path className="pd-body" d="M8 22Q12 27 19 26H40Q51 26 51 34Q50 41 40 41H22Q8 41 8 22Z" />
        <circle className="pd-body" cx="44" cy="18" r="8.5" />
        <path className="pd-beak" d="M51.5 16Q59 15.4 59 18.6Q57 21.6 51 21Z" />
        <path className="pd-wing" d="M21 30Q30 26 37 31Q33 37 25 35Q20 33 21 30Z" />
        <circle className="pd-eye-open pf-ink" cx="47" cy="16" r="1.5" />
        <path className="pd-eye-shut pf-smile" d="M45 16.6q2 1.6 4 0" />
        <circle className="pf-cheek" cx="48" cy="21" r="1.8" />
        <path className="pd-z" d="M54 3h5l-5 5h5M58 9h3l-3 3h3" />
      </g>
    </Art>
  )
}
