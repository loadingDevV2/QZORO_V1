"use client";

import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, LayoutDashboard, ScanLine, Settings2 } from "lucide-react";
import { UserMenu } from "./UserMenu";

const NAV = [
  { href: "/", label: "The desk", icon: LayoutDashboard },
  { href: "/analyze", label: "Chart review", icon: ScanLine },
  { href: "/journal", label: "Ledger", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-3" aria-label="QZORO home">
      <Image
        src="/qzoro-mark.png"
        alt=""
        width={compact ? 24 : 32}
        height={compact ? 24 : 32}
        priority
        className="shrink-0 rounded-[5px] border border-[rgba(185,243,109,0.28)]"
      />
      <span className="flex flex-col">
        <span className="text-[16px] font-semibold leading-none tracking-[0.16em] text-bone">QZORO</span>
        <span className="mt-[5px] font-mono text-[8.5px] leading-none tracking-[0.3em] text-faint">RISK DESK</span>
      </span>
    </Link>
  );
}

function NavBody({ pathname, mobile = false }: { pathname: string | null; mobile?: boolean }) {
  return (
    <nav className={mobile ? "flex items-center gap-1" : "flex flex-col gap-0.5"}>
      {NAV.map((item) => {
        const active =
          pathname !== null && (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href));
        const Icon = item.icon;
        if (mobile) {
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              title={item.label}
              className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors ${
                active ? "bg-[rgba(185,243,109,0.1)] text-accent-bright" : "text-muted hover:text-bone"
              }`}
            >
              <Icon size={17} strokeWidth={1.7} />
            </Link>
          );
        }
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`group flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] transition-colors ${
              active
                ? "bg-[rgba(185,243,109,0.08)] text-accent-bright"
                : "text-muted hover:bg-[rgba(226,242,226,0.035)] hover:text-bone"
            }`}
          >
            <Icon
              size={16}
              strokeWidth={1.7}
              className={active ? "text-accent" : "text-faint group-hover:text-muted"}
            />
            <span className="flex-1">{item.label}</span>
            {active ? <span className="h-1.5 w-1.5 bg-accent" aria-hidden="true" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}

function NavActive({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  return <NavBody pathname={pathname} mobile={mobile} />;
}

// usePathname is URL data: Cache Components requires a Suspense boundary above it.
function NavLinks({ mobile = false }: { mobile?: boolean }) {
  return (
    <Suspense fallback={<NavBody pathname={null} mobile={mobile} />}>
      <NavActive mobile={mobile} />
    </Suspense>
  );
}

export function Sidebar() {
  return (
    <>
      <aside className="rail">
        <Logo />

        <div className="mt-8 flex items-center gap-3 px-3">
          <span className="h-[1px] w-5 bg-accent/60" aria-hidden="true" />
          <span className="font-mono text-[9px] tracking-[0.2em] text-faint">XAUUSD · SPOT GOLD</span>
        </div>

        <div className="mt-5">
          <div className="mb-2 px-3">
            <span className="label">The desk</span>
          </div>
          <NavLinks />
        </div>

        <div className="mt-auto">
          <div className="border border-line p-3.5">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 animate-[pulse-dot_2.4s_ease-in-out_infinite] bg-long" />
              <span className="font-mono text-[9px] tracking-[0.18em] text-bone">CLOUD DESK</span>
            </div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-faint">
              Journal in Supabase. Charts in private storage. Provider keys encrypted on the server.
            </p>
            <Link
              href="/settings"
              className="mt-3 inline-flex items-center gap-1 text-[11.5px] text-muted transition-colors hover:text-accent-bright"
            >
              Desk settings <span aria-hidden="true">↗</span>
            </Link>
            <UserMenu />
          </div>
          <p className="mt-4 px-1 text-[10.5px] leading-relaxed text-faint">
            Analysis, not advice. Verify every level on your own chart.
          </p>
          <p className="mt-3 px-1 font-mono text-[9px] tracking-[0.14em] text-faint">QZORO / V1</p>
        </div>
      </aside>

      <div className="mobile-bar">
        <Logo compact />
        <NavLinks mobile />
        <UserMenu compact />
      </div>
    </>
  );
}
