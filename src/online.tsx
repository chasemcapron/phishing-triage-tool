import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Report } from './engine'
import { loadEngine } from './engineLoader'

const KEY = 'onlineChecks'
const CACHE_MS = 5 * 60_000

/** Lookup responses by request, so re-running a sample doesn't spend the rate limit again. */
const responses = new Map<string, { at: number; res: Awaited<ReturnType<Awaited<ReturnType<typeof loadEngine>>['fetchLookup']>> }>()

interface OnlineState {
  online: boolean
  setOnline: (v: boolean) => void
}

const OnlineContext = createContext<OnlineState>({ online: true, setOnline: () => {} })

function readPref(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

/** Remembers whether reputation lookups are on (default on; the brief asks for a visible off switch). */
export function OnlineProvider({ children }: { children: ReactNode }) {
  const [online, setOnlineState] = useState(readPref)
  const setOnline = useCallback((v: boolean) => {
    setOnlineState(v)
    try {
      localStorage.setItem(KEY, v ? 'on' : 'off')
    } catch {
      /* preference just won't persist */
    }
  }, [])
  return <OnlineContext.Provider value={{ online, setOnline }}>{children}</OnlineContext.Provider>
}

export const useOnline = () => useContext(OnlineContext)

/**
 * Holds the current report. `show(local)` displays the local verdict immediately, then (when
 * online checks are on) sends only links/domains/hashes to /api/lookup and swaps in the
 * reputation-enriched report. A newer analysis cancels any lookup still in flight.
 */
export function useReport() {
  const { online } = useOnline()
  const [report, setReport] = useState<Report | null>(null)
  const [checking, setChecking] = useState(false)
  const [focusKey, setFocusKey] = useState(0)
  const [firstLabel, setFirstLabel] = useState<string | null>(null)
  const ctrl = useRef<AbortController | null>(null)
  useEffect(() => () => ctrl.current?.abort(), [])

  const show = useCallback(
    async (local: Report | null) => {
      ctrl.current?.abort()
      ctrl.current = null
      setChecking(false)
      setReport(local)
      setFirstLabel(local?.verdictLabel ?? null)
      if (!local) return
      setFocusKey((k) => k + 1)
      const eng = await loadEngine()
      if (!online) {
        setReport({ ...local, reputation: eng.offReputation('off') })
        return
      }
      const req = eng.buildLookupRequest(local)
      if (eng.isEmptyRequest(req)) return
      const c = new AbortController()
      ctrl.current = c
      setChecking(true)
      try {
        const key = JSON.stringify(req)
        const hit = responses.get(key)
        const res = hit && Date.now() - hit.at < CACHE_MS ? hit.res : await eng.fetchLookup(req, { signal: c.signal })
        if (!hit || hit.res !== res) responses.set(key, { at: Date.now(), res })
        if (!c.signal.aborted) setReport(eng.applyReputation(local, res, req))
      } catch (e) {
        if (!c.signal.aborted) {
          setReport({ ...local, reputation: eng.offReputation('failed', e instanceof eng.LookupError ? e.message : 'Online checks are unavailable right now.') })
        }
      } finally {
        if (ctrl.current === c) {
          ctrl.current = null
          setChecking(false)
        }
      }
    },
    [online],
  )

  // Focus moves to the verdict heading, which reads the first verdict aloud. The live region
  // only speaks when online checks change it afterwards, so nothing is announced twice.
  const announcement = report && firstLabel && report.verdictLabel !== firstLabel ? `Online checks changed the result: ${report.verdictLabel}` : ''
  return { report, checking, focusKey, show, announcement }
}
