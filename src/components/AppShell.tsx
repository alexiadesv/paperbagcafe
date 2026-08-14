import type { PropsWithChildren } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useCafe } from "../state/CafeState";

const steps = [
  ["/make", "make"],
  ["/seal", "seal"],
  ["/sent", "sent"],
] as const;

export function AppShell({ children }: PropsWithChildren) {
  const { state } = useCafe();
  const location = useLocation();
  const isLanding = location.pathname === "/";

  if (isLanding) return <>{children}</>;

  return (
    <div className="site-shell">
      <header className="site-header">
        <Link className="wordmark" to="/">
          Concept Café
        </Link>
        <nav className="progress-nav" aria-label="Package progress">
          {steps.map(([to, label]) => (
            <NavLink key={to} to={to}>
              {label}
            </NavLink>
          ))}
          <NavLink
            className={!state.publicSlug ? "disabled-link" : undefined}
            to={state.publicSlug ? `/open/${state.publicSlug}` : "/sent"}
          >
            open
          </NavLink>
        </nav>
      </header>
      <main className="page-shell">{children}</main>
      <footer className="site-footer">
        <span>made slowly, sent sweetly</span>
        <span aria-hidden="true">୨୧</span>
      </footer>
    </div>
  );
}
