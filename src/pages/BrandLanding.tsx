import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { formatMoney } from '../../shared/money';

export interface BrandLandingProps {
  slug: string;
  name: string;
  headline: string;
  intro: string;
  method: string;
  steps: string[];
  faqs: Array<{ q: string; a: string }>;
}

/**
 * One component drives every brand landing page. The SEO copy differs per
 * brand, but the layout and the call to action deliberately do not.
 */
export function BrandLanding({
  slug,
  name,
  headline,
  intro,
  method,
  steps,
  faqs,
}: BrandLandingProps) {
  const [price, setPrice] = useState<{ price_cents: number; currency: string } | null>(null);

  useEffect(() => {
    api
      .priceFrom(slug)
      .then(setPrice)
      .catch(() => setPrice(null));
  }, [slug]);

  return (
    <>
      <section className="border-b border-[rgb(var(--line))] bg-white">
        <div className="container-page grid gap-10 py-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-20">
          <div>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              {headline}
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-[rgb(var(--ink-soft))]">
              {intro}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link to={`/unlock?brand=${slug}`} className="btn-primary sm:px-8">
                Unlock my {name}
              </Link>
              {price && (
                <p className="text-sm text-[rgb(var(--ink-soft))]">
                  From{' '}
                  <span className="text-lg font-extrabold text-[rgb(var(--ink))]">
                    {formatMoney(price.price_cents, price.currency)}
                  </span>{' '}
                  depending on your network
                </p>
              )}
            </div>
          </div>

          <div className="card p-6 sm:p-8">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[rgb(var(--ink-soft))]">
              How your {name} gets unlocked
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[rgb(var(--ink-soft))]">{method}</p>
            <ol className="mt-5 space-y-3">
              {steps.map((step, index) => (
                <li key={step} className="flex gap-3 text-sm">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                    {index + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="container-page py-16">
        <h2 className="text-2xl font-extrabold tracking-tight">
          {name} unlocking questions
        </h2>
        <div className="mt-6 divide-y divide-[rgb(var(--line))] rounded-2xl border border-[rgb(var(--line))] bg-white">
          {faqs.map((faq) => (
            <details key={faq.q} className="group p-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold">
                {faq.q}
                <span
                  aria-hidden="true"
                  className="text-brand-500 transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-[rgb(var(--ink-soft))]">
                {faq.a}
              </p>
            </details>
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <Link to={`/unlock?brand=${slug}`} className="btn-primary px-8">
            Start my {name} unlock
          </Link>
        </div>
      </section>
    </>
  );
}

export const IPHONE_CONTENT: BrandLandingProps = {
  slug: 'apple',
  name: 'iPhone',
  headline: 'Unlock your iPhone from any carrier',
  intro:
    'Apple unlocks are applied remotely against the carrier whitelist, so there is no code to type and nothing to install. Once it goes through, your iPhone accepts any SIM — permanently, and through every future iOS update.',
  method:
    'We submit your IMEI to the carrier that locked the device. When they approve it, the change is written to Apple’s activation servers and applied the next time your iPhone activates.',
  steps: [
    'Enter your IMEI — dial *#06# or open Settings → General → About.',
    'Choose the carrier the iPhone is currently locked to.',
    'Pay the fixed price shown for your exact carrier.',
    'Insert the new SIM and connect to Wi-Fi to pull the unlock.',
  ],
  faqs: [
    {
      q: 'Will this survive an iOS update?',
      a: 'Yes. The unlock lives in Apple’s activation database against your IMEI, not on the phone, so updates and factory resets cannot undo it.',
    },
    {
      q: 'Does it void my warranty?',
      a: 'No. Nothing is installed and nothing is jailbroken — the carrier authorises the unlock through official channels, so Apple support and AppleCare are unaffected.',
    },
    {
      q: 'How will I know it worked?',
      a: 'Your order page updates to “delivered” and you get an email. Insert a SIM from another network and connect to Wi-Fi; if it still asks for a SIM PIN, back up and restore in Finder or iTunes.',
    },
    {
      q: 'Can you remove an iCloud activation lock?',
      a: 'No, and we will not take that order. Activation Lock is Apple’s anti-theft protection and can only be cleared by the Apple ID owner or by Apple with proof of purchase. Carrier unlocking is a different thing entirely.',
    },
    {
      q: 'My iPhone is still on a contract or instalment plan.',
      a: 'The carrier will decline it, and we will refund you automatically. Settle the balance first, then order — it goes through cleanly once the account is clear.',
    },
  ],
};

export const SAMSUNG_CONTENT: BrandLandingProps = {
  slug: 'samsung',
  name: 'Samsung',
  headline: 'Unlock your Samsung Galaxy with an official code',
  intro:
    'Samsung handsets unlock with a network code (NCK) issued by the carrier that locked them. We fetch yours and email it over — you type it in once and the phone is free for good.',
  method:
    'Your IMEI goes to the network’s code database. They return the unique NCK generated for that specific handset, which we pass straight on to you.',
  steps: [
    'Enter your IMEI — dial *#06# or check Settings → About phone.',
    'Choose the network the Galaxy is locked to.',
    'Pay the fixed price and we submit the request.',
    'Insert the new SIM, then enter the code when prompted.',
  ],
  faqs: [
    {
      q: 'What if the phone never asks for a code?',
      a: 'Insert a SIM from a different network first — the prompt only appears with a foreign SIM in. If it still does not show, dial *#7465625# to check the lock status, and contact us with a screenshot.',
    },
    {
      q: 'How many attempts do I get?',
      a: 'Usually eight to ten before the counter locks out. Type the code carefully. If the counter is already at zero when you order, tell us — a hard-locked handset needs a different service.',
    },
    {
      q: 'Is my data affected?',
      a: 'No. Entering an unlock code changes a network flag only. Your apps, photos, and settings are untouched.',
    },
    {
      q: 'Can you bypass a Google FRP lock or a forgotten PIN?',
      a: 'No. FRP and screen locks protect the owner of the device and we do not remove them. Sign in with the Google account already on the phone, or take proof of purchase to a Samsung service centre.',
    },
  ],
};
