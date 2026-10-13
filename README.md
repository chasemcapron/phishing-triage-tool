# Phishing Triage Tool

Paste a suspicious link, text message or email and get an explainable phishing verdict.

> Work in progress. Full README lands in Milestone 5.

## Local development

```sh
npm install
npm run dev        # frontend only
npx vercel dev     # frontend + /api functions
npm test           # engine unit tests against every sample
```

Copy `.env.example` to `.env.local` for API keys. Never commit real keys.
