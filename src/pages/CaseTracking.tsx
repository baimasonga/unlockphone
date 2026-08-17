import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, ApiError, type PublicCase } from '../lib/api';
import { Alert, Field, Spinner } from '../components/ui';
import { CASE_TERMINAL, type CaseStatus } from '../../shared/ownership';

const ORDER: CaseStatus[] = [
  'submitted',
  'reviewing',
  'verified',
  'submitted_to_authority',
  'resolved',
];

export function CaseTracking() {
  const [params] = useSearchParams();
  const [reference, setReference] = useState(params.get('ref') ?? '');
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [record, setRecord] = useState<PublicCase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const lookup = useCallback(async (ref: string, mail: string, quiet = false) => {
    if (!quiet) {
      setBusy(true);
      setError(null);
    }
    try {
      setRecord(await api.ownership.track(ref, mail));
    } catch (e) {
      if (!quiet) setError((e as ApiError).message);
    } finally {
      if (!quiet) setBusy(false);
    }
  }, []);

  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current) return;
    if (params.get('ref') && params.get('email')) {
      autoRan.current = true;
      void lookup(params.get('ref')!, params.get('email')!);
    }
  }, [params, lookup]);

  // Refresh while the case is still active so the customer sees it advance.
  useEffect(() => {
    if (!record || CASE_TERMINAL.includes(record.status)) return;
    const handle = setInterval(() => void lookup(reference, email, true), 8000);
    return () => clearInterval(handle);
  }, [record, reference, email, lookup]);

  return (
    <div className="container-page max-w-3xl py-10 sm:py-14">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Track your case</h1>
      <p className="mt-2 text-[rgb(var(--ink-soft))]">
        Your ownership case reference plus the email you filed it under.
      </p>

      <form
        className="card mt-8 grid gap-5 p-6 sm:grid-cols-[1fr_1fr_auto] sm:items-end sm:p-8"
        onSubmit={(e) => {
          e.preventDefault();
          void lookup(reference, email);
        }}
      >
        <Field label="Case reference" htmlFor="cref">
          <input
            id="cref"
            className="input font-mono uppercase"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="OC-XXXX-XXXX"
            required
          />
        </Field>
        <Field label="Email used" htmlFor="cemail">
          <input
            id="cemail"
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

      {record && (
        <section className="animate-rise mt-8 space-y-5">
          <div className="card p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm text-[rgb(var(--ink-soft))]">Reference</p>
                <p className="font-mono text-2xl font-extrabold tracking-tight">
                  {record.reference}
                </p>
              </div>
              <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-800 ring-1 ring-brand-200">
                {record.status_label}
              </span>
            </div>

            <dl className="mt-6 grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[rgb(var(--ink-soft))]">Lock</dt>
                <dd className="mt-0.5 font-semibold">{record.lock_label}</dd>
              </div>
              <div>
                <dt className="text-[rgb(var(--ink-soft))]">Device</dt>
                <dd className="mt-0.5 font-semibold">{record.device_model ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-[rgb(var(--ink-soft))]">IMEI</dt>
                <dd className="mt-0.5 font-mono font-semibold">{record.imei_masked}</dd>
              </div>
              <div>
                <dt className="text-[rgb(var(--ink-soft))]">Goes to</dt>
                <dd className="mt-0.5 font-semibold">{record.authority.name}</dd>
              </div>
            </dl>
          </div>

          {record.status === 'needs_more_info' && (
            <Alert tone="warning">
              We need clearer proof of ownership before we can continue. Reply to the email we
              sent with a better photo or a fuller receipt.
            </Alert>
          )}

          {record.status === 'verified' && (
            <Alert tone="success">
              Ownership verified. We have prepared your submission for {record.authority.name}{' '}
              and are sending it through their official channel.
            </Alert>
          )}

          {record.status === 'resolved' && (
            <Alert tone="success">
              {record.authority.name} has actioned the request. Follow their confirmation to
              finish setting up your device.
            </Alert>
          )}

          {record.status === 'rejected' && (
            <Alert tone="error">
              We could not verify ownership from what was provided, so we did not submit
              anything. If you have stronger proof, reply to our email and we will reopen it.
            </Alert>
          )}

          <div className="card p-6 sm:p-8">
            <h2 className="text-lg font-bold">Progress</h2>

            <div className="mt-5 flex items-center gap-1.5" aria-hidden="true">
              {ORDER.map((stage) => {
                const reached =
                  ORDER.indexOf(record.status) >= ORDER.indexOf(stage) &&
                  record.status !== 'rejected';
                return (
                  <span
                    key={stage}
                    className={`h-1.5 flex-1 rounded-full ${
                      reached ? 'bg-brand-600' : 'bg-slate-200'
                    }`}
                  />
                );
              })}
            </div>

            <ol className="mt-6 space-y-0">
              {record.events.map((event, index) => {
                const isLast = index === record.events.length - 1;
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

            {!CASE_TERMINAL.includes(record.status) && (
              <p className="mt-4 flex items-center gap-2 text-sm text-[rgb(var(--ink-soft))]">
                <Spinner />
                This page updates itself while your case is open.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
