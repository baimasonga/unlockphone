import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api, ApiError, type AdminOrder, type AdminStats } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { Alert, Skeleton, Spinner, StatusPill } from '../components/ui';
import { formatMoney } from '../../shared/money';
import { STATUS_LABELS, type OrderStatus } from '../../shared/types';
import { AdminCases } from './AdminCases';

const FILTERS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All' },
  { value: 'in_progress', label: 'Processing' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'awaiting_payment', label: 'Unpaid' },
  { value: 'refunded', label: 'Refunded' },
];

export function Admin() {
  const { user, loading } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [workingOn, setWorkingOn] = useState<string | null>(null);
  const [tab, setTab] = useState<'orders' | 'cases'>('orders');

  const refresh = useCallback(async () => {
    try {
      const [nextStats, nextOrders] = await Promise.all([
        api.admin.stats(),
        api.admin.orders({ status: status || undefined, q: query || undefined }),
      ]);
      setStats(nextStats);
      setOrders(nextOrders);
    } catch (e) {
      setError((e as ApiError).message);
    }
  }, [status, query]);

  useEffect(() => {
    if (user?.role === 'admin') void refresh();
  }, [user, refresh]);

  async function act(reference: string, action: 'poll' | 'refund') {
    setWorkingOn(reference);
    setError(null);
    try {
      if (action === 'poll') await api.admin.poll(reference);
      else await api.admin.refund(reference, 'Refunded by support.');
      await refresh();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setWorkingOn(null);
    }
  }

  if (loading) {
    return (
      <div className="container-page py-14">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="mt-6 h-64" />
      </div>
    );
  }

  if (!user) return <Navigate to="/signin" replace />;
  if (user.role !== 'admin') {
    return (
      <div className="container-page max-w-lg py-20">
        <Alert tone="error">This area is for staff accounts only.</Alert>
      </div>
    );
  }

  return (
    <div className="container-page py-10 sm:py-14">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Operations</h1>
      <p className="mt-2 text-[rgb(var(--ink-soft))]">
        Unlock order queue and proof-of-ownership cases.
      </p>

      <div className="mt-6 flex gap-1 border-b border-[rgb(var(--line))]">
        {(['orders', 'cases'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-bold capitalize transition-colors ${
              tab === value
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-[rgb(var(--ink-soft))] hover:text-[rgb(var(--ink))]'
            }`}
          >
            {value === 'orders' ? 'Unlock orders' : 'Ownership cases'}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-6">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      {tab === 'cases' && (
        <div className="mt-8">
          <AdminCases />
        </div>
      )}

      {tab === 'orders' && (
        <>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Orders" value={stats ? String(stats.orders) : null} />
        <Stat label="Processing" value={stats ? String(stats.working) : null} />
        <Stat label="Delivered" value={stats ? String(stats.delivered) : null} />
        <Stat
          label="Revenue"
          value={stats ? formatMoney(stats.revenue_cents) : null}
        />
        <Stat
          label="Margin"
          value={stats ? formatMoney(stats.margin_cents) : null}
          tone={stats && stats.margin_cents < 0 ? 'bad' : 'good'}
        />
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setStatus(filter.value)}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                status === filter.value
                  ? 'bg-brand-600 text-white'
                  : 'bg-white text-[rgb(var(--ink-soft))] ring-1 ring-[rgb(var(--line))] hover:bg-slate-50'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <input
          className="input max-w-xs"
          type="search"
          placeholder="Reference, email or IMEI"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="button" className="btn-secondary" onClick={() => void refresh()}>
          Refresh
        </button>
      </div>

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-[rgb(var(--line))] bg-slate-50 text-xs uppercase tracking-wide text-[rgb(var(--ink-soft))]">
            <tr>
              <th className="px-5 py-3 font-bold">Reference</th>
              <th className="px-5 py-3 font-bold">Customer</th>
              <th className="px-5 py-3 font-bold">Service</th>
              <th className="px-5 py-3 font-bold">IMEI</th>
              <th className="px-5 py-3 font-bold">Status</th>
              <th className="px-5 py-3 font-bold">Value</th>
              <th className="px-5 py-3 font-bold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgb(var(--line))]">
            {!orders ? (
              <tr>
                <td colSpan={7} className="px-5 py-10">
                  <Skeleton className="h-24" />
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-14 text-center text-[rgb(var(--ink-soft))]"
                >
                  No orders match this filter.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.reference} className="align-middle hover:bg-slate-50/60">
                  <td className="px-5 py-4 font-mono text-xs font-bold">
                    {order.reference}
                    {order.supplier_reference && (
                      <span className="mt-1 block font-normal text-[rgb(var(--ink-soft))]">
                        {order.supplier_reference}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">{order.email}</td>
                  <td className="px-5 py-4">
                    {order.brand}
                    <span className="block text-xs text-[rgb(var(--ink-soft))]">
                      {order.network}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-mono text-xs">{order.imei}</td>
                  <td className="px-5 py-4">
                    <StatusPill
                      status={order.status}
                      label={STATUS_LABELS[order.status as OrderStatus]}
                    />
                    {order.attempts > 0 && (
                      <span className="mt-1 block text-xs text-[rgb(var(--ink-soft))]">
                        {order.attempts} poll{order.attempts === 1 ? '' : 's'}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 font-semibold">
                    {formatMoney(order.price_cents, order.currency)}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-secondary min-h-0 px-3 py-1.5 text-xs"
                        disabled={workingOn === order.reference}
                        onClick={() => void act(order.reference, 'poll')}
                      >
                        {workingOn === order.reference ? <Spinner /> : null}
                        Poll
                      </button>
                      <button
                        type="button"
                        className="btn-danger min-h-0 px-3 py-1.5 text-xs"
                        disabled={
                          workingOn === order.reference ||
                          order.status === 'refunded' ||
                          order.status === 'delivered'
                        }
                        onClick={() => void act(order.reference, 'refund')}
                      >
                        Refund
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {stats && stats.by_network.length > 0 && (
        <section className="card mt-8 p-6">
          <h2 className="text-lg font-bold">Volume by network</h2>
          <ul className="mt-4 space-y-3">
            {stats.by_network.map((row) => {
              const share = stats.orders ? (row.orders / stats.orders) * 100 : 0;
              return (
                <li key={row.network}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold">{row.network}</span>
                    <span className="text-[rgb(var(--ink-soft))]">
                      {row.delivered}/{row.orders} delivered
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-brand-500 transition-all duration-500"
                      style={{ width: `${Math.max(share, 2)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = 'good',
}: {
  label: string;
  value: string | null;
  tone?: 'good' | 'bad';
}) {
  return (
    <div className="card p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-[rgb(var(--ink-soft))]">
        {label}
      </p>
      {value === null ? (
        <Skeleton className="mt-2 h-8 w-20" />
      ) : (
        <p
          className={`mt-1 text-2xl font-extrabold tracking-tight ${
            tone === 'bad' ? 'text-rose-600' : ''
          }`}
        >
          {value}
        </p>
      )}
    </div>
  );
}
