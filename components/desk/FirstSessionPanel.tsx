import Link from "next/link";

const STEPS = [
  {
    index: "01",
    title: "Put a key on the desk",
    copy: "Gemini, OpenAI, Claude, or OpenCode Go. The key stays server-side; the browser never sees it.",
    href: "/settings",
    link: "Add a key",
  },
  {
    index: "02",
    title: "Review one chart",
    copy: "Drop a screenshot with a legible price axis. Start with the sample review — it needs no key.",
    href: "/analyze",
    link: "Open chart review",
  },
  {
    index: "03",
    title: "Log what you take",
    copy: "The ledger is the source of truth. Close the trade and the R curve begins.",
    href: "/journal",
    link: "Open the ledger",
  },
];

export function FirstSessionPanel({ providerReady, providerLabel }: { providerReady: boolean; providerLabel: string }) {
  return (
    <section className="panel overflow-hidden">
      <div className="grid grid-cols-1 gap-px bg-line md:grid-cols-[0.9fr_2fr]">
        <div className="bg-panel p-6">
          <h2 className="text-[20px] tracking-[-0.03em] text-bone">First session</h2>
          <p className="mt-2 max-w-[34ch] text-[12.5px] leading-relaxed text-muted">
            No trades, no reviews. Set the desk up once, then let the limits do the discipline.
          </p>
          <div className="mt-5 flex items-center gap-2 border-t border-line pt-4">
            <span className={`h-1.5 w-1.5 ${providerReady ? "bg-long" : "bg-warn"}`} aria-hidden="true" />
            <span className="text-[11px] text-faint">
              {providerReady ? `${providerLabel} key is on file.` : "No provider key yet — the sample still works."}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-px bg-line sm:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.index} className="flex flex-col bg-panel p-5">
              <div className="font-mono text-[10px] tracking-[0.18em] text-accent">{step.index}</div>
              <h3 className="mt-3 text-[13.5px] leading-snug text-bone">{step.title}</h3>
              <p className="mt-2 flex-1 text-[11.5px] leading-relaxed text-faint">{step.copy}</p>
              <Link
                href={step.href}
                className="mt-4 inline-flex items-center gap-1.5 font-mono text-[9.5px] tracking-[0.12em] text-muted transition-colors hover:text-accent-bright"
              >
                {step.link} <span aria-hidden="true">→</span>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
