# EcoVerifier

A Next.js frontend for environmental company research, using OpenRouter directly from the browser. No separate audit backend or API routes are required.

## Run

```sh
npm install
npm run dev
```

Open http://localhost:3000, expand **OpenRouter settings**, enter your own [OpenRouter API key](https://openrouter.ai/settings/keys), and run a company audit. The default model is `openai/gpt-4.1-mini`; you can enter another OpenRouter model ID supporting JSON output and tools.

Manually entered keys stay in React memory and clear on reload. For personal local use, `.env.local` can set `NEXT_PUBLIC_OPENROUTER_API_KEY` to prefill the key. This file is gitignored, but the key is included in browser code: do not deploy a build containing your personal key publicly. Keys are never stored in report history or Firebase. Public deployments should let each user supply their own key. Requests consume the key owner's model and web-search credits.

Audits call `https://openrouter.ai/api/v1/chat/completions` with the [OpenRouter web search server tool](https://openrouter.ai/docs/guides/features/server-tools/web-search). Responses are validated before display. The browser computes GreenScore as `50 - 50 * mean(event impact)`, where impact is severity × credibility × recency × scope × confidence, with harmful events positive and beneficial events negative. This replaces the removed backend's scoring system. Sources and factors are AI assessments, not independently verified ESG ratings.

Anonymous reports and portfolios use local storage. Existing Google sign-in and signed-in history/portfolios still use Firebase as configured in `app/firebase.ts`.

## Checks

```sh
npx tsc --noEmit
npm run build
```

The older BACKEND_*, QUICK_START, STATUS_REPORT, and test-backend-connection.js files describe the retired Railway integration and are historical only.
