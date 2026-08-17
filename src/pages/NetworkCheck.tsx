import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiError, type ImeiCheck } from '../lib/api';
import { Alert, Field, Spinner } from '../components/ui';
import { validateImei, IMEI_ERROR_MESSAGES } from '../../shared/imei';

/**
 * The free pre-sale check. Its job is to convert: identify the handset, then
 * hand the customer straight into the wizard with the brand pre-selected.
 */
export function NetworkCheck() {
  const [params] = useSearchParams();
  const [imei, setImei] = useState(params.get('imei') ?? '');
  const [result, setResult] = useState<ImeiCheck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(value: string) {
    const local = validateImei(value);
    if (!local.valid) {
      setError(IMEI_ERROR_MESSAGES[local.error!]);
      setResult(null);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const check = await api.checkImei(local.normalised);
      setResult(check);
      if (!check.valid) setError(check.reason ?? 'That IMEI does not look right.');
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const initial = params.get('imei');
    if (initial) void run(initial);
    // Only on first mount, for the deep link from the home page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="container-page max-w-2xl py-10 sm:py-14">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
        Free device check
      </h1>
      <p className="mt-2 text-[rgb(var(--ink-soft))]">
        Tell us the IMEI and we will identify the handset. Nothing to pay, no account needed.
      </p>

      <form
        className="card mt-8 p-6 sm:p-8"
        onSubmit={(e) => {
          e.preventDefault();
          void run(imei);
        }}
      >
        <Field
          label="IMEI number"
          htmlFor="check-imei"
          hint="Dial *#06# on the phone to display it."
        >
          <input
            id="check-imei"
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
          Check this device
        </button>
      </form>

      {error && (
        <div className="mt-6">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      {result?.valid && (
        <section className="card animate-rise mt-6 p-6 sm:p-8">
          <h2 className="text-xl font-bold">
            {result.recognised ? result.model : 'Valid IMEI'}
          </h2>
          <p className="mt-1 text-sm text-[rgb(var(--ink-soft))]">
            {result.recognised
              ? 'We recognised this handset from its type allocation code.'
              : 'The checksum is good, but this model is not in our device list yet. You can still order — just pick your brand on the next step.'}
          </p>

          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-[rgb(var(--ink-soft))]">IMEI</dt>
              <dd className="font-mono font-semibold">{result.imei}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[rgb(var(--ink-soft))]">TAC</dt>
              <dd className="font-mono font-semibold">{result.tac}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[rgb(var(--ink-soft))]">Checksum</dt>
              <dd className="font-semibold text-emerald-700">Valid</dd>
            </div>
          </dl>

          <Link
            to={result.brand_slug ? `/unlock?brand=${result.brand_slug}` : '/unlock'}
            className="btn-primary mt-6 w-full"
          >
            Continue to unlock this phone
          </Link>
        </section>
      )}

      <div className="mt-8 rounded-2xl border border-[rgb(var(--line))] bg-white p-6 text-sm leading-relaxed text-[rgb(var(--ink-soft))]">
        <p className="font-bold text-[rgb(var(--ink))]">What this check does and does not do</p>
        <p className="mt-2">
          It confirms the IMEI is well-formed and names the model. It does not report the
          device's contract, blacklist, or finance status — the network checks that when the
          unlock request is submitted, and we refund you if it comes back blocked.
        </p>
      </div>
    </div>
  );
}
