import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';

const NAV = [
  { to: '/unlock', label: 'Unlock a phone' },
  { to: '/unlock-iphone', label: 'iPhone' },
  { to: '/unlock-samsung', label: 'Samsung' },
  { to: '/networks', label: 'Networks' },
  { to: '/tracking', label: 'Track order' },
];

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="Home">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M17 10V7a5 5 0 0 0-9.6-2M6 10h12v10H6V10Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="text-lg font-extrabold tracking-tight">
        Unlock<span className="text-brand-600">Wave</span>
      </span>
    </Link>
  );
}

export function Layout() {
  const [open, setOpen] = useState(false);
  const { user, signOut } = useAuth();
  const location = useLocation();

  // Collapse the mobile menu whenever navigation happens.
  const close = () => setOpen(false);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-[rgb(var(--line))] bg-white/85 backdrop-blur">
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <Logo />

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                    isActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-[rgb(var(--ink-soft))] hover:bg-slate-100 hover:text-[rgb(var(--ink))]'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            {user ? (
              <>
                {user.role === 'admin' && (
                  <Link to="/admin" className="btn-ghost text-sm">
                    Admin
                  </Link>
                )}
                <Link to="/account" className="btn-ghost text-sm">
                  My orders
                </Link>
                <button type="button" onClick={signOut} className="btn-secondary text-sm">
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/signin" className="btn-ghost text-sm">
                  Sign in
                </Link>
                <Link to="/unlock" className="btn-primary text-sm">
                  Unlock my phone
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            className="btn-secondary px-3 lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d={open ? 'M6 6l12 12M18 6L6 18' : 'M4 7h16M4 12h16M4 17h16'}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {open && (
          <div id="mobile-nav" className="border-t border-[rgb(var(--line))] bg-white lg:hidden">
            <nav className="container-page flex flex-col py-3" aria-label="Mobile">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={close}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-3 text-base font-semibold ${
                      isActive ? 'bg-brand-50 text-brand-700' : 'text-[rgb(var(--ink))]'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              <div className="mt-2 flex flex-col gap-2 border-t border-[rgb(var(--line))] pt-3">
                {user ? (
                  <>
                    <Link to="/account" onClick={close} className="btn-secondary">
                      My orders
                    </Link>
                    {user.role === 'admin' && (
                      <Link to="/admin" onClick={close} className="btn-secondary">
                        Admin
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        signOut();
                      }}
                      className="btn-ghost"
                    >
                      Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <Link to="/signin" onClick={close} className="btn-secondary">
                      Sign in
                    </Link>
                    <Link to="/unlock" onClick={close} className="btn-primary">
                      Unlock my phone
                    </Link>
                  </>
                )}
              </div>
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1" key={location.pathname}>
        <Outlet />
      </main>

      <footer className="mt-20 border-t border-[rgb(var(--line))] bg-white">
        <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-[rgb(var(--ink-soft))]">
              Permanent carrier unlocks processed through official network and manufacturer
              databases. No jailbreak, no software, no warranty risk.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-bold">Unlocks</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-[rgb(var(--ink-soft))]">
              <li>
                <Link to="/unlock-iphone" className="hover:text-brand-700">
                  Unlock iPhone
                </Link>
              </li>
              <li>
                <Link to="/unlock-samsung" className="hover:text-brand-700">
                  Unlock Samsung
                </Link>
              </li>
              <li>
                <Link to="/unlock" className="hover:text-brand-700">
                  All brands
                </Link>
              </li>
              <li>
                <Link to="/networks" className="hover:text-brand-700">
                  Supported networks
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-bold">Support</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-[rgb(var(--ink-soft))]">
              <li>
                <Link to="/tracking" className="hover:text-brand-700">
                  Track your order
                </Link>
              </li>
              <li>
                <Link to="/network-check" className="hover:text-brand-700">
                  Free network check
                </Link>
              </li>
              <li>
                <Link to="/faq" className="hover:text-brand-700">
                  FAQ
                </Link>
              </li>
              <li>
                <Link to="/account" className="hover:text-brand-700">
                  My account
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-bold">The promise</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-[rgb(var(--ink-soft))]">
              <li>Money back if we cannot unlock it</li>
              <li>Official method — warranty stays intact</li>
              <li>Permanent: survives updates and resets</li>
              <li>Live status on every order</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-[rgb(var(--line))]">
          <div className="container-page flex flex-col gap-2 py-6 text-xs text-[rgb(var(--ink-soft))] sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} UnlockWave. A demonstration project.</p>
            <p>
              We only process unlocks for devices you own and that are clear of contract and
              finance.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
