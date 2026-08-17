import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { Alert, Field, Spinner } from '../components/ui';
import { validateImei, IMEI_ERROR_MESSAGES } from '../../shared/imei';
import type { DeviceStatusReport } from '../../shared/device-status';

const TONE_STYLES: Record<string, string> = {
  good: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  bad: 'border-rose-200 bg-rose-50 text-rose-900',
  warn: 'border-amber-200 bg-amber-50 text-amber-900',
  neutral: 'border-[rgb(var(--line))] bg-white text-[rgb(var(--ink))]',
};

const TONE_ICON: Record<string, string> = {
  good: 'M20 6 9 17l-5-5',
  bad: 'M18 6 6 18M6 6l12 12',
  warn: 'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  neutral: 'M12 8v4m0 4h.01',
};

export function DeviceCheck() {
  const [params] = useSearchParams();
  const [imei, setImei] = useState(params.get('imei') ?? '');
  const [report, setReport] = useState<DeviceStatusReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(value: string) {
    const local = validateImei(value);
    if (!local.valid) {
      setError(IMEI_ERROR_MESSAGES[local.error!]);
      setReport(null);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      setReport(await api.deviceStatus(local.normalised));
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (params.get('imei')) void run(params.get('imei')!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="container-page max-w-2xl py-10 sm:py-14">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
        Check a device before you buy or unlock
      </h1>
      <p className="mt-2 text-[rgb(var(--ink-soft))]">
        Enter an IMEI to see whether it is reported lost or stolen, which carrier it is locked
        to, and whether an iCloud or Google lock is active. Read-only — we never change
        anything on the device.
      </p>

      <form
        className="card mt-8 p-6 sm:p-8"
        onSubmit={(e) => {
          e.preventDefault();
          void run(imei);
        }}
      >
        <Field label="IMEI number" htmlFor="ds-imei" hint="Dial *#06# to display it.">
          <input
            id="ds-imei"
            className={`input font-mono tracking-wider ${error ? 'input-error' : ''}`}
            value={imei}
            onChange={(e) => {
              setImei(e.target.value);
              if (error) setError(null);
            }}
            inputMode="numeric"
            maxLength={20}
            autoComplete="off"
            placeholder="353261110006674"
            required
          />
        </Field>
        <button type="submit" className="btn-primary mt-5 w-full" disabled={busy}>
          {busy && <Spinner />}
          Run device check
        </button>
      </form>

      {error && (
        <div className="mt-6">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      {report && (
        <section className="animate-rise mt-8 space-y-5">
          <div className="card p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-[rgb(var(--ink-soft))]">
                  {report.model ?? 'Device'} · IMEI {report.imei}
                </p>
                <h2 className="mt-1 text-2xl font-extrabold tracking-tight">
                  {report.headline}
                </h2>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {report.findings.map((finding) => (
                <div
                  key={finding.label}
                  className={`flex gap-3 rounded-xl border p-4 ${TONE_STYLES[finding.tone]}`}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="mt-0.5 shrink-0"
                    aria-hidden="true"
                  >
                    <path
                      d={TONE_ICON[finding.tone]}
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <div>
                    <p className="text-sm font-bold">
                      {finding.label}: {finding.value}
                    </p>
                    {finding.detail && (
                      <p className="mt-0.5 text-sm leading-relaxed opacity-90">
                        {finding.detail}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-6 sm:p-8">
            <h3 className="text-sm font-bold uppercase tracking-wide text-[rgb(var(--ink-soft))]">
              What we recommend
            </h3>
            <p className="mt-2 leading-relaxed">{report.recommendation.message}</p>

            {report.recommendation.action === 'carrier_unlock' && (
              <Link
                to={`/unlock${report.brand_slug ? `?brand=${report.brand_slug}` : ''}`}
                className="btn-primary mt-5"
              >
                Unlock this device
              </Link>
            )}
            {report.recommendation.action === 'ownership_case' && (
              <Link
                to={`/locked-device-help?imei=${report.imei}${
                  report.icloud_lock === 'on' ? '&lock=icloud_activation' : '&lock=google_frp'
                }`}
                className="btn-primary mt-5"
              >
                Open a proof-of-ownership case
              </Link>
            )}
          </div>
        </section>
      )}

      <div className="mt-8 rounded-2xl border border-[rgb(var(--line))] bg-white p-6 text-sm leading-relaxed text-[rgb(var(--ink-soft))]">
        <p className="font-bold text-[rgb(var(--ink))]">Buying a used phone?</p>
        <p className="mt-2">
          Run this check with the seller's IMEI first. A device that is blacklisted or shows an
          active iCloud / Google lock cannot be freed by you after purchase — only the previous
          owner or the manufacturer can clear those. Walk away, or ask the seller to resolve it
          before you pay.
        </p>
      </div>
    </div>
  );
}
