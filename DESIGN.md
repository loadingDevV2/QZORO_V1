# QZORO — design system

## Intent

A risk desk, not a trading dashboard. The surface should feel like a green-ink blotter under a cold lamp: quiet, exact, and a little severe. Signal green is the desk's ink, not a reward. Every screen answers one question before it decorates anything: **is this trade allowed, and what does it cost?**

QZORO is the private mark on the docket. Its mark is the uploaded white Q on black, used as a compact square badge in the rail and as the favicon. The visual signature is still the **trade ticket**: a printed plan with a stamped verdict, a precise risk map, a `QZ-` serial, and a strict separation between what the model read and what the server calculated.

## Colour

Defined once in `app/globals.css` and exposed as Tailwind theme colours.

| Token | Hex | Role |
| --- | --- | --- |
| `--ink` | `#050806` | Page background |
| `--ink-2` | `#070b08` | Deep wells, dropzone base |
| `--panel` | `#0a100c` | Primary panel surface |
| `--panel-2` | `#0e1611` | Nested surface, ticket header |
| `--line` | `rgba(226, 242, 226, 0.10)` | Hairline rules |
| `--line-strong` | `rgba(226, 242, 226, 0.20)` | Emphasised borders, stamps |
| `--bone` | `#e8f1e5` | Primary type |
| `--muted` | `#a5b5a6` | Secondary type |
| `--faint` | `#849687` | Labels, metadata |
| `--accent` | `#b9f36d` | Primary action, active state, focus |
| `--accent-bright` | `#d6ff9c` | Accent hover, active nav text |
| `--accent-ink` | `#061006` | Type on the accent |
| `--long` | `#5fd39b` | Long bias, cleared, wins, positive R |
| `--short` | `#ff7468` | Short bias, stood down, losses |
| `--warn` | `#e6b45a` | Wait, caution, pending states |

Rules:

- Signal green (`--accent`) marks action, selection, focus, and the one live thing on screen. Never use it to imply profit.
- Emerald (`--long`) is the only green for long bias, cleared verdicts, wins, and positive R. It is cooler and deeper than the accent, so a lime button never reads as a green trade.
- Coral and amber carry refusal, loss, waiting, and caution. They are never the only signal: pair them with text and an icon or stamp shape.
- Borders do the structural work. Shadows are rare and soft; the settings save bar is the only lifted surface.
- Gradients appear only in the dropzone's green radial glow and the skeleton shimmer.
- Body copy is never pure white. `--bone` keeps the desk cool and lowers glare.
- No glow, no neon halo, no second accent. The identity comes from the green-black ground, the white-on-black mark, the acid rule, and the ticket, not from decoration.
- The logo stays monochrome. A hairline accent-tinted border is the only brand colour applied to it; never tint the Q itself.

Contrast on `--panel`: bone 16.6:1, muted 8.9:1, faint 6.1:1, accent 14.7:1, long 10.3:1, short 7.3:1, warn 10.1:1.

## Typography

- **Archivo** (`--font-archivo`, weights 300–700) for headings, prose, and controls. Headings are medium weight with tight tracking.
- **Azeret Mono** (`--font-azeret`, weights 400–600) for prices, lots, R multiples, labels, timestamps, and any number that must align.

Scale in practice:

| Use | Size / treatment |
| --- | --- |
| Page title | `clamp(30px, 3.4vw, 42px)`, 1.02 line-height, `-0.035em` |
| Panel title | 15–18px, medium |
| Body | 13–14px, 1.55 line-height |
| Metadata | 10–12px, muted/faint |
| Section label | 10px mono, uppercase, `0.17em` tracking |
| Table head | 10px mono, uppercase, `0.12em` tracking |
| Ticket levels | Mono, tabular numerals, tight tracking |

Numerals use `.num` (`font-variant-numeric: tabular-nums`). Labels use `.label`. Column headers use `.table-head`. Never letterspace body copy; never set prices in the sans face.

## Layout

- A 248 px sticky rail on the left, content to the right.
- Main padding: `36px clamp(18px, 3.4vw, 54px) 84px`; content capped at 1280 px.
- The shell collapses at **960 px**: the rail is replaced by a 56 px sticky mobile bar with compact nav icons.
- Dashboard panels use a 12-column grid at `xl`; the journal ledger goes full-width below **1700 px** and sits beside the entry form at `min-[1700px]`, so the table keeps all columns at a 1440 px desktop.
- Page headers are a bottom-ruled band: title and description left, actions right; they stack on mobile. A 46 px accent segment sits on the rule at the left edge.
- Density is deliberate. Panels are separated by 20 px (`space-y-5` / `gap-5`), with 16–20 px internal padding. Rules, not boxes inside boxes, create hierarchy.

Breakpoints to verify: **1440 px desktop** and **390 px mobile**.

## Surfaces and components

- **Rail** — green-black ground, a 44 px signal strip at the top, the 32 px QZORO badge (white Q on black, hairline accent edge), and a dark cloud-desk card with account sign-out. The mobile bar uses the same badge at 24 px. The rail is a desk edge, not a navigation drawer.
- **Page header** — bottom rule with a short accent segment. One accent detail per page is enough.
- **Panel** — `--panel`, 1 px `--line`, 14 px radius. No drop shadow.
- **Buttons** — 38 px tall, 8 px radius. Signal-green primary for the one main action; ghost for secondary; quiet for tertiary; danger for destructive. Small variant is 31 px. Primary text is `--accent-ink`, never white.
- **Fields** — 38 px, 8 px radius, near-black green fill, mono values. Focus: accent border plus a 3 px accent wash.
- **Chips** — timeframes and sessions. Active chip gets a translucent accent border/fill.
- **Stamps** — square-ish 4 px radius, 10 px mono, uppercase. `CLEARED` emerald, `WAIT` amber, `STOOD DOWN` coral.
- **Dropzone** — dashed border, green radial glow, four corner ticks. Hover/drag turns the border and ticks accent green.
- **Risk map** — a vertical price ladder with TP2, TP1, entry, and stop. R multiples sit beside prices; the entry line is the visual anchor in accent green. Direction and order type are stated in words, not inferred from colour.
- **Ticket** — printed-in with `.ticket-enter`: 420 ms, translate 10 px, clip-path reveal. The header carries the QZORO serial (`QZ-…` or `QZ-SAMPLE`). It should feel like paper leaving a printer, not a modal popping open.
- **Skeleton** — 1.7 s shimmer; used only inside Suspense fallbacks, never as fake content.
- **Status dot** — the only looping animation (`pulse-dot`, 2.4 s), reserved for the cloud-desk health marker.

## Motion

Motion explains state, then gets out of the way:

- Ticket print-in on a new review.
- Skeleton shimmer while server data streams.
- Accent transitions on focus/hover, 140–160 ms.
- Bars animate width over 600 ms with an ease-out curve.
- Everything collapses to near-zero duration under `prefers-reduced-motion: reduce`.

## Accessibility

- Visible focus is a 2 px accent outline with 2 px offset; form fields add a soft accent ring.
- Status is never colour-only: every stamp and guardrail pairs colour with a word.
- The brand accent and the long/cleared emerald are distinct hues *and* distinct roles. Never rely on the difference alone; labels and stamps carry the meaning.
- Interactive targets are real buttons and links; the upload control is a labelled file input behind a visible dropzone.
- Async results use `aria-live` where they announce (copy, logging, reset, errors).
- Decorative marks (corner ticks, nav active square, status dots) are `aria-hidden`.
- Tables keep semantic headers and readable row labels; horizontal overflow is contained rather than clipped.
- Body copy clears 4.5:1 on every surface; faint is reserved for secondary metadata.

## Voice

Direct, calm, specific. Short sentences. No hype, no emoji, no "crush the market" language.

- Prefer: "The desk stood down." / "No position size, no trade." / "Verify every level on your own chart."
- Avoid: "AI-powered edge", "guaranteed", "moonshot", exclamation marks.
- Numbers are formatted for scanning: `US$100.00`, `2.36R`, `0.11 lots`, `4,181.50`.
- Empty states tell the user the next concrete action, not just that something is empty.
- Error states say what happened, what it means, and what to do next.

## Do / don't

**Do**

- Let hairlines, spacing, and type weight carry hierarchy.
- Keep one accent primary action per view.
- Show the deterministic math beside the model's read so the distinction is obvious.
- Use the same ticket component on the analyze page and the filed review page.
- Let refusal look as considered as a cleared trade.
- Use the accent as a signal edge: the rail strip, the page-head rule, the active nav square, the entry line.

**Don't**

- Add neon glow, glassmorphism, large coloured halos, or crypto-dashboard gradients.
- Use signal green for profit or long bias, or emerald for buttons and navigation.
- Animate numbers counting up.
- Hide the stop, the risk, or the cost model behind a tooltip.
- Introduce a second accent colour. Accent, emerald, coral, and amber already carry every state.
