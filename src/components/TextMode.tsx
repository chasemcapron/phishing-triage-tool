import { useEffect, useState } from 'react'
import type { SampleRequest } from '../App'
import { loadEngine } from '../engineLoader'
import { useReport } from '../online'
import { SAMPLES } from '../samples'
import { PrivacyNote } from './Common'
import { IconInfo } from './Icons'
import { ResultsView, type View } from './ResultsView'

const LOOKS_LIKE_EMAIL = /^(?:delivered-to|received|return-path|from|arc-seal|authentication-results|x-[\w-]+):\s/im

export function TextMode({ onSwitchToEmail, sample }: { onSwitchToEmail: (text: string) => void; sample: SampleRequest | null }) {
  const [input, setInput] = useState('')
  const { report, checking, focusKey, show } = useReport()
  const [view, setView] = useState<View>('simple')
  const [empty, setEmpty] = useState(false)

  const run = async (text: string) => {
    if (!text.trim()) {
      setEmpty(true)
      void show(null)
      return
    }
    setEmpty(false)
    const { analyzeText } = await loadEngine()
    void show(analyzeText(text))
  }

  useEffect(() => {
    const s = sample && SAMPLES.find((x) => x.id === sample.id && x.mode === 'text')
    if (s) {
      setInput(s.content)
      void run(s.content)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only when a new deep link arrives
  }, [sample?.key])

  const looksLikeEmail = LOOKS_LIKE_EMAIL.test(input.slice(0, 2000)) && /\n\S+:\s/.test(input)

  return (
    <div className="mode">
      <form
        className="input-card"
        onSubmit={(e) => {
          e.preventDefault()
          void run(input)
        }}
      >
        <label htmlFor="text-input" className="input-label">
          Paste a link or a whole text message
        </label>
        <textarea
          id="text-input"
          className="textarea textarea-lg"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={'e.g. "USPS: your package is on hold, confirm your address at usps-redelivery.example/track"'}
          rows={5}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-describedby={empty ? 'text-empty' : undefined}
        />
        {empty && (
          <p id="text-empty" className="form-error" role="alert">
            Paste a link or message first.
          </p>
        )}
        {looksLikeEmail && (
          <p className="notice">
            <IconInfo className="icon icon-sm" /> This looks like an email's source.{' '}
            <button type="button" className="link-btn" onClick={() => onSwitchToEmail(input)}>
              Analyze it as an email
            </button>{' '}
            for sender and authentication checks.
          </p>
        )}
        <div className="actions">
          <button type="submit" className="btn btn-primary btn-lg">
            Check it
          </button>
          {(input || report) && (
            <button
              type="button"
              className="btn btn-secondary btn-lg"
              onClick={() => {
                setInput('')
                void show(null)
                setEmpty(false)
              }}
            >
              Clear
            </button>
          )}
        </div>
        <div className="samples" role="group" aria-label="Try a sample">
          <span className="samples-label">Try a sample catch:</span>
          {SAMPLES.filter((s) => s.mode === 'text').map((s) => (
            <button
              key={s.id}
              type="button"
              className="chip"
              title={s.title}
              onClick={() => {
                setInput(s.content)
                void run(s.content)
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
        <PrivacyNote />
      </form>
      <div aria-live="polite" className="sr-only">
        {report ? `Result: ${report.verdictLabel}` : ''}
      </div>
      {report && <ResultsView report={report} view={view} onViewChange={setView} checking={checking} focusKey={focusKey} />}
    </div>
  )
}
