# QZORO

QZORO is an invite-only, account-scoped XAUUSD chart-review desk. A trader uploads a chart screenshot; the desk returns an objective read, a precise trade plan with invalidation, and the only defensible position size for that plan. Every plan can be logged, and the desk enforces daily limits so one bad session does not become a bad month.

## Who it serves

A discretionary intraday XAUUSD trader working alone at a laptop, likely during the London or New York session, who already has a broker and a charting platform. They do not want another signal channel. They want a second pair of eyes and a risk officer.

## The job

1. **Read the chart** — structure, levels, setup quality, and whether there is a trade at all.
2. **Price the risk** — entry, invalidation, targets, lot size, and cost for the actual account.
3. **Protect the day** — daily loss cap, max trades, loss-streak stop, weekly cap.
4. **Record the truth** — a ledger of what was planned versus what was taken, and a discipline score built from behaviour, not bravado.

## Product principles

- **No trade is a valid output.** The desk is designed to stand down more often than it fires.
- **The model reads; the server does the math.** Risk sizing, R:R validation, and limit checks are deterministic code, never model arithmetic.
- **Never invent a level.** If the price axis is unreadable, the only correct answer is a refusal.
- **Keys stay server-side.** Provider keys are encrypted at rest and never sent to the browser.
- **The journal is the source of truth.** Stats are computed from logged trades, not from analysis output.

## Scope — v1

Invite-only accounts hosted on Vercel, each with an isolated journal, English UI. Vision analysis via Gemini, OpenAI, Anthropic, or OpenCode Go. Trade journal, daily/weekly guardrails, discipline analytics, CSV export. Demo analysis with no key required.

## Non-goals — v1

No live price feed, no broker connection, no automatic execution, and no public sign-up. Nothing here is financial advice.

## Assumptions

- The user's chart screenshot includes a readable price axis and instrument label.
- The account currency is USD and XAUUSD is quoted per troy ounce.
- One standard lot is 100 oz; a 1.00 price move is worth $100 per lot.
- The user is responsible for keeping the account balance in Settings current.
