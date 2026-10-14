// Original flat-cartoon fish for Gone Phishing. Purely decorative: every SVG is
// aria-hidden and unfocusable. Colors live in fish.css as custom properties
// (day on :root, night on :root[data-theme='dark']); shapes only carry classes.
import { useId, type ReactNode } from 'react'
import type { Verdict } from '../../engine'
import './fish.css'

type ArtProps = { className?: string; sash?: boolean }

const useClip = () => 'fish-clip' + useId().replace(/[^\w-]/g, '')

function Svg({ kind, box, className, children }: { kind: string; box: string; className?: string; children: ReactNode }) {
  return (
    <svg className={`fish ${kind}${className ? ` ${className}` : ''}`} viewBox={box} aria-hidden="true" focusable="false">
      {children}
    </svg>
  )
}

/** Big cartoon eye; optional `lid` is a circle-segment path drawn over its top (grumpy / side-eye). */
function Eye({ cx, cy, r, px, py, pr, lid }: { cx: number; cy: number; r: number; px: number; py: number; pr: number; lid?: string }) {
  return (
    <g className="fish-eyeball">
      <circle className="fish-eye" cx={cx} cy={cy} r={r} />
      <circle className="fish-pupil" cx={px} cy={py} r={pr} />
      <circle className="fish-shine" cx={px - pr * 0.38} cy={py - pr * 0.42} r={pr * 0.36} />
      <circle className="fish-shine" cx={px + pr * 0.42} cy={py + pr * 0.4} r={pr * 0.15} />
      {lid && <path className="fish-lid" d={lid} />}
    </g>
  )
}

/**
 * The band painted around each verdict fish's body, in its viewBox units: centre, height, tilt,
 * and the width the verdict text may use. Results.tsx lays the text over it from these numbers.
 */
export const SASH: Record<Verdict, { box: [number, number]; cx: number; cy: number; h: number; rot: number; text: number }> = {
  high: { box: [160, 136], cx: 99, cy: 100, h: 30, rot: -9, text: 80 },
  suspicious: { box: [150, 130], cx: 72, cy: 95, h: 26, rot: -6, text: 70 },
  none: { box: [150, 124], cx: 70, cy: 87, h: 22, rot: -5, text: 76 },
}

/** Drawn inside the body clip, so the band follows the fish's outline. */
function Sash({ verdict }: { verdict: Verdict }) {
  const { cx, cy, h, rot } = SASH[verdict]
  const x = cx - 120
  return (
    <g className="fish-sash" transform={`rotate(${rot} ${cx} ${cy})`}>
      <rect className="fish-sash__band" x={x} y={cy - h / 2} width={240} height={h} />
      <path className="fish-sash__stitch" d={`M${x} ${cy - h / 2 + 2.4}h240M${x} ${cy + h / 2 - 2.4}h240`} />
    </g>
  )
}

/* ---------- High risk: the grumpy anglerfish "phish" (faces left) ---------- */
const PHISH_BODY = 'M42 79C44 52 68 36 96 36c26 0 46 20 46 44s-20 40-46 40c-22 0-44-3-56-12-7-5-10-12-8-18 1-4 6-9 10-11z'

export function FishPhish({ className, sash }: ArtProps) {
  const clip = useClip()
  return (
    <Svg kind="fish-phish fish-verdict" box="0 0 160 136" className={className}>
      <g className="fish-lure-glow">
        <circle cx="40" cy="28" r="19" />
        <circle cx="40" cy="28" r="13" />
      </g>
      <path className="fish-shade fish-tail" d="M134 80c8-14 16-24 24-26 3 10 1 19-5 26 6 7 8 16 5 26-8-2-16-12-24-26z" />
      <path className="fish-shade" d="M96 39l7-15 6 11 7-9 4 12 6-4-2 12z" />
      <path className="fish-snag" d="M27 84c-3-6 2-9-1-15-1-3-4-3-4-1" />
      <circle className="fish-hook-eye" cx="27" cy="86" r="2.4" />
      <path className="fish-hook" d="M27 88.5V104c0 8 12 8 12 0v-3" />
      <clipPath id={clip}>
        <path d={PHISH_BODY} />
      </clipPath>
      <path className="fish-body" d={PHISH_BODY} />
      <g clipPath={`url(#${clip})`}>
        <path className="fish-belly" d="M20 110c40 12 84 10 126-16v40H20z" />
        <circle className="fish-spot" cx="106" cy="50" r="3.6" />
        <circle className="fish-spot" cx="120" cy="58" r="2.6" />
        <circle className="fish-spot" cx="116" cy="44" r="2" />
        <circle className="fish-spot" cx="130" cy="72" r="2.2" />
        {sash && <Sash verdict="high" />}
      </g>
      <path className="fish-hi" d="M110 41c11 3 21 11 26 22" />
      <path className="fish-mouth" d="M41 81c15 3 31 9 47 18-18-2-36-5-54-9 2-4 4-7 7-9z" />
      <path className="fish-accent" d="M33 90c19 3 37 6 55 9-16 5-36 4-54-3z" />
      <path className="fish-tooth" d="M39 91q2-5 4-10.5 2 5.5 4 11.5zM53 93.4q1.6-4 3.5-8 1.8 4 3.4 9z" />
      <path className="fish-line fish-ray" d="M95 66c5 8 5 18 0 26" />
      <g className="fish-fin">
        <path className="fish-shade" d="M104 86c8-10 22-8 24 2-4 8-16 10-24 4z" />
        <path className="fish-line fish-ray" d="M110 87l12-2M110 90l11 2" />
      </g>
      <Eye cx={74} cy={62} r={14} px={68.5} py={65} pr={6.5} lid="M60.6 58A14 14 0 0 1 83.8 52z" />
      <path className="fish-brow" d="M58 52.5l28-9" />
      <path className="fish-stalk" d="M88 38c-2-20-26-30-48-22v4" />
      <g className="fish-lure">
        <rect className="fish-envelope" x="28" y="20" width="24" height="17" rx="3.5" />
        <path className="fish-flap" d="M30 22.5l10 7.5 10-7.5" />
      </g>
    </Svg>
  )
}

/* ---------- Suspicious: side-eyeing pufferfish (faces left) ---------- */
const PUFF = { cx: 72, cy: 68, r: 44 }
const SPINES = [-158, -136, -114, -92, -70, -48, -28, 30, 50, 72, 94, 116, 138, 160]
  .map((deg) => {
    const { cx, cy, r } = PUFF
    const pt = (a: number, d: number) => `${(cx + d * Math.cos(a)).toFixed(1)} ${(cy + d * Math.sin(a)).toFixed(1)}`
    const a = (deg * Math.PI) / 180
    return `M${pt(a - 0.11, r - 3)}L${pt(a, r + 9)}L${pt(a + 0.11, r - 3)}z`
  })
  .join('')
const PUFF_BODY = 'M28 68a44 44 0 1 0 88 0a44 44 0 1 0-88 0z'

export function FishPuffer({ className, sash }: ArtProps) {
  const clip = useClip()
  return (
    <Svg kind="fish-puffer fish-verdict" box="0 0 150 130" className={className}>
      <path className="fish-shade fish-tail" d="M112 68c8-10 16-16 24-16 2 8 0 14-4 16 4 2 6 8 4 16-8 0-16-6-24-16z" />
      <g className="fish-puff">
        <path className="fish-spine" d={SPINES} />
        <clipPath id={clip}>
          <path d={PUFF_BODY} />
        </clipPath>
        <path className="fish-body" d={PUFF_BODY} />
        <g clipPath={`url(#${clip})`}>
          <path className="fish-belly" d="M20 78c16 14 34 20 52 20s38-6 52-20v50H20z" />
          <circle className="fish-spot" cx="60" cy="34" r="3" />
          <circle className="fish-spot" cx="80" cy="29" r="2.4" />
          <circle className="fish-spot" cx="96" cy="40" r="3.2" />
          <circle className="fish-spot" cx="104" cy="58" r="2.2" />
          <circle className="fish-spot" cx="90" cy="54" r="1.8" />
          <path className="fish-under" d="M28 68a44 44 0 0 0 88 0c0 21.5-19.7 39-44 39s-44-17.5-44-39z" />
          {sash && <Sash verdict="suspicious" />}
        </g>
        <path className="fish-hi" d="M38 46c5-9 13-15 22-18" />
        <g className="fish-fin">
          <path className="fish-shade" d="M84 80c8-8 20-6 22 2-4 8-14 8-22 4z" />
          <path className="fish-line fish-ray" d="M90 81l11-1M90 84l10 2" />
        </g>
        <Eye cx={44} cy={58} r={11} px={49} py={61} pr={5} lid="M33 57A11 11 0 0 1 55 55.6z" />
        <Eye cx={70} cy={54} r={12.5} px={76} py={57.5} pr={5.6} lid="M57.5 53.6A12.5 12.5 0 0 1 82.5 52z" />
        <path className="fish-brow" d="M33 43.5q6-1 12 1M60 37q8-6 17-2" />
        <ellipse className="fish-accent" cx="36" cy="83" rx="6.5" ry="4.6" />
        <path className="fish-line" d="M31 83.5q5-2.2 10 .6" />
      </g>
    </Svg>
  )
}

/* ---------- No red flags: calm, curious round fish (faces left) ---------- */
const CALM_BODY = 'M24 62c0-26 22-42 48-42s44 18 44 42-18 42-44 42-48-16-48-42z'

export function FishCalm({ className, sash }: ArtProps) {
  const clip = useClip()
  return (
    <Svg kind="fish-calm fish-verdict" box="0 0 150 124" className={className}>
      <path className="fish-shade fish-tail" d="M110 62c10-12 20-20 30-20 4 10 2 16-4 20 6 4 8 12 4 22-10 0-20-10-30-22z" />
      <path className="fish-shade" d="M50 26c6-14 28-18 42-10 6 4 8 10 8 16z" />
      <path className="fish-shade" d="M60 100c4 12 16 16 24 10-2-6-6-10-10-10z" />
      <clipPath id={clip}>
        <path d={CALM_BODY} />
      </clipPath>
      <path className="fish-body" d={CALM_BODY} />
      <g clipPath={`url(#${clip})`}>
        <path className="fish-belly" d="M16 76c18 14 36 18 56 18s34-6 46-16v40H16z" />
        <path className="fish-stripe" d="M74 14c10 26 10 66 0 96h9c10-30 10-70 0-96zM98 14c8 26 8 66 0 96h7c8-30 8-70 0-96z" />
        <path className="fish-under" d="M116 62c0 24-18 42-44 42s-48-16-48-42c0 22 22 37 48 37s44-17 44-37z" />
        {sash && <Sash verdict="none" />}
      </g>
      <ellipse className="fish-body" cx="25.5" cy="72" rx="4.6" ry="5.4" />
      <ellipse className="fish-mouth" cx="24.6" cy="72" rx="2" ry="3" />
      <ellipse className="fish-cheek" cx="52" cy="73" rx="6" ry="3.4" />
      <g className="fish-fin">
        <path className="fish-shade" d="M80 70c8-8 20-6 22 2-4 8-14 8-22 4z" />
        <path className="fish-line fish-ray" d="M86 71l11-1M86 74l10 2" />
      </g>
      <g className="fish-blink">
        <Eye cx={47} cy={52} r={15} px={43} py={53} pr={8} />
      </g>
      <path className="fish-brow" d="M38 32q8-4 16-1" />
      <g className="fish-bubbles">
        <circle className="fish-bubble" cx="18" cy="58" r="3.4" />
        <circle className="fish-bubble" cx="11" cy="45" r="2.4" />
      </g>
    </Svg>
  )
}

/* ---------- Ambient school fish (faces right; flip with .fish--flip) ---------- */
const SMALL_BODY = 'M8 15C8 8 18 4 28 4s18 5 18 11-8 11-18 11S8 22 8 15z'

export function FishSmall({ className, variant = 1 }: ArtProps & { variant?: 1 | 2 | 3 | 4 }) {
  const clip = useClip()
  return (
    <Svg kind={`fish-small fish-small--${variant}`} box="0 0 48 30" className={className}>
      <path className="fish-shade fish-tail" d="M12 15C8 10 4 6 1 6c1 4 2 7 3 9-1 2-2 5-3 9 3 0 7-4 11-9z" />
      <path className="fish-shade" d="M21 5.5c2-4.5 10-5 13-1.5z" />
      <clipPath id={clip}>
        <path d={SMALL_BODY} />
      </clipPath>
      <path className="fish-body" d={SMALL_BODY} />
      <g clipPath={`url(#${clip})`}>
        <path className="fish-belly" d="M4 19c10 4 26 5 44-1v12H4z" />
        <path className="fish-stripe" d="M25 2c3 8 3 18 0 26h4c3-8 3-18 0-26z" />
      </g>
      <circle className="fish-eye" cx="37.5" cy="13" r="3.8" />
      <circle className="fish-pupil" cx="38.6" cy="13.4" r="2.1" />
      <circle className="fish-shine" cx="37.9" cy="12.5" r=".8" />
      <path className="fish-line" d="M42.6 18.6q1.6 1 2.8-.6" />
    </Svg>
  )
}

/** The verdict card's mascot: high → FishPhish, suspicious → FishPuffer, none → FishCalm. */
export function VerdictFish({ verdict, className, sash }: { verdict: Verdict; className?: string; sash?: boolean }) {
  if (verdict === 'high') return <FishPhish className={className} sash={sash} />
  if (verdict === 'suspicious') return <FishPuffer className={className} sash={sash} />
  return <FishCalm className={className} sash={sash} />
}
