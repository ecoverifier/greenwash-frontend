# EcoVerifier

Environmental company research in one Next.js app. The frontend calls its own `/api/audit` route, which calls OpenRouter with a private server-side key. No separate backend deployment is needed.

## Run locally

Set `OPENROUTER_API_KEY` in `.env.local` (see `.env.example`), then run:

```sh
npm install
npm run dev
```

Open http://localhost:3000 and enter a company name. No API key or model settings are shown to visitors. Optionally set `OPENROUTER_MODEL` (default: `openai/gpt-4.1-mini`). The model must support JSON output and tools.

## Production

Deploy this repository as a Next.js app on a host supporting Node.js route handlers and at least 150-second function durations. Set `OPENROUTER_API_KEY` as a secret in the host's production environment; optionally set `OPENROUTER_MODEL`. Use `npm run build` and `npm start` for a Node.js deployment. Static-only hosting is not supported.

Remove any old `NEXT_PUBLIC_OPENROUTER_API_KEY` deployment variable and rebuild. The API key must never be included in browser code. `.env.local` is ignored by Git and does not automatically configure your deployment host.

The public audit endpoint consumes your OpenRouter credits. Configure your hosting provider's rate limits/bot protection and an OpenRouter key spending cap before opening it to unrestricted public traffic. Origin checks restrict cross-origin browser requests but do not authenticate callers or prevent direct API usage.

Audits use the [OpenRouter web search server tool](https://openrouter.ai/docs/guides/features/server-tools/web-search). The server validates responses and computes GreenScore as `50 - 50 * mean(event impact)`, where impact is severity × credibility × recency × scope × confidence, with harmful events positive and beneficial events negative. Sources and factors are AI assessments, not independently verified ESG ratings.

Anonymous reports and portfolios use local storage. Google sign-in and signed-in history/portfolios use the existing Firebase configuration in `app/firebase.ts`. Add your production domain to Firebase Authentication's authorized domains and configure Firestore rules for your deployment.

## Checks

```sh
npx tsc --noEmit
npm run build
```

The older BACKEND_*, QUICK_START, STATUS_REPORT, and test-backend-connection.js files describe the retired Railway integration and are historical only.
