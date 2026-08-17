import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, type AdminCase } from '../lib/api';
import { Alert, Skeleton, Spinner } from '../components/ui';
import { CASE_STATUS_LABELS, type CaseStatus } from '../../shared/ownership';

const FILTERS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All' },
  { value: 'submitted', label: 'New' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'needs_more_info', label: 'Waiting on owner' },
  { value: 'verified', label: 'Verified' },
  { value: 'resolved', label: 'Resolved' },
];

// Next-step actions offered per current status, matching the case state machine.
const NEXT_ACTIONS: Record<CaseStatus, CaseStatus[]> = {
  submitted: ['reviewing', 'rejected'],
  reviewing: ['needs_more_info', 'verified', 'rejected'],
  needs_more_info: ['reviewing', 'verified', 'rejected'],
  verified: ['submitted_to_authority', 'rejected'],
  submitted_to_authority: ['resolved', 'rejected'],
  resolved: [],
  rejected: [],
};

export function AdminCases() {
  const [cases, setCases] = useState<AdminCase[] | null>(null);
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<AdminCase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const rows = await api.admin.cases({ status: status || undefined, q: query || undefined });
      setCases(rows);
      setSelected((current) =>
        current ? (rows.find((c) => c.reference === current.reference) ?? null) : null,
      );
    } catch (e) {
      setError((e as ApiError).message);
    }
  }, [status, query]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function advance(reference: string, to: CaseStatus) {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.admin.transitionCase(reference, to);
      setSelected(updated);
      await refresh();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-6">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
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
          placeholder="Reference, name, email or IMEI"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="card overflow-hidden">
          {!cases ? (
            <div className="p-6">
              <Skeleton className="h-40" />
            </div>
          ) : cases.length === 0 ? (
            <p className="p-10 text-center text-[rgb(var(--ink-soft))]">
              No cases match this filter.
            </p>
          ) : (
            <ul className="divide-y divide-[rgb(var(--line))]">
              {cases.map((record) => (
                <li key={record.reference}>
                  <button
                    type="button"
                    onClick={() => setSelected(record)}
                    className={`flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-slate-50 ${
                      selected?.reference === record.reference ? 'bg-brand-50/60' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-bold">{record.reference}</p>
                      <p className="mt-0.5 truncate text-sm font-semibold">
                        {record.full_name}
                      </p>
                      <p className="truncate text-xs text-[rgb(var(--ink-soft))]">
                        {record.lock_label} · {record.authority.name}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                      {record.status_label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {selected ? (
          <div className="card space-y-5 p-6">
            <div>
              <p className="font-mono text-xs font-bold text-[rgb(var(--ink-soft))]">
                {selected.reference}
              </p>
              <h3 className="mt-1 text-lg font-bold">{selected.full_name}</h3>
              <p className="text-sm text-[rgb(var(--ink-soft))]">{selected.email}</p>
            </div>

            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Detail label="Lock">{selected.lock_label}</Detail>
              <Detail label="Routes to">{selected.authority.name}</Detail>
              <Detail label="Device">{selected.device_model ?? '—'}</Detail>
              <Detail label="IMEI">
                <span className="font-mono">{selected.imei}</span>
              </Detail>
            </dl>

            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[rgb(var(--ink-soft))]">
                Stated proof of ownership
              </p>
              <p className="mt-1 rounded-lg bg-slate-50 p-3 text-sm">{selected.purchase_info}</p>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[rgb(var(--ink-soft))]">
                Attached files ({selected.files.length})
              </p>
              {selected.files.length === 0 ? (
                <p className="mt-1 text-sm text-[rgb(var(--ink-soft))]">
                  None uploaded — request proof before verifying.
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {selected.files.map((file) => (
                    <li key={file.id}>
                      <a
                        href={api.admin.caseFileUrl(selected.reference, file.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between rounded-lg border border-[rgb(var(--line))] px-3 py-2 text-sm font-medium hover:border-brand-400 hover:text-brand-700"
                      >
                        <span className="truncate">{file.filename}</span>
                        <span className="shrink-0 text-xs text-[rgb(var(--ink-soft))]">
                          {(file.byte_size / 1024).toFixed(0)} KB
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {selected.package && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[rgb(var(--ink-soft))]">
                  Generated submission package
                </p>
                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
                  {selected.package}
                </pre>
              </div>
            )}

            <div className="border-t border-[rgb(var(--line))] pt-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[rgb(var(--ink-soft))]">
                Move case
              </p>
              {NEXT_ACTIONS[selected.status].length === 0 ? (
                <p className="mt-2 text-sm text-[rgb(var(--ink-soft))]">
                  This case is closed ({selected.status_label}).
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {NEXT_ACTIONS[selected.status].map((to) => (
                    <button
                      key={to}
                      type="button"
                      disabled={busy}
                      onClick={() => advance(selected.reference, to)}
                      className={`min-h-0 rounded-lg px-3 py-2 text-sm font-semibold ${
                        to === 'rejected'
                          ? 'bg-rose-600 text-white hover:bg-rose-700'
                          : to === 'verified'
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'bg-brand-600 text-white hover:bg-brand-700'
                      } disabled:opacity-60`}
                    >
                      {busy && <Spinner className="mr-1 inline" />}
                      {CASE_STATUS_LABELS[to]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="card flex items-center justify-center p-10 text-center text-sm text-[rgb(var(--ink-soft))]">
            Select a case to review its proof and move it forward.
          </div>
        )}
      </div>
    </div>
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
