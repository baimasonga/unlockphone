import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type CountryGroup } from '../lib/api';
import { Skeleton } from '../components/ui';

export function Networks() {
  const [countries, setCountries] = useState<CountryGroup[] | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    api
      .networksByCountry()
      .then(setCountries)
      .catch(() => setCountries([]));
  }, []);

  const filtered = useMemo(() => {
    if (!countries) return null;
    const needle = query.trim().toLowerCase();
    if (!needle) return countries;
    return countries
      .map((group) => ({
        ...group,
        networks: group.networks.filter(
          (n) =>
            n.name.toLowerCase().includes(needle) ||
            group.country.toLowerCase().includes(needle),
        ),
      }))
      .filter((group) => group.networks.length > 0);
  }, [countries, query]);

  return (
    <div className="container-page py-10 sm:py-14">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
        Supported networks
      </h1>
      <p className="mt-2 max-w-2xl text-[rgb(var(--ink-soft))]">
        Every network below can be unlocked for any brand we support. Pick yours to see the
        price and turnaround for your exact device.
      </p>

      <div className="mt-8 max-w-md">
        <label htmlFor="network-search" className="sr-only">
          Search networks
        </label>
        <input
          id="network-search"
          className="input"
          placeholder="Search by network or country"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          type="search"
        />
      </div>

      {!filtered ? (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card mt-10 p-10 text-center">
          <p className="text-lg font-bold">No network matches “{query}”</p>
          <p className="mt-2 text-sm text-[rgb(var(--ink-soft))]">
            We add networks on request — start an order for the closest match and our team
            will confirm before charging you.
          </p>
          <button type="button" onClick={() => setQuery('')} className="btn-secondary mt-6">
            Clear search
          </button>
        </div>
      ) : (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((group) => (
            <section key={group.country_code} className="card p-6">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[rgb(var(--ink-soft))]">
                {group.country}
              </h2>
              <ul className="mt-4 space-y-1">
                {group.networks.map((network) => (
                  <li key={network.slug}>
                    <Link
                      to={`/unlock?network=${network.slug}`}
                      className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-brand-50 hover:text-brand-700"
                    >
                      {network.name}
                      <span aria-hidden="true" className="text-brand-400">
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
