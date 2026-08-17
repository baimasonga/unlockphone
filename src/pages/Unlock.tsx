import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError, type CountryGroup, type PaymentSummary } from '../lib/api';
import { Alert, Field, Spinner, Stepper } from '../components/ui';
import { formatEta, formatMoney } from '../../shared/money';
import { validateImei, IMEI_ERROR_MESSAGES } from '../../shared/imei';
import type { Brand, PublicOrder, PublicService } from '../../shared/types';

const STEPS = ['Device', 'Network', 'IMEI', 'Checkout'] as const;

export function Unlock() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [step, setStep] = useState(0);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [countries, setCountries] = useState<CountryGroup[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  const [brand, setBrand] = useState(params.get('brand') ?? '');
  const [country, setCountry] = useState('');
  const [network, setNetwork] = useState(params.get('network') ?? '');
  const [imei, setImei] = useState('');
  const [model, setModel] = useState('');
  const [email, setEmail] = useState('');
  const [discountCode, setDiscountCode] = useState('');

  const [imeiError, setImeiError] = useState<string | null>(null);
  const [detectedModel, setDetectedModel] = useState<string | null>(null);
  const [quote, setQuote] = useState<PublicService | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [payment, setPayment] = useState<PaymentSummary | null>(null);

  useEffect(() => {
    Promise.all([api.brands(), api.networksByCountry()])
      .then(([b, c]) => {
        setBrands(b);
        setCountries(c);
        // Default to the largest market rather than whichever country happens
        // to sort first alphabetically.
        if (!country && c.length) {
          const preferred = c.find((group) => group.country_code === 'US');
          setCountry((preferred ?? c[0]).country_code);
        }
      })
      .catch((e: ApiError) => setError(e.message))
      .finally(() => setLoadingCatalog(false));
    // Catalog is static for the session; fetching once is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Skip ahead when the landing pages pre-select a brand.
  useEffect(() => {
    if (brand && step === 0 && params.get('brand')) setStep(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand]);

  const networksForCountry = useMemo(
    () => countries.find((c) => c.country_code === country)?.networks ?? [],
    [countries, country],
  );

  const selectedBrand = brands.find((b) => b.slug === brand) ?? null;

  async function goToImeiStep(networkSlug: string) {
    setNetwork(networkSlug);
    setError(null);
    setBusy(true);
    try {
      setQuote(await api.quote(brand, networkSlug));
      setStep(2);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  /** Validate locally first so an obvious typo never costs a round trip. */
  async function confirmImei() {
    const local = validateImei(imei);
    if (!local.valid) {
      setImeiError(IMEI_ERROR_MESSAGES[local.error!]);
      return;
    }
    setImeiError(null);
    setBusy(true);
    try {
      const check = await api.checkImei(local.normalised);
      if (!check.valid) {
        setImeiError(check.reason ?? 'That IMEI does not look right.');
        return;
      }
      setDetectedModel(check.model ?? null);
      if (check.model && !model) setModel(check.model);
      setStep(3);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  async function placeOrder(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await api.createOrder({
        brand,
        network,
        imei: validateImei(imei).normalised,
        email,
        model: model || null,
        discount_code: discountCode.trim() || null,
      });
      setOrder(result.order);
      setPayment(result.payment);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  async function payNow() {
    if (!order) return;
    setError(null);
    setBusy(true);
    try {
      await api.confirmPayment(order.reference);
      navigate(`/tracking?ref=${order.reference}&email=${encodeURIComponent(email)}`);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  if (loadingCatalog) {
    return (
      <div className="container-page flex items-center justify-center py-32 text-[rgb(var(--ink-soft))]">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div className="container-page max-w-3xl py-10 sm:py-14">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          Unlock your phone
        </h1>
        <p className="mt-2 text-[rgb(var(--ink-soft))]">
          Four short steps. You only pay once we have confirmed the device and the price.
        </p>
      </header>

      <div className="mb-8">
        <Stepper steps={STEPS} current={step} />
      </div>

      {error && (
        <div className="mb-6">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      {/* Step 1 — brand */}
      {step === 0 && (
        <section className="card animate-rise p-6 sm:p-8">
          <h2 className="text-xl font-bold">Which phone are you unlocking?</h2>
          <p className="hint mb-5">Pick the manufacturer, not the model.</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {brands.map((b) => (
              <button
                key={b.slug}
                type="button"
                onClick={() => {
                  setBrand(b.slug);
                  setStep(1);
                }}
                className={`min-h-[64px] rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-all hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-md ${
                  brand === b.slug
                    ? 'border-brand-500 bg-brand-50 text-brand-800'
                    : 'border-[rgb(var(--line))] bg-white'
                }`}
              >
                {b.name}
                <span className="mt-0.5 block text-xs font-medium text-[rgb(var(--ink-soft))]">
                  {b.delivery_kind === 'remote' ? 'Remote unlock' : 'Unlock code'}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Step 2 — network */}
      {step === 1 && (
        <section className="card animate-rise p-6 sm:p-8">
          <h2 className="text-xl font-bold">Which network is it locked to?</h2>
          <p className="hint mb-5">
            The network it is locked to now — not the one you are moving to.
          </p>

          <Field label="Country" htmlFor="country">
            <select
              id="country"
              className="input"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              {countries.map((c) => (
                <option key={c.country_code} value={c.country_code}>
                  {c.country}
                </option>
              ))}
            </select>
          </Field>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {networksForCountry.map((n) => (
              <button
                key={n.slug}
                type="button"
                disabled={busy}
                onClick={() => goToImeiStep(n.slug)}
                className={`flex min-h-[56px] items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-all hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-md disabled:opacity-60 ${
                  network === n.slug
                    ? 'border-brand-500 bg-brand-50 text-brand-800'
                    : 'border-[rgb(var(--line))] bg-white'
                }`}
              >
                {n.name}
                <span aria-hidden="true" className="text-brand-500">
                  →
                </span>
              </button>
            ))}
          </div>

          <button type="button" onClick={() => setStep(0)} className="btn-ghost mt-6 px-0">
            ← Change phone brand
          </button>
        </section>
      )}

      {/* Step 3 — IMEI */}
      {step === 2 && quote && (
        <section className="card animate-rise p-6 sm:p-8">
          <h2 className="text-xl font-bold">Enter your IMEI</h2>
          <p className="hint mb-5">
            Dial <span className="font-mono font-bold">*#06#</span> on the phone, or find it
            under Settings → About.
          </p>

          <Field
            label="IMEI number"
            htmlFor="imei"
            error={imeiError}
            hint="15 digits. We check it before you pay."
          >
            <input
              id="imei"
              className={`input font-mono tracking-wider ${imeiError ? 'input-error' : ''}`}
              value={imei}
              onChange={(e) => {
                setImei(e.target.value);
                if (imeiError) setImeiError(null);
              }}
              inputMode="numeric"
              autoComplete="off"
              maxLength={20}
              placeholder="353261110006674"
              aria-invalid={Boolean(imeiError)}
            />
          </Field>

          {quote.requires_model && (
            <div className="mt-5">
              <Field
                label="Exact model"
                htmlFor="model"
                hint="For example: Moto G54 5G. We need this to route your unlock."
              >
                <input
                  id="model"
                  className="input"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="Model name"
                />
              </Field>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              className="btn-primary flex-1"
              onClick={confirmImei}
              disabled={busy}
            >
              {busy && <Spinner />}
              Check device and see price
            </button>
            <button type="button" className="btn-secondary" onClick={() => setStep(1)}>
              Back
            </button>
          </div>
        </section>
      )}

      {/* Step 4 — checkout */}
      {step === 3 && quote && (
        <section className="animate-rise space-y-5">
          <div className="card p-6 sm:p-8">
            <h2 className="text-xl font-bold">Your unlock</h2>

            {detectedModel && (
              <p className="mt-2 text-sm font-semibold text-emerald-700">
                Device recognised: {detectedModel}
              </p>
            )}

            <dl className="mt-5 divide-y divide-[rgb(var(--line))] text-sm">
              <Row label="Phone">{selectedBrand?.name ?? quote.brand}</Row>
              <Row label="Locked to">
                {quote.network} · {quote.country}
              </Row>
              <Row label="IMEI">
                <span className="font-mono">{validateImei(imei).normalised}</span>
              </Row>
              <Row label="Delivery">
                {quote.delivery_kind === 'remote'
                  ? 'Remote unlock — no code to enter'
                  : 'Unlock code sent by email'}
              </Row>
              <Row label="Typical time">{formatEta(quote.min_hours, quote.max_hours)}</Row>
              <Row label="Success rate">{Math.round(quote.success_rate * 100)}%</Row>
            </dl>

            <div className="mt-5 flex items-baseline justify-between rounded-xl bg-slate-50 px-4 py-4">
              <span className="text-sm font-semibold text-[rgb(var(--ink-soft))]">
                Total to pay
              </span>
              <span className="text-3xl font-extrabold tracking-tight">
                {formatMoney(
                  payment?.amount_cents ?? quote.price_cents,
                  payment?.currency ?? quote.currency,
                )}
              </span>
            </div>

            {payment?.discount && (
              <p className="mt-2 text-right text-sm font-semibold text-emerald-700">
                {payment.discount.code} applied — {payment.discount.percent_off}% off{' '}
                <span className="text-[rgb(var(--ink-soft))] line-through">
                  {formatMoney(payment.list_price_cents, payment.currency)}
                </span>
              </p>
            )}
          </div>

          {!order ? (
            <form className="card space-y-5 p-6 sm:p-8" onSubmit={placeOrder}>
              <Field
                label="Where should we send the unlock?"
                htmlFor="email"
                hint="Your code and receipt go here. Double-check it."
              >
                <input
                  id="email"
                  type="email"
                  required
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </Field>

              <Field label="Discount code (optional)" htmlFor="discount">
                <input
                  id="discount"
                  className="input uppercase"
                  value={discountCode}
                  onChange={(e) => setDiscountCode(e.target.value)}
                  placeholder="WELCOME10"
                  autoComplete="off"
                />
              </Field>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button type="submit" className="btn-primary flex-1" disabled={busy}>
                  {busy && <Spinner />}
                  Continue to payment
                </button>
                <button type="button" className="btn-secondary" onClick={() => setStep(2)}>
                  Back
                </button>
              </div>

              <p className="text-xs leading-relaxed text-[rgb(var(--ink-soft))]">
                By continuing you confirm you are the owner of this device and that it is not
                lost, stolen, or under an unpaid contract. If the network cannot unlock it, we
                refund you in full.
              </p>
            </form>
          ) : (
            <div className="card space-y-5 p-6 sm:p-8">
              <Alert tone="info">
                Order <span className="font-bold">{order.reference}</span> is reserved. Complete
                payment to send it to the network.
              </Alert>

              <div className="rounded-xl border border-dashed border-[rgb(var(--line))] p-4 text-sm text-[rgb(var(--ink-soft))]">
                This build runs a simulated payment provider, so no card details are collected
                and no money moves. Setting <span className="font-mono">PAYMENT_PROVIDER=stripe</span>{' '}
                swaps in real Stripe payment intents.
              </div>

              <button type="button" className="btn-primary w-full" onClick={payNow} disabled={busy}>
                {busy && <Spinner />}
                Pay {formatMoney(payment?.amount_cents ?? 0, payment?.currency)} and submit
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="text-[rgb(var(--ink-soft))]">{label}</dt>
      <dd className="text-right font-semibold">{children}</dd>
    </div>
  );
}
