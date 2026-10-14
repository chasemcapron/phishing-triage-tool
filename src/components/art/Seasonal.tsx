/*
 * Gone Phishing: seasonal overlays (original flat-cartoon SVG, colours in ./seasonal.css).
 * All decorative: aria-hidden, pointer-events none. The sky overlay sits inside `.sky`
 * above the SkyBackdrop and below the hero text, fisher and header, so it never covers
 * anything readable. Particle timings are CSS custom properties set through React's style
 * prop (CSSOM, CSP-safe; same approach as the catch in Results.tsx).
 */
import { useEffect, useRef, type CSSProperties } from 'react'
import type { Verdict } from '../../engine'
import type { Season } from '../../season'
import './seasonal.css'

const hidden = { 'aria-hidden': true, focusable: false } as const

/* ---------- Particles ---------- */

// [x %, duration s, delay s, sway px, resting y % (reduced motion), scale, shape, colour]
// Resting heights stay above the title or below the lede, so still particles never sit behind text.
type P = readonly [number, number, number, number, number, number, number, number]
const LEAVES: P[] = [
  [3, 15, -2, 26, 8, 1, 0, 0], [11, 19, -11, -22, 72, 0.85, 1, 1], [19, 17, -6, 30, 80, 1.1, 2, 2],
  [27, 21, -15, -18, 12, 0.8, 0, 3], [36, 16, -9, 24, 5, 0.9, 1, 0], [47, 20, -3, -28, 86, 1, 2, 1],
  [58, 18, -13, 20, 10, 0.85, 0, 2], [66, 22, -7, -24, 76, 1.05, 1, 3], [74, 17, -16, 28, 14, 0.9, 2, 0],
  [83, 19, -4, -20, 70, 1, 0, 1], [90, 16, -10, 22, 6, 0.8, 1, 2], [97, 21, -18, -26, 84, 0.95, 2, 3],
]
const FLAKES: P[] = [
  [2, 14, -3, 14, 10, 1, 0, 0], [8, 18, -12, -12, 74, 0.7, 0, 0], [14, 16, -7, 16, 4, 0.9, 1, 0],
  [21, 20, -16, -14, 82, 0.6, 0, 0], [27, 15, -2, 12, 13, 1.1, 0, 0], [33, 19, -10, -16, 70, 0.75, 1, 0],
  [40, 17, -14, 14, 88, 0.9, 0, 0], [46, 21, -5, -12, 7, 0.65, 0, 0], [53, 16, -11, 16, 76, 1, 1, 0],
  [59, 18, -1, -14, 11, 0.8, 0, 0], [65, 15, -8, 12, 84, 0.7, 0, 0], [71, 20, -17, -16, 6, 1.05, 1, 0],
  [77, 17, -4, 14, 72, 0.75, 0, 0], [83, 19, -13, -12, 14, 0.9, 0, 0], [89, 16, -9, 16, 78, 0.65, 1, 0],
  [95, 21, -6, -14, 9, 1, 0, 0], [98, 18, -15, 12, 90, 0.8, 0, 0], [37, 22, -19, -10, 68, 0.6, 0, 0],
]

const LEAF_SHAPES = [
  // maple-ish
  'M0-9L2.2-4.6L7-6.6L5.4-1.4L9.4 1L4.6 3L5.6 7.4L0.6 5.4V9.4H-0.6V5.4L-5.6 7.4L-4.6 3L-9.4 1L-5.4-1.4L-7-6.6L-2.2-4.6Z',
  // long oval leaf
  'M0-9.5Q7-3 0 9.5Q-7-3 0-9.5Z',
  // round birch leaf
  'M0-8C5-8 7.4-2.6 6.2 2C5 6.4 2 8.6 0 9.4C-2 8.6-5 6.4-6.2 2C-7.4-2.6-5-8 0-8Z',
]
const FLAKE_STAR = 'M0-8V8M-6.9-4L6.9 4M-6.9 4L6.9-4'
const LEAF_VEIN = ['M0-5V8', 'M0-7V8', 'M0-5.5V8.4']

function Particle({ p, i, kind }: { p: P; i: number; kind: 'leaf' | 'flake' }) {
  const [x, d, dl, sway, rest, scale, shape, colour] = p
  const vars = {
    '--x': `${x}%`,
    '--d': `${d}s`,
    '--dl': `${dl}s`,
    '--sway': `${sway}px`,
    '--rest': `${rest}cqh`,
    '--s': scale,
    '--spin': `${i % 2 ? -1 : 1}turn`,
  } as CSSProperties
  return (
    <span className={`season-p season-${kind}`} style={vars}>
      {kind === 'leaf' ? (
        <svg viewBox="-10 -10 20 20" {...hidden} className={`season-leaf--c${colour}`}>
          <path className="sl-body" d={LEAF_SHAPES[shape]} />
          <path className="sl-vein" d={LEAF_VEIN[shape]} />
        </svg>
      ) : (
        <svg viewBox="-10 -10 20 20" {...hidden}>
          {shape ? (
            <>
              <path className="sf-star-edge" d={FLAKE_STAR} />
              <path className="sf-star" d={FLAKE_STAR} />
            </>
          ) : (
            <circle className="sf-dot" r="5" />
          )}
        </svg>
      )}
    </span>
  )
}

/* ---------- Halloween ---------- */

function Bat({ className }: { className: string }) {
  return (
    <svg className={`season-bat ${className}`} viewBox="-24 -14 48 26" {...hidden}>
      <path className="sb-wing sb-wing--l" d="M-3-2Q-9-11-22-8Q-18-4-19 1Q-15-1-12 3Q-9-1-5 3Z" />
      <path className="sb-wing sb-wing--r" d="M3-2Q9-11 22-8Q18-4 19 1Q15-1 12 3Q9-1 5 3Z" />
      <path className="sb-body" d="M-3.6-8.6L-2.8-13L-1-9.4Q0-9.8 1-9.4L2.8-13L3.6-8.6Q4.6-6.6 4.2-4Q5 2 0 6Q-5 2-4.2-4Q-4.6-6.6-3.6-8.6Z" />
      <circle className="sb-eye" cx="-1.5" cy="-6.6" r="0.9" />
      <circle className="sb-eye" cx="1.5" cy="-6.6" r="0.9" />
    </svg>
  )
}

/** A pale moon for the daytime sky (at night the scene's own moon turns into the harvest moon). */
function DayMoon() {
  return (
    <svg className="season-daymoon" viewBox="0 0 60 60" {...hidden}>
      <circle className="sdm-glow" cx="30" cy="30" r="28" />
      <circle className="sdm-disc" cx="30" cy="30" r="20" />
      <circle className="sdm-crater" cx="24" cy="25" r="4" />
      <circle className="sdm-crater" cx="36" cy="36" r="5" />
      <circle className="sdm-crater" cx="35" cy="21" r="2.2" />
    </svg>
  )
}

/** A jack-o'-lantern, centred on (0, 0), about 20 units across. Used on the lily pads and the dock. */
export function JackOLantern({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g className="season-jack" transform={`translate(${x} ${y}) scale(${s})`}>
      <circle className="sj-glow" r="15" />
      <path className="sj-stem" d="M-1.2-7.6Q-1.6-11 1.4-12.6L2.6-11.2Q0.6-10 1.2-7.6Z" />
      <ellipse className="sj-rind-dk" cx="-5" cy="0.4" rx="6" ry="8" />
      <ellipse className="sj-rind-dk" cx="5" cy="0.4" rx="6" ry="8" />
      <ellipse className="sj-rind" cx="0" cy="0" rx="6.4" ry="8.4" />
      <path className="sj-rib" d="M-3.2-6.6Q-5 0-3.2 7M3.2-6.6Q5 0 3.2 7" />
      <path className="sj-face" d="M-6.2-2.4L-3.6-5.4L-1.6-2.2ZM6.2-2.4L3.6-5.4L1.6-2.2ZM-6.6 1.6Q0 3.4 6.6 1.6Q5.6 6 0 6.8Q-5.6 6-6.6 1.6Z" />
      <path className="sj-tooth" d="M-2.6 2.4H-0.6V4.4H-2.6ZM1.2 2.5H3.2V4.2H1.2Z" />
    </g>
  )
}

/* ---------- Hats for the verdict fish ---------- */

// Where the hat sits on each fish, in that fish's viewBox units: brim centre, tilt, scale.
const HAT_AT: Record<Verdict, [number, number, number, number]> = {
  high: [108, 34, 8, 1],
  suspicious: [70, 25, -6, 1],
  none: [58, 25, -12, 0.95],
}

/** Both hats are drawn; seasonal.css shows the one for the current season (or neither). */
export function SeasonHat({ verdict }: { verdict: Verdict }) {
  const [x, y, r, s] = HAT_AT[verdict]
  return (
    <g className="season-hat" transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <g className="season-hat__witch">
        <ellipse className="sh-brim-dk" cx="0" cy="1.4" rx="24" ry="5.4" />
        <ellipse className="sh-brim" cx="0" cy="0" rx="24" ry="5.4" />
        <path className="sh-cone" d="M-12.5-1.5Q-8-18-1-30Q5-41 19-40Q11-36 8.5-28Q6-16 12.5-1.5Q0-4-12.5-1.5Z" />
        <path className="sh-cone-hi" d="M-8.5-6Q-5-18 1-27.5Q-2-17-3-5.4Z" />
        <path className="sh-band" d="M-11.6-6Q0-9.4 11.2-6L12.4-1.6Q0-4.6-12.6-1.6Z" />
        <rect className="sh-buckle" x="-3.4" y="-8.6" width="6.8" height="6.2" rx="1.2" />
        <rect className="sh-buckle-in" x="-1.4" y="-6.8" width="2.8" height="2.6" rx="0.6" />
      </g>
      <g className="season-hat__santa" transform="translate(0 2)">
        <path className="sh-red" d="M-14-3Q-12-22 2-29Q16-34 27-20Q22-21 17-18Q12-13 14-3Q0-6-14-3Z" />
        <path className="sh-red-dk" d="M17-18Q22-21 27-20Q24-24 19-25Q18-22 15-15Z" />
        <rect className="sh-fur-dk" x="-16.5" y="-6" width="33" height="10" rx="5" />
        <rect className="sh-fur" x="-16.5" y="-7" width="33" height="9.6" rx="4.8" />
        <circle className="sh-fur" cx="27" cy="-19.5" r="5.4" />
        <circle className="sh-fur-dk" cx="28.4" cy="-18" r="2.6" />
      </g>
    </g>
  )
}

/* ---------- Sky overlay ---------- */

/** Pauses the overlay's animations while the sky is scrolled out of view. */
function usePauseOffscreen() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => el.classList.toggle('is-paused', !e?.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return ref
}

export function SeasonSky({ season }: { season: Season }) {
  const ref = usePauseOffscreen()
  if (season === 'none') return null
  return (
    <div ref={ref} className={`season-sky season-sky--${season}`} aria-hidden="true">
      {season === 'halloween' && (
        <>
          <DayMoon />
          <Bat className="season-bat--1" />
          <Bat className="season-bat--2" />
          <Bat className="season-bat--3" />
        </>
      )}
      {season === 'fall' && (
        <>
          {LEAVES.map((p, i) => (
            <Particle key={i} p={p} i={i} kind="leaf" />
          ))}
          <svg className="season-floaters" viewBox="0 0 240 20" preserveAspectRatio="xMidYMax meet" {...hidden}>
            <g transform="translate(40 12) rotate(70) scale(0.7)" className="season-leaf--c0">
              <path className="sl-body" d={LEAF_SHAPES[0]} />
            </g>
            <g transform="translate(150 14) rotate(-40) scale(0.6)" className="season-leaf--c1">
              <path className="sl-body" d={LEAF_SHAPES[1]} />
            </g>
            <g transform="translate(205 11) rotate(20) scale(0.65)" className="season-leaf--c2">
              <path className="sl-body" d={LEAF_SHAPES[2]} />
            </g>
          </svg>
        </>
      )}
      {season === 'winter' &&
        FLAKES.map((p, i) => <Particle key={i} p={p} i={i} kind="flake" />)}
    </div>
  )
}
