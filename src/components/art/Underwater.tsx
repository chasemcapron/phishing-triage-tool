/*
 * Underwater world: Bubbles, LightRays, Seaweed, PondFloor, SwimLane.
 * All decorative (aria-hidden). Colours are CSS custom properties in
 * underwater.css (day on :root, night on :root[data-theme='dark']); motion is
 * CSS-only and off under prefers-reduced-motion. Water backgrounds are classes:
 * .water-shallow -> .water-mid -> .water-deep (or one .water-column).
 */
import type { CSSProperties, ReactNode } from 'react'
import './underwater.css'

type Vars = CSSProperties & Record<`--${string}`, string | number>
type Len = number | string
type Pt = [number, number]

const len = (v: Len) => (typeof v === 'number' ? `${v}px` : v)
const r1 = (n: number) => Math.round(n * 10) / 10
const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ')

// [left %, size px, rise s, delay s, wobble px, resting height 0..1]
const BUBBLES = [
  [5, 16, 13, -2, 7, 0.72], [12, 9, 10, -7, 5, 0.34], [19, 22, 17, -11, 9, 0.55], [27, 12, 12, -4, 6, 0.16],
  [34, 8, 9, -6, 4, 0.84], [42, 18, 18, -14, 8, 0.42], [50, 10, 11, -3, 5, 0.63], [58, 24, 20, -9, 10, 0.26],
  [65, 9, 10, -8, 5, 0.9], [72, 16, 15, -1, 7, 0.48], [79, 11, 13, -10, 6, 0.1], [86, 20, 17, -5, 9, 0.68],
  [92, 9, 9, -2, 4, 0.3], [95, 14, 14, -12, 6, 0.58], [38, 7, 8, -5, 4, 0.05], [69, 8, 9, -6, 4, 0.77],
] as const

/** Rising bubbles filling the positioned parent. Use a different `seed` per instance. */
export function Bubbles({ count = 14, speed = 1, seed = 0, className }: { count?: number; speed?: number; seed?: number; className?: string }) {
  const n = Math.max(0, Math.min(BUBBLES.length, Math.round(count)))
  return (
    <div className={cx('uw-bubbles', className)} aria-hidden="true" style={{ '--bubble-speed': speed } as Vars}>
      {BUBBLES.slice(0, n).map(([x, size, dur, delay, drift, rest], i) => (
        <span
          key={i}
          className="uw-bubble"
          style={{
            '--x': `${r1((x + seed * 23) % 97)}%`, '--size': `${size}px`, '--dur': `${dur}s`,
            '--delay': `${r1(delay - seed * 1.7)}s`, '--drift': `${drift}px`, '--rest': r1(((rest + seed * 0.37) % 1) * 100) / 100,
          } as Vars}
        >
          <span className="uw-bubble__dot" />
        </span>
      ))}
    </div>
  )
}

// [left %, width %, strength 0..1, shimmer s, delay s]
const RAYS = [[2, 8, 0.9, 7, -1], [15, 4, 0.55, 9, -4], [25, 10, 0.8, 8, -2], [42, 5, 0.5, 10, -6], [54, 9, 0.85, 7.5, -3], [69, 4, 0.5, 9.5, -5], [79, 11, 0.75, 8.5, -7]] as const

/** Soft sunbeams (faint moonbeams at night) fading down from the parent's top. angle > 0: light from the upper right (where the sun is). */
export function LightRays({ height = '100%', angle = 14, className }: { height?: Len; angle?: number; className?: string }) {
  return (
    <div className={cx('uw-rays', className)} aria-hidden="true" style={{ '--rays-height': len(height), '--rays-angle': `${angle}deg` } as Vars}>
      {RAYS.map(([x, w, o, dur, delay], i) => (
        <span key={i} className="uw-ray" style={{ '--x': `${x}%`, '--w': `${w}%`, '--o': o, '--dur': `${dur}s`, '--delay': `${delay}s` } as Vars} />
      ))}
    </div>
  )
}

/** Smooth Catmull-Rom curve through the points, as cubic Bezier path data. */
function curve(p: Pt[]): string {
  let d = `M${r1(p[0]![0])} ${r1(p[0]![1])}`
  for (let i = 0; i < p.length - 1; i++) {
    const [a, b, c] = [p[i - 1] ?? p[i]!, p[i]!, p[i + 1]!]
    const e = p[i + 2] ?? c
    d += `C${r1(b[0] + (c[0] - a[0]) / 6)} ${r1(b[1] + (c[1] - a[1]) / 6)} ${r1(c[0] - (e[0] - b[0]) / 6)} ${r1(c[1] - (e[1] - b[1]) / 6)} ${r1(c[0])} ${r1(c[1])}`
  }
  return d
}

/** A wavy kelp ribbon growing up from y = 300: [outline, centre vein]. */
function frond(x0: number, h: number, w: number, amp: number, waves: number, lean: number, ph: number): [string, string] {
  const mid: Pt[] = []
  const l: Pt[] = []
  const r: Pt[] = []
  for (let k = 0; k <= 14; k++) {
    const t = k / 14
    const x = x0 + lean * t + amp * Math.sin(ph + t * waves * Math.PI * 2) * Math.min(1, t * 2.4)
    const hw = w * (1 - 0.78 * t ** 1.5) * (0.88 + 0.2 * Math.sin(ph * 1.7 + t * 10))
    mid.push([x, 300 - t * h])
    l.push([x - hw, 300 - t * h])
    r.push([x + hw, 300 - t * h])
  }
  const top = mid[14]!
  return [`${curve([...l, [top[0] + 1, top[1] - w * 0.7], ...r.reverse()])}Z`, curve(mid.slice(1, 13))]
}

// x0, height, width, amplitude, waves, lean, phase, back?, sway s, delay s
const FRONDS = (
  [
    [34, 248, 9, 10, 1.5, -10, 0, 1, 6.2, -1],
    [74, 286, 10, 12, 1.8, 8, 1.2, 1, 7.4, -3],
    [55, 200, 11, 11, 1.35, 12, 2.4, 0, 5.6, -2],
    [100, 158, 10, 9, 1.15, 14, 0.6, 0, 6.8, -4],
    [22, 122, 8, 6, 1, -6, 1.8, 0, 5.2, -0.5],
  ] as const
).map(([x0, h, w, amp, waves, lean, ph, back, dur, delay]) => {
  const [d, vein] = frond(x0, h, w, amp, waves, lean, ph)
  // oxlint-disable-next-line typescript/no-unnecessary-type-assertion -- false positive: without the cast tsc rejects the custom properties in style (TS2559)
  return { d, vein, back: back === 1, style: { '--sway-dur': `${dur}s`, '--sway-delay': `${delay}s` } as Vars }
})

/** Swaying seaweed on two rocks, pinned to the bottom-left/right of the positioned parent. */
export function Seaweed({ side = 'left', height = 220, offset = '2%', className }: { side?: 'left' | 'right'; height?: Len; offset?: Len; className?: string }) {
  return (
    <svg
      className={cx('uw-seaweed', `uw-seaweed--${side}`, className)}
      viewBox="-16 0 162 300"
      aria-hidden="true"
      focusable="false"
      style={{ '--seaweed-height': len(height), '--seaweed-offset': len(offset) } as Vars}
    >
      {FRONDS.map((f, i) => (
        <g key={i} className={cx('uw-frond', f.back && 'uw-frond--back')} style={f.style}>
          <path className="uw-frond__blade" d={f.d} />
          <path className="uw-frond__vein" d={f.vein} />
        </g>
      ))}
      <path className="uw-rock" d="M4 300C2 284 18 272 38 273S74 286 72 300Z" />
      <path className="uw-rock uw-rock--2" d="M66 300C66 288 80 281 96 282S122 292 120 300Z" />
      <ellipse className="uw-rock__shine" cx="26" cy="281" rx="9" ry="3.2" />
      <ellipse className="uw-rock__shine" cx="88" cy="288" rx="6.5" ry="2.4" />
    </svg>
  )
}

function Item({ name, box, children }: { name: string; box: string; children: ReactNode }) {
  return (
    <svg className={`uw-floor__item uw-${name}`} viewBox={box} aria-hidden="true" focusable="false">
      {children}
    </svg>
  )
}

const Boot = () => (
  <Item name="boot" box="0 0 160 150">
    <g transform="rotate(-11 85 130)">
      <path className="uw-sprout" d="M46 42C37 28 46 15 41 3 55 13 55 28 55 42Z" />
      <path className="uw-sprout uw-sprout--2" d="M60 42C62 28 74 23 77 10 82 25 73 34 69 44Z" />
      <path className="uw-boot__body" d="M37 46H83Q87 46 87 50V88Q89 96 103 100L124 106Q140 111 140 122V127H34V49Q34 46 37 46Z" />
      <path className="uw-boot__shade" d="M110 102L124 106Q140 111 140 122V127H115Q117 112 110 102Z" />
      <path className="uw-boot__shine" d="M118 109Q130 111 134 119" />
      <path className="uw-boot__cuff" d="M30 42Q30 36 36 36H85Q91 36 91 42V55H30Z" />
      <path className="uw-boot__shine" d="M38 44H64" />
      <rect className="uw-boot__patch" x="42" y="70" width="22" height="20" rx="3" />
      <rect className="uw-boot__stitch" x="45.5" y="73.5" width="15" height="13" rx="1.5" />
      <path className="uw-boot__lace" d="M78 62L90 68M78 74L91 80M81 86L95 93" />
      <path className="uw-boot__eyelet" d="M78 62h0M78 74h0M81 86h0" />
      <path className="uw-boot__hole" d="M104 125H140Q148 128 153 139Q144 134 130 134Q114 133 104 125Z" />
      <path className="uw-boot__sole" d="M30 124H105Q117 132 132 133Q146 134 153 140Q151 145 144 145Q128 142 113 141Q104 139 99 135H35Q30 135 30 130Z" />
    </g>
    <path className="uw-floor__mound" d="M0 136C22 127 50 131 80 138S132 141 160 146V150H0Z" />
  </Item>
)

const Crab = () => (
  <Item name="crab" box="0 0 64 50">
    <path className="uw-crab__legs" d="M18 36L8 41M20 38L11 46M24 40L19 48M46 36L56 41M44 38L53 46M40 40L45 48M14 32L8 21M50 32L56 21M27 26L25 13M37 26L39 13" />
    <path className="uw-crab__claw" d="M8 18L13.9 16.9A6 6 0 1 1 10 12.4Z" />
    <path className="uw-crab__claw uw-crab__claw--wave" d="M56 18L50.1 16.9A6 6 0 1 0 54 12.4Z" />
    <path className="uw-crab__body" d="M11 35C11 20 53 20 53 35C53 42 11 42 11 35Z" />
    <path className="uw-crab__blush" d="M20 34h0M44 34h0" />
    <path className="uw-crab__smile" d="M28 33Q32 37 36 33" />
    <g className="uw-crab__eyes">
      <circle className="uw-eye" cx="25" cy="11" r="4.6" />
      <circle className="uw-eye" cx="39" cy="11" r="4.6" />
      <circle className="uw-pupil" cx="26" cy="11.5" r="2.1" />
      <circle className="uw-pupil" cx="40" cy="11.5" r="2.1" />
    </g>
  </Item>
)

const Scallop = () => (
  <Item name="scallop" box="0 0 48 42">
    <path className="uw-scallop__hinge" d="M17 33H31L29 40H19Z" />
    <path className="uw-scallop__shell" d="M24 36C14 32 4 22 5 14Q6 6 14 5Q19 1 24 4Q29 1 34 5Q42 6 43 14C44 22 34 32 24 36Z" />
    <path className="uw-scallop__ridge" d="M24 34L11 11M24 34L17 6M24 34V5M24 34L31 6M24 34L37 11" />
  </Item>
)

const Snail = () => (
  <Item name="snail" box="0 0 56 36">
    <ellipse className="uw-floor__shadow" cx="29" cy="32.5" rx="22" ry="3" />
    <path className="uw-snail__shell" d="M7 21C6 12 15 6 26 8L50 16Q54 18 50 20L29 30C19 33 8 30 7 21Z" />
    <path className="uw-snail__swirl" d="M25 9C29 15 29 24 27 30M35 11.5C38 16 38 22 36 26M43 14C45 17 45 20 44 22" />
    <ellipse className="uw-snail__mouth" cx="14" cy="20.5" rx="5.5" ry="7" />
  </Item>
)

const Bottle = () => (
  <Item name="bottle" box="0 0 84 46">
    <g transform="rotate(-7 42 30)">
      <rect className="uw-bottle__cork" x="68" y="17" width="10" height="12" rx="2.5" />
      <rect className="uw-bottle__glass" x="54" y="15" width="17" height="16" rx="4" />
      <rect className="uw-bottle__glass" x="6" y="8" width="56" height="30" rx="14" />
      <rect className="uw-bottle__note" x="17" y="16" width="30" height="14" rx="6" />
      <path className="uw-bottle__tie" d="M32 16V30" />
      <path className="uw-bottle__shine" d="M16 13H44M60 19H66" />
    </g>
    <path className="uw-floor__mound" d="M0 38C20 31 52 33 84 39V46H0Z" />
  </Item>
)

const Pebbles = ({ n }: { n: 1 | 3 }) => (
  <Item name={`pebbles uw-pebbles--${n}`} box="0 0 80 30">
    <ellipse className="uw-pebble uw-pebble--1" cx="19" cy="22" rx="15" ry="8.5" />
    <ellipse className="uw-pebble uw-pebble--2" cx="41" cy="24.5" rx="9" ry="5.5" />
    <ellipse className="uw-pebble uw-pebble--3" cx="61" cy="23" rx="12" ry="7" />
    <ellipse className="uw-pebble__shine" cx="13" cy="17.5" rx="5" ry="2" />
    <ellipse className="uw-pebble__shine" cx="56" cy="19" rx="4" ry="1.6" />
  </Item>
)

/**
 * Full-bleed pond bottom: deepest-water band, wavy sand edge with a sunken boot,
 * crab, message in a bottle, shells, pebbles and (seaweed={false} to drop) two
 * seaweed clusters rising over the section above; then calm solid sand where
 * `children` (the footer) render. Use var(--sand-ink) / var(--sand-ink-muted) there.
 */
export function PondFloor({ children, seaweed = true, className }: { children?: ReactNode; seaweed?: boolean; className?: string }) {
  return (
    <div className={cx('uw-floor', className)}>
      {seaweed && (
        <div className="uw-floor__weeds" aria-hidden="true">
          <Seaweed side="left" height={240} offset="0.5%" className="uw-floor__weed--l" />
          <Seaweed side="right" height={190} offset="1%" className="uw-floor__weed--r" />
        </div>
      )}
      <div className="uw-floor__bed" aria-hidden="true">
        <svg className="uw-floor__edge" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <path className="uw-floor__dune-back" d="M0 52C160 28 300 30 460 46S760 70 920 46 1240 20 1440 42V120H0Z" />
          <path className="uw-floor__dune" d="M0 84C200 62 360 66 540 80S860 98 1060 78 1320 60 1440 72V120H0Z" />
        </svg>
        <div className="uw-floor__sand" />
        <Boot />
        <Crab />
        <Pebbles n={1} />
        <Bottle />
        <Scallop />
        <Pebbles n={3} />
        <Snail />
      </div>
      <div className="uw-floor__content">{children}</div>
    </div>
  )
}

type SwimLaneProps = {
  children: ReactNode
  duration?: number
  delay?: number
  top?: Len
  direction?: 'ltr' | 'rtl'
  scale?: number
  faces?: 'right' | 'left'
  bob?: boolean
  glow?: boolean
  rest?: number
  className?: string
}

/**
 * Carries its children across the full width of its positioned parent, forever:
 * they enter fully off one edge and leave fully off the other. Children face
 * right (or say faces="left"); 'rtl' mirrors the lane. Negative `delay` starts
 * mid-swim. Reduced motion: they rest `rest` % across (default: where the delay puts them).
 */
export function SwimLane({ children, duration = 40, delay = 0, top = '50%', direction = 'ltr', scale = 1, faces = 'right', bob = true, glow = false, rest, className }: SwimLaneProps) {
  const progress = duration > 0 ? (((-delay % duration) + duration) % duration) / duration : 0.5
  const bobDur = 2.6 + (((duration * 7 + Math.abs(delay) * 3) % 10) / 10) * 1.6
  return (
    <div
      className={cx('uw-lane', `uw-lane--${direction}`, faces === 'left' && 'uw-lane--faces-left', bob && 'uw-lane--bob', glow && 'uw-lane--glow', className)}
      aria-hidden="true"
      style={{
        '--swim-dur': `${duration}s`, '--swim-delay': `${delay}s`, '--swim-top': len(top), '--swim-scale': scale,
        '--swim-rest': `${r1(rest ?? 12 + progress * 76)}%`, '--swim-bob-dur': `${r1(bobDur)}s`,
      } as Vars}
    >
      <div className="uw-lane__track">
        <div className="uw-lane__body">
          <div className="uw-lane__bob">
            <div className="uw-lane__face">{children}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
