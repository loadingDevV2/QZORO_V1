# Surface brief — QZORO

Scope: the login screen, app shell, Desk dashboard (`/`), Chart review (`/analyze`), Ledger (`/journal`), and Settings (`/settings`). Mode: **Operate**. Invite-only accounts, cloud-hosted, desktop-first with a usable mobile review flow.

Audience and job: a lone XAUUSD intraday trader needs a chart read, an exact risk-sized ticket, and a reason to stop trading for the day. Frequency: several times per session, plus a journal pass at the close.

Constraints: no live market data, no invented claims, numeric truth comes from the server. The interface must stay legible at 1280–1600px and degrade to 390px without losing the ticket or the limits.

## Direction contract

**THESIS:** A trader's desk blotter, not a signal dashboard. The chart review ends in a stamped risk-desk docket and a ledger entry. It refuses the category's neon-terminal cosplay and its equal-card grid.

**OWN-WORLD:** Green-black ink, mint-bone type, hairline rules, and one acid signal-green accent reserved for action, focus, and the ticket's entry line. Emerald stays colder and deeper for long/cleared outcomes, so the brand never reads as profit. Every price, size, and R multiple is set in a characterful mono with tabular figures; prose is a tight grotesk. Components are dockets, ledgers, ladders, and rectangular verdict stamps — no pills as decoration, no glass, no glow.

**STORY:** Upload a chart, see what the desk sees, get the one position size that fits the plan, and either stand down or log it. The day's mandate is always in view so the next trade is judged against the day, not the moment.

**FIRST VIEWPORT:** A persistent left rail with the QZORO mark and a short signal-green strip. Main column: "The desk" and the session date, a full-width mandate panel with a verdict stamp, a risk-budget bar, and four ledger counters; below it, the equity line and open risk, then the latest reviews. The primary action sits top-right: Review a chart.

**FORM:** Code-led, Operate surface, direction 1 of the operator's brief: risk-desk ledger. Signature interaction: the chart review "prints" a trade ticket whose price ladder, R multiples, and lot size are computed server-side, with a verdict that can refuse the trade.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Unresolved

None blocking. A live XAUUSD feed and broker sync are explicitly out of v1.
