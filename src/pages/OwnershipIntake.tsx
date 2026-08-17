import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { Alert, Field, Spinner, Stepper } from '../components/ui';
import { validateImei, IMEI_ERROR_MESSAGES } from '../../shared/imei';
import { LOCK_TYPE_LABELS, type LockType } from '../../shared/ownership';

const STEPS = ['Lock type', 'Your device', 'Proof', 'Contact'] as const;

const LOCK_OPTIONS: Array<{ value: LockType; title: string; body: string }> = [
  {
    value: 'icloud_activation',
    title: 'iCloud Activation Lock',
    body: 'An iPhone or iPad asks for a previous owner’s Apple ID after reset.',
  },
  {
    value: 'google_frp',
    title: 'Google FRP lock',
    body: 'An Android phone asks for a Google account used on it before the reset.',
  },
  {
    value: 'screen_lock',
    title: 'Screen lock / passcode',
    body: 'You are locked out of your own device by a forgotten passcode or pattern.',
  },
];

/**
 * Proof-of-ownership intake. This does NOT bypass a lock — it collects proof
 * that the customer owns the device and routes a verified case to the party
 * (Apple, Google, or the maker) that can remove the lock officially.
 */
export function OwnershipIntake() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [step, setStep] = useState(0);
  const [lockType, setLockType] = useState<LockType | ''>(
    (params.get('lock') as LockType) ?? '',
  );
  const [imei, setImei] = useState(params.get('imei') ?? '');
  const [imeiError, setImeiError] = useState<string | null>(null);
  const [model, setModel] = useState('');
  const [fullName, setFullName] = useState('');
  const [purchaseInfo, setPurchaseInfo] = useState('');
  const [email, setEmail] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function next() {
    setError(null);
    if (step === 0 && !lockType) {
      setError('Tell us which lock you are dealing with.');
      return;
    }
    if (step === 1) {
      const local = validateImei(imei);
      if (!local.valid) {
        setImeiError(IMEI_ERROR_MESSAGES[local.error!]);
        return;
      }
      if (!fullName.trim()) {
        setError('Enter the name the device was purchased under.');
        return;
      }
      if (purchaseInfo.trim().length < 10) {
        setError('Add where and roughly when you bought it — this is the proof of ownership.');
        return;
      }
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list);
    const tooBig = incoming.find((f) => f.size > 8 * 1024 * 1024);
    if (tooBig) {
      setError(`${tooBig.name} is over 8 MB. Add a smaller photo or PDF.`);
      return;
    }
    setError(null);
    setFiles((prev) => [...prev, ...incoming].slice(0, 6));
  }

  async function submit() {
    if (!lockType) return;
    setError(null);
    setBusy(true);
    try {
      const created = await api.ownership.create({
        email,
        full_name: fullName,
        imei: validateImei(imei).normalised,
        lock_type: lockType,
        purchase_info: purchaseInfo,
        device_model: model || null,
      });

      // Upload proof after the case exists so each file has a reference.
      for (const file of files) {
        await api.ownership.uploadProof(created.reference, file);
      }

      navigate(
        `/case-tracking?ref=${created.reference}&email=${encodeURIComponent(email)}`,
      );
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-page max-w-3xl py-10 sm:py-14">
      <header className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          Locked device help
        </h1>
        <p className="mt-2 text-[rgb(var(--ink-soft))]">
          Screen locks, iCloud Activation Lock, and Google FRP protect a device’s owner, so
          they can only be removed by proving ownership to Apple, Google, or the maker. We
          verify your proof and take it to the right place for you.
        </p>
      </header>

      {/* This boundary is the whole point of the feature — state it plainly. */}
      <Alert tone="info">
        We never bypass a lock or defeat it with software. If a device is reported lost or
        stolen, or you cannot show you own it, we cannot help — and we will say so.
      </Alert>

      <div className="my-8">
        <Stepper steps={STEPS} current={step} />
      </div>

      {error && (
        <div className="mb-6">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      {step === 0 && (
        <section className="card animate-rise space-y-3 p-6 sm:p-8">
          <h2 className="text-xl font-bold">What are you locked out by?</h2>
          {LOCK_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setLockType(option.value);
                setStep(1);
              }}
              className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-md ${
                lockType === option.value
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-[rgb(var(--line))] bg-white'
              }`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  lockType === option.value
                    ? 'border-brand-600 bg-brand-600'
                    : 'border-slate-300'
                }`}
              >
                {lockType === option.value && (
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                )}
              </span>
              <span>
                <span className="block font-bold">{option.title}</span>
                <span className="mt-0.5 block text-sm text-[rgb(var(--ink-soft))]">
                  {option.body}
                </span>
              </span>
            </button>
          ))}
        </section>
      )}

      {step === 1 && (
        <section className="card animate-rise space-y-5 p-6 sm:p-8">
          <h2 className="text-xl font-bold">Your device and how you got it</h2>

          <Field label="IMEI" htmlFor="oc-imei" error={imeiError} hint="Dial *#06# to display it.">
            <input
              id="oc-imei"
              className={`input font-mono tracking-wider ${imeiError ? 'input-error' : ''}`}
              value={imei}
              onChange={(e) => {
                setImei(e.target.value);
                if (imeiError) setImeiError(null);
              }}
              inputMode="numeric"
              maxLength={20}
              placeholder="353261110006674"
            />
          </Field>

          <Field label="Model (optional)" htmlFor="oc-model">
            <input
              id="oc-model"
              className="input"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="iPhone 13 Pro"
            />
          </Field>

          <Field label="Full name on the purchase" htmlFor="oc-name">
            <input
              id="oc-name"
              className="input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="As it appears on the receipt"
              autoComplete="name"
            />
          </Field>

          <Field
            label="Where and when did you buy it?"
            htmlFor="oc-purchase"
            hint="Store or seller, rough date, and anything on the receipt. This is what proves ownership."
          >
            <textarea
              id="oc-purchase"
              className="input min-h-[96px] resize-y"
              value={purchaseInfo}
              onChange={(e) => setPurchaseInfo(e.target.value)}
              placeholder="e.g. Bought new from Verizon store, Chicago, around June 2023. Receipt in my name."
            />
          </Field>

          <div className="flex gap-3">
            <button type="button" className="btn-primary flex-1" onClick={next}>
              Continue
            </button>
            <button type="button" className="btn-secondary" onClick={() => setStep(0)}>
              Back
            </button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="card animate-rise space-y-5 p-6 sm:p-8">
          <h2 className="text-xl font-bold">Attach your proof of purchase</h2>
          <p className="text-sm text-[rgb(var(--ink-soft))]">
            A photo or PDF of the receipt, invoice, or contract in your name. This is what Apple,
            Google, or the maker require. You can add up to 6 files, 8 MB each.
          </p>

          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[rgb(var(--line))] bg-slate-50 px-6 py-10 text-center transition-colors hover:border-brand-400 hover:bg-brand-50/40">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 16V4m0 0 4 4m-4-4L8 8M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-sm font-semibold">Tap to add photos or a PDF</span>
            <input
              type="file"
              className="sr-only"
              multiple
              accept="image/*,application/pdf"
              onChange={(e) => addFiles(e.target.files)}
            />
          </label>

          {files.length > 0 && (
            <ul className="space-y-2">
              {files.map((file, index) => (
                <li
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between rounded-lg border border-[rgb(var(--line))] bg-white px-3 py-2 text-sm"
                >
                  <span className="truncate font-medium">{file.name}</span>
                  <button
                    type="button"
                    className="btn-ghost min-h-0 px-2 py-1 text-xs"
                    onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-3">
            <button type="button" className="btn-primary flex-1" onClick={() => setStep(3)}>
              Continue
            </button>
            <button type="button" className="btn-secondary" onClick={() => setStep(1)}>
              Back
            </button>
          </div>
        </section>
      )}

      {step === 3 && lockType && (
        <section className="card animate-rise space-y-5 p-6 sm:p-8">
          <h2 className="text-xl font-bold">Where should we reach you?</h2>

          <dl className="divide-y divide-[rgb(var(--line))] rounded-xl border border-[rgb(var(--line))] text-sm">
            <div className="flex justify-between gap-4 p-3">
              <dt className="text-[rgb(var(--ink-soft))]">Lock type</dt>
              <dd className="text-right font-semibold">{LOCK_TYPE_LABELS[lockType]}</dd>
            </div>
            <div className="flex justify-between gap-4 p-3">
              <dt className="text-[rgb(var(--ink-soft))]">IMEI</dt>
              <dd className="text-right font-mono font-semibold">
                {validateImei(imei).normalised}
              </dd>
            </div>
            <div className="flex justify-between gap-4 p-3">
              <dt className="text-[rgb(var(--ink-soft))]">Proof files</dt>
              <dd className="text-right font-semibold">{files.length}</dd>
            </div>
          </dl>

          <Field label="Email" htmlFor="oc-email" hint="We send case updates here.">
            <input
              id="oc-email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </Field>

          <p className="text-xs leading-relaxed text-[rgb(var(--ink-soft))]">
            By submitting you confirm you are the lawful owner of this device and that the
            evidence provided is genuine. Filing a false ownership claim is fraud.
          </p>

          <div className="flex gap-3">
            <button
              type="button"
              className="btn-primary flex-1"
              onClick={submit}
              disabled={busy || !email}
            >
              {busy && <Spinner />}
              Submit case
            </button>
            <button type="button" className="btn-secondary" onClick={() => setStep(2)}>
              Back
            </button>
          </div>
        </section>
      )}

      <p className="mt-8 text-center text-sm text-[rgb(var(--ink-soft))]">
        Already filed a case?{' '}
        <Link to="/case-tracking" className="font-semibold text-brand-700 hover:underline">
          Track it here
        </Link>
      </p>
    </div>
  );
}
