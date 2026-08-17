import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { Alert, Field, Spinner, StatusPill } from '../components/ui';
import { formatEta, formatMoney } from '../../shared/money';
import type { PublicOrder } from '../../shared/types';

const LIVE_STATUSES = ['awaiting_payment', 'submitted', 'in_progress'];

export function Tracking() {
  const [params] = useSearchParams();
  const [reference, setReference] = useState(params.get('ref') ?? '');
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const lookup = useCallback(
    async (ref: string, mail: string, quiet = false) => {
      if (!quiet) {
        setBusy(true);
        setError(null);
      }
      try {
        setOrder(await api.track(ref, mail));
      } catch (e) {
        if (!quiet) setError((e as ApiError).message);
      } finally {
        if (!quiet) setBusy(false);
      }
    },
    [],
  );

  // Deep link from checkout: look the order up immediately.
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current) return;
    if (params.get('ref') && params.get('email')) {
      autoRan.current = true;
      void lookup(params.get('ref')!, params.get('email')!);
    }
  }, [params, lookup]);

  // While an order is still moving, refresh quietly so the customer sees it
  // progress without touching anything.
  useEffect(() => {
    if (!order || !LIVE_STATUSES.includes(order.status)) return;
    const handle = setInterval(() => void lookup(reference, email, true), 5000);
    return () => clearInterval(handle);
  }, [order, reference, email, lookup]);

  return (
    <div className="container-page max-w-3xl py-10 sm:py-14">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Track your order</h1>
      <p className="mt-2 text-[rgb(var(--ink-soft))]">
        Enter the reference from your confirmation email, plus the email you ordered with.
      </p>

      <form
        className="card mt-8 grid gap-5 p-6 sm:grid-cols-[1fr_1fr_auto] sm:items-end sm:p-8"
        onSubmit={(e) => {
          e.preventDefault();
          void lookup(reference, email);
        }}
      >
        <Field label="Order reference" htmlFor="ref">
          <input
            id="ref"
            className="input font-mono uppercase"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="UL-XXXX-XXXX"
            required
          />
        </Field>
        <Field label="Email used" htmlFor="track-email">
          <input
            id="track-email"
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </Field>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy && <Spinner />}
          Find it
        </button>
      </form>

      {error && (
        <div className="mt-6">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      {order && <OrderDetail order={order} />}
    </div>
  );
}

export function OrderDetail({ order }: { order: PublicOrder }) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    if (!order.result_code) return;
    await navigator.clipboard.writeText(order.result_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="animate-rise mt-8 space-y-5">
      <div className="card p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-[rgb(var(--ink-soft))]">Reference</p>
            <p className="font-mono text-2xl font-extrabold tracking-tight">
              {order.reference}
            </p>
          </div>
          <StatusPill status={order.status} label={order.status_label} />
        </div>

        <dl className="mt-6 grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
          <Detail label="Service">{order.service}</Detail>
          <Detail label="IMEI">
            <span className="font-mono">{order.imei_masked}</span>
          </Detail>
          <Detail label="Paid">{formatMoney(order.price_cents, order.currency)}</Detail>
          <Detail label="Typical time">
            {formatEta(order.eta_hours[0], order.eta_hours[1])}
          </Detail>
          {order.model && <Detail label="Model">{order.model}</Detail>}
          <Detail label="Ordered">{order.created_at}</Detail>
        </dl>
      </div>

      {/* The delivered state is the payoff — it gets the loudest treatment on
          the page, with the code big enough to read off a phone screen. */}
      {order.status === 'delivered' && (
        <div className="card border-emerald-300 bg-emerald-50 p-6 sm:p-8">
          <h2 className="text-xl font-extrabold text-emerald-900">
            {order.delivery_kind === 'remote'
              ? 'Your phone has been unlocked'
              : 'Your unlock code is ready'}
          </h2>

          {order.delivery_kind === 'remote' ? (
            <div className="mt-4 space-y-2 text-sm leading-relaxed text-emerald-900">
              <p>There is no code to enter — the unlock is already applied to your device.</p>
              <p className="font-semibold">To finish:</p>
              <ol className="list-decimal space-y-1 pl-5">
                <li>Insert a SIM from the network you want to use.</li>
                <li>Connect the phone to Wi-Fi and wait for it to activate.</li>
                <li>
                  Still asking for a SIM PIN? Back up, then restore the device in Finder or
                  iTunes to pull the new activation record.
                </li>
              </ol>
            </div>
          ) : (
            <>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <code className="rounded-xl bg-white px-5 py-4 font-mono text-3xl font-extrabold tracking-[0.2em] text-emerald-900 ring-1 ring-emerald-300">
                  {order.result_code}
                </code>
                <button type="button" onClick={copyCode} className="btn-secondary">
                  {copied ? 'Copied' : 'Copy code'}
                </button>
              </div>
              <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-emerald-900">
                <li>Power the phone off and insert a SIM from the new network.</li>
                <li>Power it back on — it will ask for a network or unlock PIN.</li>
                <li>Enter the code above carefully; attempts are usually limited.</li>
              </ol>
            </>
          )}
        </div>
      )}

      {order.status === 'refunded' && (
        <Alert tone="warning">
          <p className="font-bold">This order was refunded in full.</p>
          <p className="mt-1 font-normal">
            {order.result_message ??
              'The network could not complete the unlock, so we returned your money.'}{' '}
            It reaches your original payment method in 5–10 business days.
          </p>
        </Alert>
      )}

      <div className="card p-6 sm:p-8">
        <h2 className="text-lg font-bold">Progress</h2>
        <ol className="mt-5 space-y-0">
          {order.events.map((event, index) => {
            const isLast = index === order.events.length - 1;
            return (
              <li key={`${event.created_at}-${index}`} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span
                    className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                      isLast ? 'bg-brand-600 ring-4 ring-brand-100' : 'bg-slate-300'
                    }`}
                  />
                  {!isLast && <span className="w-px flex-1 bg-slate-200" />}
                </div>
                <div className={isLast ? 'pb-1' : 'pb-6'}>
                  <p className="text-sm font-semibold">{event.message}</p>
                  <p className="mt-0.5 text-xs text-[rgb(var(--ink-soft))]">
                    {event.created_at}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>

        {LIVE_STATUSES.includes(order.status) && (
          <p className="mt-4 flex items-center gap-2 text-sm text-[rgb(var(--ink-soft))]">
            <Spinner />
            This page updates itself — leave it open.
          </p>
        )}
      </div>
    </section>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[rgb(var(--ink-soft))]">{label}</dt>
      <dd className="mt-0.5 font-semibold">{children}</dd>
    </div>
  );
}
