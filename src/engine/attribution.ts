// Google Safe Browsing attribution and "learn more" targets (kept tiny so UI code can import it
// without pulling in the whole engine).
export const GOOGLE_ATTRIBUTION = {
  text: 'Advisory provided by Google',
  href: 'https://developers.google.com/safe-browsing/v4/advisory',
  disclaimer:
    'Google works to provide the most accurate and up-to-date information about unsafe web resources. However, Google cannot guarantee that its information is comprehensive and error-free: some risky sites may not be identified, and some safe sites may be identified in error.',
}

export function learnMoreUrl(threatTypes: string[] = []): string {
  if (threatTypes.includes('SOCIAL_ENGINEERING')) return 'https://developers.google.com/search/docs/monitor-debug/security/social-engineering'
  if (threatTypes.includes('POTENTIALLY_HARMFUL_APPLICATION') && !threatTypes.includes('MALWARE')) {
    return 'https://developers.google.com/android/play-protect/potentially-harmful-applications'
  }
  return 'https://developers.google.com/search/docs/monitor-debug/security/malware'
}
