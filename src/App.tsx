import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { EmailMode } from './components/EmailMode'
import { Bobber, Duck, Fisher, LilyPads, LogoMark, SkyBackdrop } from './components/art/PondScene'
import { SeasonSky } from './components/art/Seasonal'
import { PondFloor } from './components/art/Underwater'
import { IconMoon, IconSun } from './components/Icons'
import { FishingLine, PondAmbient } from './components/Pond'
import { SeasonPicker } from './components/SeasonPicker'
import { TextMode } from './components/TextMode'
import { loadEngine } from './engineLoader'
import { SAMPLES } from './samples'
import { initialSeasonChoice, resolveSeason, saveSeasonChoice, type SeasonChoice } from './season'

type Mode = 'text' | 'email'

/**
 * Email analysis is paused: real-world mail (gateways, forwarding, mailing lists) still produced
 * too many false alarms. The engine, UI and tests stay in the repo; set this to true to bring
 * the tab back.
 */
const EMAIL_ENABLED = false
const MODES: readonly (readonly [Mode, string])[] = EMAIL_ENABLED
  ? [
      ['text', 'Check a link or text'],
      ['email', 'Analyze an email'],
    ]
  : [['text', 'Check a link or text']]
type Theme = 'dark' | 'light'

export interface SampleRequest {
  id: string
  key: number
}

/** "#email", "#text", or a deep link to a sample such as "#email/m365-credential-phish". */
function parseHash(): { mode: Mode; sample: SampleRequest | null } {
  const [, m, id] = /^#(text|email)(?:\/([\w-]+))?$/.exec(window.location.hash) ?? []
  const mode: Mode = m === 'email' && EMAIL_ENABLED ? 'email' : 'text'
  const sample = SAMPLES.find((s) => s.id === id && s.mode === mode)
  return { mode, sample: sample ? { id: sample.id, key: Date.now() } : null }
}

function readTheme(): Theme {
  try {
    // Day (light) is the default; only an explicit saved choice turns on night fishing.
    return localStorage.getItem('theme') === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export default function App() {
  const [initial] = useState(parseHash)
  const [mode, setMode] = useState<Mode>(initial.mode)
  const [sample, setSample] = useState<SampleRequest | null>(initial.sample)
  const [theme, setTheme] = useState<Theme>(readTheme)
  const [seasonChoice, setSeasonChoice] = useState<SeasonChoice>(() => initialSeasonChoice())
  const season = resolveSeason(seasonChoice)
  const [handoff, setHandoff] = useState<{ text: string; key: number } | null>(null)
  const tabRefs = useRef<Record<Mode, HTMLButtonElement | null>>({ text: null, email: null })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('theme', theme)
    } catch {
      /* storage unavailable: theme just won't persist */
    }
  }, [theme])

  // Before paint, so the seasonal palette never flashes in after the default one.
  useLayoutEffect(() => {
    const root = document.documentElement
    if (season === 'none') delete root.dataset.season
    else root.dataset.season = season
  }, [season])

  const pickSeason = (c: SeasonChoice) => {
    setSeasonChoice(c)
    saveSeasonChoice(c)
    // A ?season= link only sets the starting look; an explicit pick replaces it.
    const url = new URL(window.location.href)
    if (url.searchParams.has('season')) {
      url.searchParams.delete('season')
      history.replaceState(null, '', url.pathname + url.search + url.hash)
    }
  }

  // Easter egg: tap the frog to swap back to the original pond, and again to bring the season back.
  const [frogHop, setFrogHop] = useState(0)
  const onFrog = () => {
    pickSeason(season === 'none' ? 'auto' : 'none')
    setFrogHop((n) => n + 1)
  }
  useEffect(() => {
    if (!frogHop) return
    const t = setTimeout(() => setFrogHop(0), 500)
    return () => clearTimeout(t)
  }, [frogHop])

  // Start fetching the engine right after first paint.
  useEffect(() => {
    void loadEngine()
  }, [])

  useEffect(() => {
    const onHash = () => {
      const next = parseHash()
      setMode(next.mode)
      if (next.sample) setSample(next.sample)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const select = (m: Mode, focus = false) => {
    setMode(m)
    history.replaceState(null, '', m === 'email' ? '#email' : '#text')
    if (focus) tabRefs.current[m]?.focus()
  }

  const onTabKey = (e: KeyboardEvent) => {
    if (EMAIL_ENABLED && (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'Home' || e.key === 'End')) {
      e.preventDefault()
      const next: Mode = e.key === 'Home' ? 'text' : e.key === 'End' ? 'email' : mode === 'text' ? 'email' : 'text'
      select(next, true)
    }
  }

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="pond-page">
        <div className="sky">
          <SkyBackdrop />
          <SeasonSky season={season} />
          <header className="site-header">
            <div className="container header-inner">
              <SeasonPicker choice={seasonChoice} season={season} onChange={pickSeason} />
              <button
                type="button"
                className="btn btn-icon theme-toggle"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                aria-label={theme === 'dark' ? 'Switch to day fishing (light theme)' : 'Switch to night fishing (dark theme)'}
              >
                {theme === 'dark' ? <IconSun /> : <IconMoon />}
              </button>
            </div>
          </header>
          <div className="container hero">
            <h1 className="hero-title">Gone Phishing</h1>
            <p className="hero-sub">Is this a scam?</p>
            <p className="lede">
              Paste a suspicious link or text message <strong>before you tap it</strong>. Cast it in and see what bites.
            </p>
          </div>
          <LilyPads className="sky-lily" onFrogClick={onFrog} hop={frogHop > 0} />
          <Duck className="sky-duck" />
          <div className="fisher-wrap">
            <Fisher />
            <Bobber className="fisher-bobber" />
          </div>
        </div>

        <FishingLine />

        <main id="main" className="pond water-column">
          <PondAmbient />
          <div className="container pond-content">
            <div className={MODES.length > 1 ? 'tabs' : 'tabs tabs-single'} role="tablist" aria-label="What do you want to check?" onKeyDown={onTabKey}>
              {MODES.map(([m, label]) => (
                <button
                  key={m}
                  ref={(el) => {
                    tabRefs.current[m] = el
                  }}
                  id={`tab-${m}`}
                  role="tab"
                  type="button"
                  aria-selected={mode === m}
                  aria-controls={`panel-${m}`}
                  tabIndex={mode === m ? 0 : -1}
                  className="tab"
                  onClick={() => select(m)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div id="panel-text" role="tabpanel" aria-labelledby="tab-text" hidden={mode !== 'text'}>
              <TextMode
                sample={sample}
                onSwitchToEmail={
                  EMAIL_ENABLED
                    ? (text) => {
                        setHandoff({ text, key: Date.now() })
                        select('email')
                      }
                    : undefined
                }
              />
            </div>
            {EMAIL_ENABLED && (
              <div id="panel-email" role="tabpanel" aria-labelledby="tab-email" hidden={mode !== 'email'}>
                <EmailMode key={handoff?.key ?? 0} initialInput={handoff?.text ?? ''} sample={handoff ? null : sample} />
              </div>
            )}
          </div>
        </main>

        <PondFloor className="pond-floor">
          <footer className="site-footer">
            <p className="footer-brand">
              <LogoMark className="footer-logo" />
              <span>Gone Phishing</span>
            </p>
            <p>
              Verdicts are advisory. "No red flags found" means none of our checks matched, not that something is
              guaranteed legitimate. All sample messages are synthetic.
            </p>
            <p>
              <a href="https://github.com/chasemcapron/phishing-triage-tool" rel="noreferrer">
                Source on GitHub
              </a>
            </p>
          </footer>
        </PondFloor>
      </div>
    </>
  )
}
