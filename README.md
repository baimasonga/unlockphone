# UnlockWave

A working clone of a carrier-unlock SaaS, modelled on [mobileunlocks.com](https://mobileunlocks.com/):
customers submit an IMEI, pay a fixed price for their brand + network, and the system
places the request with a wholesale unlock supplier, tracks it to completion, and delivers
the code — refunding automatically when the network says no.

The business logic is real. Payments and the supplier API ship with local simulators so the
whole lifecycle runs offline, and both swap to live providers through environment variables.

## Quick start

```bash
npm install
cp .env.example .env
npm run dev          # API on :8787, client on :5173
```

Open http://localhost:5173. The database seeds itself on first boot with 12 brands,
25 networks, 300 priced services, and an admin account (`admin@example.com` / `admin12345`
— change it).

For a production-style run against the built client on a single origin:

```bash
npm run build && npm start   # everything on :8787
```

## Try the whole flow

The mock supplier decides outcomes from the IMEI's last three digits, so every path is
reproducible:

| IMEI | What happens |
| --- | --- |
| `353261110006674` | Delivers an unlock code after ~8s |
| `353261110004000` | Network reports "not found" → automatic full refund |
| `353261110002111` | Network rejects it → automatic full refund |

Walk it: enter the IMEI on the home page → free device check identifies it from the TAC →
pick network → pay (`WELCOME10` takes 10% off) → the tracking page polls itself until the
code lands.

## How it works

```
React SPA ──► Express API ──► SQLite
                  │
                  ├─► payment provider   (mock | stripe)
                  └─► unlock supplier    (mock | dhru)
                        ▲
              fulfilment worker polls every 5s
```

**Order lifecycle.** Every order moves through an explicit state machine
(`shared/types.ts`). Illegal transitions throw rather than silently corrupting state, so a
late supplier callback cannot resurrect a refunded order, and nothing reaches `delivered`
without passing through payment.

```
awaiting_payment → submitted → in_progress → delivered
                                     ├─► not_found ─► refunded
                                     └─► rejected  ─► refunded
```

**Failure means refund.** When the supplier reports `not_found` or `rejected`, the worker
refunds in the same pass — the money-back promise is enforced in code, not left to a support
agent. The same applies when a supplier goes silent past the retry ceiling.

**IMEI validation happens before payment.** `shared/imei.ts` runs the Luhn checksum locally,
strips separators, handles 16/17-digit IMEISV, and looks the TAC up to name the handset. A
typo never costs a supplier lookup or a customer's money.

**Prices are resolved server-side.** The client sends a brand and network slug, never a
price. Discounts round in the customer's favour.

**Codes are withheld until delivery.** `toPublicOrder` only exposes `result_code` when the
order is actually `delivered`, so a guessed reference reveals nothing — and tracking needs
the reference *and* the order email.

## Layout

```
shared/     Domain logic used by both sides: IMEI, money, order state machine
server/
  db/       Schema, seed catalog (brands, networks, pricing, TACs)
  lib/      Auth, errors, rate limiting, mail
  routes/   catalog · auth · orders · admin
  services/ catalog · orders · payments · supplier · fulfilment worker
src/
  pages/    Home · Unlock wizard · Tracking · NetworkCheck · Networks ·
            BrandLanding · Auth · Account · Admin · FAQ
  lib/      API client, auth context
```

## Swapping in real providers

Everything is behind an interface; changing provider is a config change.

**Payments** — set `PAYMENT_PROVIDER=stripe` and `STRIPE_SECRET_KEY`. The Stripe adapter
creates payment intents and issues refunds against the live API.

**Supplier** — set `SUPPLIER_PROVIDER=dhru` plus `DHRU_API_URL`, `DHRU_USERNAME`,
`DHRU_API_KEY`. DHRU Fusion is the standard wholesale unlock API; the adapter implements
`placeimeiorder` and `getimeiorder`. To use a different supplier, implement the two-method
`Supplier` interface in `server/services/supplier.ts`.

**Email** — `sendMail` in `server/lib/mail.ts` logs to the console by default. Point it at
any transport.

**TAC database** — `tac_models` ships with a small sample. Production would sync the full
GSMA allocation list into that table; nothing else changes.

## Tests

```bash
npm test        # 38 tests
npm run typecheck
```

Coverage is aimed at the rules that cost money when wrong: IMEI checksum and masking,
discount rounding, the order state machine's illegal transitions, duplicate-order
prevention, and the guarantee that an unlock code cannot leak before delivery.

## Scope

This builds **carrier unlocking** — freeing a phone you own to work on other networks,
through the official carrier and manufacturer databases. It deliberately does not do
screen-lock bypass, Google FRP removal, or iCloud Activation Lock removal; those protect a
device's owner, and the product copy says so plainly on the home page and FAQ rather than
leaving customers to find out after paying.

## Notes on this build

- SQLite keeps it single-file and dependency-free. The data access is plain SQL behind a
  service layer, so moving to Postgres is a driver change.
- The fulfilment worker runs in-process on a timer. At real volume this belongs in a
  separate process with a proper queue — the `dueOrders`/`processOrder` split is already
  shaped for that.
- Rate limiting is in-memory, which is correct for one node and needs Redis for several.
- The server refuses to boot in production without `JWT_SECRET` set.
