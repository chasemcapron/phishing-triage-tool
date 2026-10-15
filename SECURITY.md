# Security policy

Gone Phishing is a portfolio project, but security reports are welcome and taken seriously.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting: the **Security** tab of this repository, then
**Report a vulnerability**. Don't open a public issue for anything exploitable.

Include what you found, how to reproduce it, and what an attacker could do with it. I'll reply
within a week and credit you in the fix unless you'd rather not be named.

## In scope

- The live site (https://gonefishing-app.vercel.app) and its `/api/lookup` endpoint
- Anything that lets someone spend the API quotas from another site, read the API keys,
  make the server fetch an arbitrary URL, or inject script or markup through pasted input
- Ways to make a known-bad link come back "No red flags" when a provider has flagged it

## Out of scope

- Detection misses and false positives for links nobody has flagged yet: the heuristics have
  documented limits (see the README's Limitations section). These are welcome as ordinary issues.
- Rate limits being approximate across server instances (documented)
- Load or denial-of-service testing against the live site; please don't
