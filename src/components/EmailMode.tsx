import { useEffect, useRef, useState } from 'react'
import type { SampleRequest } from '../App'
import { LIMITS } from '../engine/config'
import type { Report } from '../engine'
import { loadEngine } from '../engineLoader'
import { SAMPLES } from '../samples'
import { formatBytes } from './Common'
import { IconUpload } from './Icons'
import { ResultsView, type View } from './ResultsView'

export function EmailMode({ initialInput = '', sample }: { initialInput?: string; sample: SampleRequest | null }) {
  const [input, setInput] = useState(initialInput)
  const [fileName, setFileName] = useState<string | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [view, setView] = useState<View>('analyst')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const run = async (source: string | Uint8Array) => {
    setError(null)
    if (typeof source === 'string' && !source.trim()) {
      setError('Paste the email source or choose an .eml file first.')
      setReport(null)
      return
    }
    setBusy(true)
    const { analyzeEmail, InputError } = await loadEngine()
    try {
      setReport(await analyzeEmail(source))
    } catch (e) {
      setReport(null)
      setError(e instanceof InputError ? e.message : 'Could not read that message. Is it the full raw source?')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    const s = sample && SAMPLES.find((x) => x.id === sample.id && x.mode === 'email')
    if (s) {
      setInput(s.content)
      setFileName(null)
      void run(s.content)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only when a new deep link arrives
  }, [sample?.key])

  const loadFile = async (file: File) => {
    if (file.size > LIMITS.maxEmailBytes) {
      setError(`That file is ${formatBytes(file.size)}; the limit is ${formatBytes(LIMITS.maxEmailBytes)}.`)
      return
    }
    setFileName(`${file.name} (${formatBytes(file.size)})`)
    setInput('')
    await run(new Uint8Array(await file.arrayBuffer()))
  }

  return (
    <div className="mode">
      <form
        className="input-card"
        onSubmit={(e) => {
          e.preventDefault()
          void run(input)
        }}
      >
        <label htmlFor="email-input" className="input-label">
          Paste the raw email source or headers
        </label>
        <p className="hint">
          Gmail: ⋮ → <em>Show original</em>. Outlook: … → <em>View</em> → <em>View message source</em>. Apple Mail: View →
          Message → <em>Raw Source</em>.
        </p>
        <div
          className={`dropzone${dragging ? ' dragging' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            const f = e.dataTransfer.files[0]
            if (f) void loadFile(f)
          }}
        >
          <textarea
            id="email-input"
            className="textarea textarea-mono"
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              setFileName(null)
            }}
            placeholder={'Delivered-To: you@example.com\nReceived: from …\nAuthentication-Results: …\nFrom: …'}
            rows={10}
            spellCheck={false}
            aria-describedby={error ? 'email-error' : undefined}
          />
          <div className="dropzone-bar">
            <IconUpload className="icon icon-sm" />
            <span>{fileName ? `Loaded ${fileName}` : 'Drop an .eml file here, or'}</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileInput.current?.click()}>
              Choose file
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".eml,message/rfc822,text/plain"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void loadFile(f)
                e.target.value = ''
              }}
            />
          </div>
        </div>
        {error && (
          <p id="email-error" className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="actions">
          <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
            {busy ? 'Analyzing…' : 'Analyze email'}
          </button>
          {(input || report || fileName) && (
            <button
              type="button"
              className="btn btn-secondary btn-lg"
              onClick={() => {
                setInput('')
                setReport(null)
                setError(null)
                setFileName(null)
              }}
            >
              Clear
            </button>
          )}
        </div>
        <div className="samples" role="group" aria-label="Try a sample email">
          <span className="samples-label">Try a sample:</span>
          {SAMPLES.filter((s) => s.mode === 'email').map((s) => (
            <button
              key={s.id}
              type="button"
              className="chip"
              title={s.title}
              onClick={() => {
                setInput(s.content)
                setFileName(null)
                void run(s.content)
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </form>
      <div aria-live="polite" className="sr-only">
        {report ? `Result: ${report.verdictLabel}` : ''}
      </div>
      {report && <ResultsView report={report} view={view} onViewChange={setView} />}
    </div>
  )
}
