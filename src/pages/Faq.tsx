import { Link } from 'react-router-dom';

const SECTIONS = [
  {
    title: 'Before you order',
    items: [
      {
        q: 'What does a carrier unlock actually do?',
        a: 'It removes the restriction that ties your phone to one network, so it will accept a SIM from any operator. It does not touch your screen lock, your accounts, or your data.',
      },
      {
        q: 'Where do I find my IMEI?',
        a: 'Dial *#06# and it appears on screen. It is also under Settings → About phone on Android, Settings → General → About on iOS, and printed on the SIM tray or the original box.',
      },
      {
        q: 'Is this permanent?',
        a: 'Yes. The unlock is recorded against your IMEI in the network’s database, so it survives software updates, factory resets, and reselling the device.',
      },
      {
        q: 'Will it void my warranty?',
        a: 'No. There is no jailbreak, no root, and no software to install. The network authorises the unlock itself, which is why manufacturer support is unaffected.',
      },
    ],
  },
  {
    title: 'Payment and refunds',
    items: [
      {
        q: 'When am I charged?',
        a: 'After you confirm the device and the quoted price. The price shown is the price you pay — there is no second fee once processing starts.',
      },
      {
        q: 'What if the unlock fails?',
        a: 'You get a full automatic refund. If the network reports your IMEI as not found, or declines the request, our system refunds it without you having to ask.',
      },
      {
        q: 'How long do refunds take?',
        a: 'We release it immediately. Your bank then takes 5–10 business days to show it on the original payment method.',
      },
    ],
  },
  {
    title: 'Timing and delivery',
    items: [
      {
        q: 'How long does it take?',
        a: 'It depends on the network — anywhere from an hour to a few days. The exact window for your network is shown before you pay, and your order page tracks it live.',
      },
      {
        q: 'What do I actually receive?',
        a: 'Most Android handsets get a numeric unlock code by email. Apple devices are unlocked remotely, so there is no code — you just insert the new SIM and connect to Wi-Fi.',
      },
      {
        q: 'My code is not working.',
        a: 'Make sure a SIM from a different network is in the phone — the prompt only appears with a foreign SIM. If it still fails, contact us with your reference and we will re-check it with the network or refund you.',
      },
    ],
  },
  {
    title: 'What we will not do',
    items: [
      {
        q: 'Can you unlock a phone I am locked out of?',
        a: 'Not by bypassing the lock — those protect the device’s owner. But if it is your device, our Locked device help flow verifies your proof of purchase and takes your case to the manufacturer’s official recovery channel, which is the lawful way through. It is owner-verification, not a bypass.',
      },
      {
        q: 'Can you remove iCloud Activation Lock or Google FRP?',
        a: 'We never bypass them. Both are anti-theft features tied to an account, and only that account holder or the manufacturer (with proof of purchase) can clear them. If you are the owner, open a proof-of-ownership case and we will package your evidence and route it to Apple or Google for you.',
      },
      {
        q: 'What about a phone that is blacklisted, lost, or stolen?',
        a: 'The network will refuse it, and so do we. If a device turns out to be reported or blacklisted after you order, the request is declined and you are refunded.',
      },
      {
        q: 'My phone is still on contract or a payment plan.',
        a: 'Most networks will not release a device with a balance outstanding. Clear the account first — the unlock then goes through normally.',
      },
    ],
  },
];

export function Faq() {
  return (
    <div className="container-page max-w-3xl py-10 sm:py-14">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
        Questions, answered
      </h1>
      <p className="mt-2 text-[rgb(var(--ink-soft))]">
        The things people ask us most, including the ones where the answer is no.
      </p>

      <div className="mt-10 space-y-10">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="text-sm font-bold uppercase tracking-wide text-[rgb(var(--ink-soft))]">
              {section.title}
            </h2>
            <div className="mt-4 divide-y divide-[rgb(var(--line))] rounded-2xl border border-[rgb(var(--line))] bg-white">
              {section.items.map((item) => (
                <details key={item.q} className="group p-5 sm:p-6">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold">
                    {item.q}
                    <span
                      aria-hidden="true"
                      className="shrink-0 text-brand-500 transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-[rgb(var(--ink-soft))]">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="card mt-12 p-8 text-center">
        <h2 className="text-xl font-extrabold">Ready when you are</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-[rgb(var(--ink-soft))]">
          Check your device free, see the exact price for your network, and only pay if you
          want to go ahead.
        </p>
        <Link to="/unlock" className="btn-primary mt-6 px-8">
          Unlock my phone
        </Link>
      </div>
    </div>
  );
}
