# QZORO

QZORO is an account-scoped XAUUSD chart-review desk. Upload a chart screenshot and the desk returns an objective read, a trade plan with entry / stop / targets, the position size that fits your account, and the daily limits that decide whether the plan is allowed at all. Every cleared plan can be logged and closed into a journal that shows the truth about your consistency.

> QZORO is an analysis and record-keeping tool, not financial advice. Prices are read from a screenshot and can be wrong. You are responsible for every order you place.

## Stack

- **Next.js 16** App Router with Cache Components.
- **Supabase Auth** for invite-only email/password accounts.
- **Supabase Postgres** for settings, analyses, and the ledger, with row-level security scoped to `auth.uid()`.
- **Supabase Storage** for private chart screenshots.
- **Vercel** for hosting. No local SQLite or persistent local disk is required.

## What it does

- **Reads the chart** — structure, bias, support/resistance, setup quality, and an explicit "no trade" answer when there is no edge.
- **Prices the risk** — deterministic XAUUSD lot sizing from the stop distance, contract size, spread, and commission.
- **Protects the day** — daily loss cap, weekly loss cap, trade-count cap, consecutive-loss stop, and an open-risk ceiling. A locked desk refuses new cleared tickets.
- **Keeps the ledger** — log a cleared plan, close it with an outcome, override the lot size if you traded differently, and let the server recompute risk, P&L, and R.
- **Audits behaviour** — win rate, expectancy in R, profit factor, drawdown, plan adherence, daily bars, and a consistency score built from risk discipline rather than profit.
- **Works without a provider key** — the sample review is a complete worked example. It cannot be logged.

Vision providers: Google Gemini, OpenAI, Anthropic Claude, and OpenCode Go (DeepSeek V4.1 Flash). The model only reads the chart and returns structured levels; all sizing, R:R, and limit checks happen in deterministic server code.

## Requirements

- **Node.js 20.9 or newer** (Node 24 recommended).
- npm.
- A Supabase project.
- A Vercel project for hosted use.

## 1. Install

```bash
npm install
```

## 2. Configure Supabase

Copy `.env.example` to `.env.local` and fill it in:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
APP_ENCRYPTION_KEY=...
```

Generate the encryption key with:

```bash
openssl rand -base64 32
```

On Windows, or if `openssl` is unavailable:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

`APP_ENCRYPTION_KEY` is server-only and encrypts provider API keys with AES-256-GCM before they are stored. Keep it stable: rotating it makes existing stored keys unreadable.

Apply [`supabase/migrations/20261117000000_qzoro_production.sql`](./supabase/migrations/20261117000000_qzoro_production.sql) with the Supabase CLI or the SQL editor:

```bash
npx supabase init          # only if supabase/config.toml does not exist yet
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

See [`supabase/README.md`](./supabase/README.md) for the full setup, Storage bucket, RLS, and Vercel checklist.

## 3. Create users

QZORO has **no public sign-up page**. Accounts are created by the desk owner in Supabase:

1. Open **Authentication → Users → Add user**.
2. Enter the user's email and password.
3. Enable **Auto Confirm User**.
4. Disable public sign-ups under **Authentication → Sign In / Providers → Email**.

Each user gets an isolated journal, settings row, provider keys, and chart folder.

## 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You will be redirected to `/login` until you authenticate.

To try the full flow without a provider key: **Chart review → Run sample review**. The sample ticket is marked `SAMPLE` and its logging controls are disabled.

## Deploy to Vercel

Add these environment variables in **Vercel → Project → Settings → Environment Variables**:

| Variable | Scope | Required |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Yes |
| `APP_ENCRYPTION_KEY` | Server | Yes |
| `GEMINI_API_KEY` / `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `OPENCODE_GO_API_KEY` | Server | Optional fallback |
| `PROVIDER_TIMEOUT_MS` | Server | Optional per-call timeout, default `55000` (capped by `ANALYSIS_BUDGET_MS`) |
| `ANALYSIS_BUDGET_MS` | Server | Optional total analysis budget, default `50000` |
| `DESK_TIMEZONE` | Server | Optional IANA timezone, default `UTC` |

Do not add the Supabase service-role key to the app. The app uses the signed-in user's JWT and RLS for every query.

Production limits:

- The browser compresses charts to **4 MB**, below Vercel's 4.5 MB request-body limit.
- The analyze route sets `maxDuration = 60` for Vercel Hobby. Provider work is capped at `ANALYSIS_BUDGET_MS` (default 50s) so a slow first answer still leaves time to file the review. The JSON repair pass only runs when enough budget remains. On Pro, raise `maxDuration` to `300`, then raise `ANALYSIS_BUDGET_MS` and `PROVIDER_TIMEOUT_MS` together if your provider needs longer reviews.
- Chart objects are private and served through one-hour signed URLs.
- Daily and weekly limits use `DESK_TIMEZONE`, not the server's UTC clock. Set it to the desk's IANA timezone (for example, the account owner's local time).
- Provider usage is billed by the selected provider. The app does not cap provider spend.

## Add an AI key

1. Open **Settings**.
2. Under **Provider & keys**, pick Gemini, OpenAI, Anthropic, or OpenCode Go.
3. Paste the key, choose a model, and press **Test** if you want a live check.
4. Press **Save settings**.

Keys are encrypted on the server and never sent to the browser. The Settings page only receives a masked hint and a source (`stored` / `env`). A pasted key is sent to the selected provider only when you run a chart review or test the provider.

Environment variables are used as a fallback when no key is stored:

| Provider | Variables |
| --- | --- |
| Gemini | `GEMINI_API_KEY` or `GOOGLE_API_KEY` |
| OpenAI | `OPENAI_API_KEY` |
| Anthropic | `ANTHROPIC_API_KEY` |
| OpenCode Go | `OPENCODE_GO_API_KEY` or `OPENCODE_API_KEY` |

A key entered in Settings takes precedence over the environment. Optional endpoint overrides exist for gateways and local mocks: `GEMINI_BASE_URL`, `OPENAI_BASE_URL`, `ANTHROPIC_BASE_URL`, `OPENCODE_BASE_URL` / `OPENCODE_GO_BASE_URL`, and `ANTHROPIC_VERSION`.

### OpenCode Go notes

The **DeepSeek V4.1 Flash Free** model shown inside OpenCode is an in-app free-tier model and cannot be called from an external client. For chart reviews, use an **OpenCode Go** subscription key and the model ID `deepseek-v4.1-flash`. The model is vision-capable and its usage is included in the Go monthly allowance.

DeepSeek is region-restricted by default. In the [OpenCode Console](https://opencode.ai/console), open **Settings → Privacy**, select **Global** under **Regions**, and save before testing the key.

OpenCode Go is intended for coding-agent traffic. A non-coding workload may be rate-limited or refused; keep another provider configured as a fallback.

## Data and security

- **Auth:** Supabase email/password only; accounts are provisioned by the desk owner. There is no self-service sign-up.
- **Isolation:** every table has `user_id` and RLS. A user can only read or write their own rows.
- **Provider keys:** AES-256-GCM encrypted at rest in `provider_keys`; only masked hints reach the browser.
- **Charts:** stored in the private `charts` bucket under `<user_id>/<analysis_id>.<ext>`; Storage policies enforce the folder owner.
- **Reset:** **Settings → Data & reset → Clear journal** requires typing `RESET`. It removes the user's trades, filed reviews, and chart objects. Settings and provider keys stay.
- **Export:** CSV export is scoped to the signed-in user.

The earlier local-first SQLite journal is not migrated automatically. It remains untouched on the machine that ran the local app. The Supabase deployment starts with a clean journal.

## The workflow

1. **Review a chart.** Upload or paste a screenshot (PNG, JPEG, or WebP, up to 4 MB), add timeframe/session context, and run the review.
2. **Read the ticket.** The verdict is `CLEARED`, `WAIT`, or `STOOD DOWN`. The ticket shows the setup, trigger, invalidation, confluences, warnings, risk map, stop distance, R:R, and cost-aware size.
3. **Log a cleared plan.** Only a filed, non-sample, cleared ticket can enter the ledger. The desk lot size is the default; if you traded a different size, record the actual lots and the server recomputes risk, P&L, and R. Each review can be logged once.
4. **Close it in the ledger.** Record win, loss, breakeven, or leave it open. Winning and losing exits must be on the correct side of entry. Close the trade and the R curve, guardrails, and stats update.
5. **Read the mandate.** The dashboard and ledger show the loss budget remaining, trades left, open risk, and loss streak. When a limit is breached, the desk locks new cleared tickets for the day.

## How sizing works

The server computes:

```
target risk   = balance × risk-per-trade %
cost per lot  = spread × contract size + commission per lot
loss per lot  = |entry − stop| × contract size + cost per lot
lots          = floor(target risk ÷ loss per lot, 0.01)
```

Spread and commission are charged once as a round-trip cost, so risk, R:R, and P&L are net of execution costs. If the minimum 0.01 lot would exceed the risk budget, the plan cannot be sized and the desk stands down. A 100-lot ceiling is a sanity cap, not a target.

Defaults: $10,000 account, 1% risk per trade, 2% daily loss cap, 6% weekly cap, 2 trades per day, stop after 2 consecutive losses, 2R minimum, 60 minimum confidence, XAUUSD at 100 oz per lot, $0.30 spread, $0 commission. Change them in **Settings**.

## Guardrails

A new ticket is refused when any of these are true:

- Realized loss today reaches the daily loss cap.
- Realized loss this week reaches the weekly cap.
- The daily trade-count cap is reached.
- The consecutive-loss stop is reached.
- Open risk is above 75% of the daily loss budget.

Guardrails govern new cleared tickets and the status shown on the desk. They do **not** delete or prevent journal corrections to trades you already took.

## Project map

```
app/(desk)/          Authenticated desk pages: dashboard, analyze, journal, review, settings
app/login/           Supabase email/password sign-in
app/api/             Auth-gated route handlers for analyze, trades, settings, export, reset
components/          Desk shell, ticket, risk map, ledger, settings, dashboard panels
lib/ai/              Provider calls, prompt, schema repair, demo analysis, enrichment
lib/auth.ts          requireUser / requireApiSession guards
lib/crypto.ts        AES-256-GCM provider-key encryption
lib/db.ts            Supabase data layer, typed row maps, signed chart URLs
lib/supabase/        Browser, server, and proxy clients
lib/risk.ts          Deterministic sizing, guardrails, geometry checks, verdict
lib/trade-service.ts Trade parsing, sizing, P&L and R computation
lib/stats.ts         Journal statistics and consistency score
proxy.ts             Session refresh and optimistic page redirects
supabase/            SQL migration, RLS, Storage policies, setup notes
app/globals.css      Design tokens and shared component styles
```

See [DESIGN.md](./DESIGN.md) for the visual system and [PRODUCT.md](./PRODUCT.md) for the product brief.

## Non-goals

No live price feed, no broker connection, no automatic execution, and no public sign-up. Nothing here is financial advice.
