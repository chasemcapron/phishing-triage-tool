// Page-level pond pieces: the fishing line that hangs the active card from the
// Fisher's rod tip, and the ambient underwater layer. All decorative (aria-hidden).
import { useEffect, useRef } from 'react'
import { FishSmall } from './art/Fish'
import { Bubbles, LightRays, SwimLane } from './art/Underwater'

/** What the line is hooked to: the verdict card once there is a result, otherwise the input card's top. */
const TARGETS = ['[role=tabpanel]:not([hidden]) .verdict', '.tabs']

/**
 * A positioned line from the rod tip (top-right corner of `.fisher-wrap`) straight down to a hook
 * on the target card. Geometry is measured with getBoundingClientRect and written as CSS custom
 * properties through the CSSOM (CSP-safe), throttled to one update per animation frame.
 */
export function FishingLine() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const line = ref.current
    const page = line?.parentElement
    if (!line || !page) return
    let raf = 0
    let hooked: HTMLElement | null = null
    const unhook = () => {
      hooked?.style.removeProperty('--hook-x')
      hooked?.style.removeProperty('--hooked')
      hooked = null
    }

    const update = () => {
      raf = 0
      const fisher = page.querySelector<HTMLElement>('.fisher-wrap')
      const bobber = page.querySelector<HTMLElement>('.fisher-bobber')
      let target: HTMLElement | null = null
      for (const sel of TARGETS) {
        target = page.querySelector<HTMLElement>(sel)
        if (target) break
      }
      if (!fisher || !target) return
      const p = page.getBoundingClientRect()
      const f = fisher.getBoundingClientRect()
      const t = target.getBoundingClientRect()
      const x = f.right - p.left
      const y = f.top - p.top
      const len = Math.max(0, t.top - f.top)
      // Waterline on the bobber is 75% down its box: below it the line is drawn lighter.
      const b = bobber?.getBoundingClientRect()
      const surf = b ? b.top + b.height * 0.75 - f.top : len * 0.3
      line.style.setProperty('--line-x', `${x.toFixed(1)}px`)
      line.style.setProperty('--line-y', `${y.toFixed(1)}px`)
      line.style.setProperty('--line-len', `${len.toFixed(1)}px`)
      line.style.setProperty('--line-surf', `${Math.max(0, surf).toFixed(1)}px`)
      line.dataset.ready = 'true'
      // A verdict card carries a .catch: the cord continues inside the card down to the fish's lip,
      // so the page-level hook is hidden and the hook position is measured against the catch.
      const anchor = target.querySelector<HTMLElement>('.catch') ?? target
      line.dataset.target = anchor === target ? 'card' : 'catch'
      if (hooked !== anchor) {
        unhook()
        hooked = anchor
      }
      anchor.style.setProperty('--hook-x', `${(f.right - anchor.getBoundingClientRect().left).toFixed(1)}px`)
      anchor.style.setProperty('--hooked', '1')
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }

    const ro = new ResizeObserver(schedule)
    ro.observe(page)
    const main = page.querySelector('main')
    const mo = new MutationObserver(schedule)
    if (main) mo.observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class'] })
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, { passive: true })
    page.addEventListener('animationend', schedule)
    void document.fonts?.ready.then(schedule)
    schedule()
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      mo.disconnect()
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule)
      page.removeEventListener('animationend', schedule)
      unhook()
    }
  }, [])

  return (
    <div ref={ref} className="fishing-line" aria-hidden="true">
      <span className="fishing-line__cord" />
      <svg className="fishing-hook" viewBox="0 0 24 36" aria-hidden="true" focusable="false">
        <circle className="fishing-hook__eye" cx="16" cy="4.5" r="3" />
        <path className="fishing-hook__metal" d="M16 7.5V26A5 5 0 0 1 6 26V20.5L9.4 23.6" />
        <path className="fishing-hook__shine" d="M17.4 11V22" />
      </svg>
    </div>
  )
}

/** Light rays, bubbles and a few small fish swimming behind the cards. */
export function PondAmbient() {
  return (
    <div className="pond-ambient" aria-hidden="true">
      <LightRays height="min(760px, 70%)" />
      <Bubbles count={12} seed={0} />
      <SwimLane top={96} duration={46} delay={-30} direction="rtl" scale={0.85} glow className="lane">
        <FishSmall variant={2} className="school-fish" />
      </SwimLane>
      <SwimLane top={128} duration={52} delay={-8} direction="rtl" scale={0.6} glow className="lane">
        <FishSmall variant={4} className="school-fish" />
      </SwimLane>
      <SwimLane top={430} duration={38} delay={-20} scale={1} glow className="lane">
        <FishSmall variant={1} className="school-fish" />
      </SwimLane>
      <SwimLane top="58%" duration={60} delay={-40} direction="rtl" scale={1.2} glow className="lane">
        <FishSmall variant={3} className="school-fish" />
      </SwimLane>
      <SwimLane top="74%" duration={44} delay={-5} scale={0.8} glow className="lane">
        <FishSmall variant={2} className="school-fish" />
      </SwimLane>
      <SwimLane top="88%" duration={56} delay={-26} direction="rtl" scale={0.9} glow className="lane">
        <FishSmall variant={4} className="school-fish" />
      </SwimLane>
    </div>
  )
}
