import { LIMITS } from '../config'
import type { FindingSet } from '../findings'
import type { Hop } from '../types'
import { isNonRoutable } from '../util/domain'

const hopName = (h: Hop) => `hop ${h.index + 1} (${h.from ?? '?'} → ${h.by ?? '?'})`

export function checkRelay(hops: Hop[], findings: FindingSet): void {
  for (const h of hops) {
    if (h.delaySeconds === null) continue
    if (h.delaySeconds < -LIMITS.clockSkewSeconds) {
      findings.add(
        'relay-out-of-order',
        'The delivery timestamps go backwards in time, which suggests some of the routing headers were faked.',
        `${hopName(h)} is ${formatDuration(-h.delaySeconds)} earlier than the hop before it`,
      )
    } else if (h.delaySeconds > LIMITS.bigDelaySeconds) {
      findings.add('relay-big-delay', 'The message sat on a server for a long time during delivery.', `${hopName(h)}: +${formatDuration(h.delaySeconds)}`)
    }
  }

  const boundary = hops.find((h) => h.isBoundary)
  if (boundary?.fromIp && boundary.ipClass && isNonRoutable(boundary.ipClass)) {
    findings.add(
      'relay-private-ip-boundary',
      'Your mail provider recorded the message arriving from a private network address, which cannot happen on the public internet; the header was likely forged.',
      `${hopName(boundary)}: ${boundary.fromIp} (${boundary.ipClass})`,
    )
  }
}

export function formatDuration(seconds: number): string {
  const s = Math.abs(seconds)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.round(s / 60)}m`
  if (s < 86400) return `${(s / 3600).toFixed(1).replace(/\.0$/, '')}h`
  return `${(s / 86400).toFixed(1).replace(/\.0$/, '')}d`
}
