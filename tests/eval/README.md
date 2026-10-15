# Detection evaluation

How well the offline engine (`analyzeText` in `src/engine`) tells scam texts from legitimate
ones, with confidence intervals, plus a regression guard.

```sh
npm run eval                                   # prints the metrics tables (the guards also run in npm test)
TRANCO_CSV=top-1m.csv npm run eval             # adds the false-positive sweep over real popular sites
```

## Results (2026-10-15, offline engine)

| Set | Scams flagged | Scams rated High | False positives |
| --- | --- | --- | --- |
| Holdout (69 scams, 66 legitimate) | **38/69, 55%** (95% CI 43–66%) | 12/69, 17% | **2/66, 3%** (CI 1–10%) |
| ...scams with a web link | 30/48, 63% | | |
| ...scams without a link | 8/21, 38% | | |
| Red team, development (32 / 20) | 24/32, 75% | 8/32, 25% | 0/20 |
| Tranco list N26LW, bare links | | | **0** of the top 10,000; **33/10,000 (0.33%)** of ranks 10,001–20,000 |

The holdout's first run (at freeze, 2026-10-14) gave 38/69 flagged and 4/66 false positives. The two
false positives fixed since then were fixed by brand-list changes driven by the Tranco sweep, not by
reading this set's texts, and no detection rule was tuned to this set's misses. Its weakest areas are
job offers (0/5), wrong-number openers (1/5) and family emergencies (0/2): conversation scams with no
link and nothing yet to check. In the app, online checks (domain age above all) add to these numbers
for links; they can't help a message with no link.

## What is measured

- **Flagged:** the verdict is Suspicious or High. **High:** the verdict is High.
- **False positive:** a legitimate text that comes back Suspicious or High.
- **Offline engine only.** No Safe Browsing, VirusTotal, URLhaus or domain-age lookups: they
  need the network and API keys, and their results change from day to day. In the app they can
  only add warnings, so these numbers are a floor for links that are already on a blocklist or
  were registered recently. Smishing domains are often hours old, so that floor is the realistic case.
- **95% confidence intervals** are Wilson score intervals, which behave well for small samples
  and for rates near 0% or 100%.

## The two sets

| Set | File | Scams | Legitimate | Role |
| --- | --- | --- | --- | --- |
| Holdout | `holdout.ts` | 69 | 66 | Independent test set: frozen before its first run, not used for tuning |
| Red team | `redteam.ts` | 32 | 20 | Earlier set written while the engine was being tuned; development numbers, expect them to be optimistic |

The holdout set's SHA-256 at freeze time was
`c7a73eba221f959de1da574bbfb8cd088f3897777d82de0537746d1e29ec5eba`.

## How the holdout set was built

- **Scams** (69) follow the US text-scam types of 2024–2026: unpaid tolls, package delivery,
  bank and payment-app fraud alerts, account lock and verify, tax and government (IRS, DMV, SSA,
  jury duty, Medicare), job and task offers, wrong-number and pig-butchering openers, fake stores,
  prizes, romance and gift cards, family emergencies, one-time-code relay, callback and refund
  scams, crypto, lookalikes of popular sites (Dropbox, Steam, Discord, Canva), link shorteners and
  evasion tricks. The mix leans on the categories the FTC lists as the most reported text scams
  (delivery problems, job offers, fake fraud alerts, unpaid tolls and "wrong number" texts). About
  a third have no link at all, as many conversation scams do. Wording follows the shape of
  published campaign texts, for example the 2025 "DMV Final Notice: Enforcement Penalties Begin"
  wave, the "reply Y, then reopen the message to activate the link" toll and USPS texts, and the
  `brand.com-xxxx.top` domains of smishing kits.
- **Legitimate** (66) messages copy the real formats people get: one-time codes (WhatsApp,
  Instagram, Uber, Amazon, PayPal, Bank of America, Discord, TikTok, Venmo), deliveries and
  orders on the carriers' and stores' real domains, bank and bill alerts (some with a callback
  number, as real ones have), appointments and pharmacies, school and city notices, retail
  marketing, friends sharing YouTube, Maps, Spotify, Instagram, Google Docs, Airbnb, Zoom and
  TikTok links, and personal chat that mentions Venmo, codes or gift cards.
- **Hard negatives**, by design: popular sites on other endings (`amazon.ca`, `google.ca`,
  `apple.news`, `spotify.link`) and real sites one letter from popular ones (`stripes.com`,
  `metlife.com`). Retail marketing through a third-party SMS link service is included because
  that is how many brands really send offers.
- **Hygiene:** every phone number is a fictional 555-01xx number (a test checks this). Scam
  domains are invented: `.example` and `.test` stand in for ordinary `.com` names, and real
  abused endings (`.top`, `.xin`, `.vip`, `.icu`, `.cfd`, `.shop`) are kept where the ending is part
  of the pattern. No real person's messages or data are used.

## Known biases

- **The author knew the engine.** The holdout set was written by a reviewer who had read the
  detection code, which can tilt scams toward catchable wording and legitimate texts toward
  safe wording. Mitigations: wording modeled on published campaigns and real service templates,
  weak categories (job, wrong-number, family, crypto) kept at a realistic share, hard negatives
  included on purpose, and the set frozen (hash above) before the first run. A set written by
  someone who has not seen the code would be a stronger test.
- **Synthetic, single author, English only, US only.** Real traffic is messier: typos, emoji,
  other languages, MMS images, QR codes.
- **The mix sets the headline.** The overall rate depends on the category proportions, which
  are a judgment call. Read the per-category table, and the with-link / without-link split.
- **Small samples.** With about 70 scams, the 95% interval is roughly ±12 points.
- **Tuning spends the holdout.** Once engine changes are made to fix this set's misses, its
  numbers turn into development numbers. Write a fresh holdout before quoting new ones.

## Regression guard

`eval.test.ts` fails if the number of flagged scams drops below the floor, or the number of
false positives rises above the ceiling, recorded from the last measured run. Raise the floors
when detection improves.
