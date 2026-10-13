import { useEffect, useRef } from 'react'
import type { Report } from '../engine'
import { AttachmentsTable, AuthTable, LinksTable, RelayTimeline, SenderSummary } from './Analyst'
import { Segmented } from './Common'
import { FindingsList, LinkList, VerdictCard, WhatToDo } from './Results'

export type View = 'simple' | 'analyst'

export function ResultsView({ report, view, onViewChange }: { report: Report; view: View; onViewChange: (v: View) => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  // Move focus to the verdict after each analysis so screen readers and keyboard users land on it.
  useEffect(() => {
    headingRef.current?.focus()
  }, [report])

  const analyst = view === 'analyst'
  const wide = analyst && !!report.email
  return (
    <div className={wide ? 'results results-wide' : 'results'}>
      <div className="results-bar">
        <Segmented
          label="Detail level"
          value={view}
          onChange={onViewChange}
          options={[
            { value: 'simple', label: 'Simple' },
            { value: 'analyst', label: 'Analyst' },
          ]}
        />
      </div>
      <div className={wide ? 'results-grid' : 'results-stack'}>
        <div className="results-main">
          <VerdictCard ref={headingRef} report={report} analyst={analyst} />
          <WhatToDo report={report} />
          {analyst ? (
            <section className="panel" aria-labelledby="findings-heading">
              <h2 id="findings-heading">Findings ({report.findings.length})</h2>
              <FindingsList findings={report.findings} />
            </section>
          ) : (
            !report.email && <LinkList report={report} />
          )}
          {analyst && !report.email && <LinksTable links={report.links} />}
        </div>
        {analyst && report.email && (
          <div className="results-side">
            <SenderSummary email={report.email} />
            <AuthTable email={report.email} />
            <RelayTimeline hops={report.email.hops} />
          </div>
        )}
      </div>
      {analyst && report.email && (
        <>
          <LinksTable links={report.links} />
          <AttachmentsTable email={report.email} />
        </>
      )}
    </div>
  )
}
