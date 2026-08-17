import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { validateImei, IMEI_ERROR_MESSAGES } from '../../shared/imei';

const NETWORK_LOGOS = [
  'AT&T',
  'T-Mobile',
  'Verizon',
  'EE',
  'O2',
  'Vodafone',
  'Three',
  'Rogers',
  'Telstra',
  'Orange',
];

export function Home() {
  const navigate = useNavigate();
  const [imei, setImei] = useState('');
  const [error, setError] = useState<string | null>(null);

  function start(event: React.FormEvent) {
    event.preventDefault();
    const result = validateImei(imei);
    if (!result.valid) {
      setError(IMEI_ERROR_MESSAGES[result.error!]);
      return;
    }
    navigate(`/network-check?imei=${result.normalised}`);
  }

  return (
    <>
      {/* The hero leads with the form, not a picture: the one job of this page
          is to get an IMEI entered. */}
      <section className="border-b border-[rgb(var(--line))] bg-white">
        <div className="container-page grid gap-12 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200">
              Official method · warranty safe
            </span>

            <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              Unlock your phone
              <br />
              from any network.
            </h1>

            <p className="mt-5 max-w-lg text-lg leading-relaxed text-[rgb(var(--ink-soft))]">
              We submit your IMEI straight to the carrier and manufacturer databases. The
              unlock is permanent, survives updates and factory resets, and works on any SIM
              worldwide.
            </p>

            <form onSubmit={start} className="mt-8 max-w-lg">
              <label htmlFor="hero-imei" className="label">
                Start with your IMEI
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id="hero-imei"
                  className={`input flex-1 font-mono tracking-wider ${error ? 'input-error' : ''}`}
                  placeholder="Dial *#06# to get it"
                  value={imei}
                  inputMode="numeric"
                  maxLength={20}
                  autoComplete="off"
                  aria-invalid={Boolean(error)}
                  onChange={(e) => {
                    setImei(e.target.value);
                    if (error) setError(null);
                  }}
                />
                <button type="submit" className="btn-primary sm:px-7">
                  Check my phone
                </button>
              </div>
              {error ? (
                <p className="mt-2 text-sm font-medium text-rose-600">{error}</p>
              ) : (
                <p className="hint">
                  Free check — we identify the handset before you pay anything.
                </p>
              )}
            </form>

            <p className="mt-6 text-sm text-[rgb(var(--ink-soft))]">
              Rather browse first?{' '}
              <Link to="/unlock" className="font-semibold text-brand-700 hover:underline">
                Pick your brand and network
              </Link>
            </p>
          </div>

          <div className="relative">
            <div className="card relative z-10 p-6 sm:p-8">
              <h2 className="text-sm font-bold uppercase tracking-wide text-[rgb(var(--ink-soft))]">
                What happens next
              </h2>
              <ol className="mt-5 space-y-5">
                {[
                  {
                    title: 'We identify your device',
                    body: 'The IMEI tells us the exact model and whether the network can unlock it.',
                  },
                  {
                    title: 'You pay a fixed price',
                    body: 'Quoted up front for your exact phone and network. No surprises later.',
                  },
                  {
                    title: 'The network processes it',
                    body: 'Your request goes into the official queue. You watch it move in real time.',
                  },
                  {
                    title: 'You get your unlock',
                    body: 'A code by email, or a remote unlock applied straight to the device.',
                  },
                ].map((item, index) => (
                  <li key={item.title} className="flex gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-bold">{item.title}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-[rgb(var(--ink-soft))]">
                        {item.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div
              aria-hidden="true"
              className="absolute -right-6 -top-6 -z-0 hidden h-40 w-40 rounded-full bg-brand-100 blur-2xl lg:block"
            />
          </div>
        </div>
      </section>

      <section className="border-b border-[rgb(var(--line))] bg-white/60 py-8">
        <div className="container-page">
          <p className="text-center text-xs font-bold uppercase tracking-widest text-[rgb(var(--ink-soft))]">
            Unlocking devices from 25+ networks worldwide
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {NETWORK_LOGOS.map((name) => (
              <span key={name} className="text-lg font-bold text-slate-400">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page py-16 lg:py-20">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: 'Permanent, not a workaround',
              body: 'The unlock is recorded against your IMEI in the network database. Update the OS, factory reset it, sell it — it stays unlocked.',
            },
            {
              title: 'Refund if it fails',
              body: 'If the network will not release your device, we refund you automatically. You never have to chase us for it.',
            },
            {
              title: 'Nothing installed',
              body: 'No jailbreak, no rooting, no cables, no software. Your warranty and your data are untouched.',
            },
          ].map((item) => (
            <article key={item.title} className="card p-6">
              <h3 className="text-lg font-bold">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[rgb(var(--ink-soft))]">
                {item.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="container-page pb-16">
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            to="/unlock-iphone"
            className="card group flex items-center justify-between p-7 transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div>
              <h3 className="text-xl font-bold">Unlock an iPhone</h3>
              <p className="mt-1 text-sm text-[rgb(var(--ink-soft))]">
                Remote unlock through Apple's activation servers.
              </p>
            </div>
            <span className="text-2xl text-brand-500 transition-transform group-hover:translate-x-1">
              →
            </span>
          </Link>
          <Link
            to="/unlock-samsung"
            className="card group flex items-center justify-between p-7 transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div>
              <h3 className="text-xl font-bold">Unlock a Samsung</h3>
              <p className="mt-1 text-sm text-[rgb(var(--ink-soft))]">
                Official NCK code delivered to your inbox.
              </p>
            </div>
            <span className="text-2xl text-brand-500 transition-transform group-hover:translate-x-1">
              →
            </span>
          </Link>
        </div>
      </section>

      <section className="container-page pb-20">
        <div className="card overflow-hidden">
          <div className="grid gap-8 p-8 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight">
                Already ordered? Watch it move.
              </h2>
              <p className="mt-2 max-w-xl text-[rgb(var(--ink-soft))]">
                Every order has a live status page showing exactly where it sits in the
                network's queue — no guessing, no support ticket needed.
              </p>
            </div>
            <Link to="/tracking" className="btn-secondary lg:px-8">
              Track my order
            </Link>
          </div>
        </div>
      </section>

      {/* Setting expectations honestly is part of the product: it cuts refund
          requests we would otherwise have to decline. */}
      <section className="container-page pb-24">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 sm:p-8">
          <h2 className="text-lg font-bold text-amber-900">What we cannot unlock</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-amber-900/90">
            A carrier unlock frees your phone to use other networks. It is not a way past a
            lock you cannot get through yourself. We do not remove screen locks, Google FRP
            locks, or iCloud activation locks, and we cannot unlock a device that is reported
            lost or stolen, blacklisted, or still under an unpaid contract or instalment plan.
            If a check shows any of those, we refund you rather than take the order.
          </p>
        </div>
      </section>
    </>
  );
}
