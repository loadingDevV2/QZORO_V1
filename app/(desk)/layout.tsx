import type { ReactNode } from "react";
import { Sidebar } from "@/components/shell/Sidebar";

// Vercel Hobby caps functions at 60s. A very large ledger may need a longer
// limit on Pro; data reads are paginated server-side.
export const maxDuration = 60;

export default function DeskLayout({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <div className="main-inner">{children}</div>
      </main>
    </div>
  );
}
