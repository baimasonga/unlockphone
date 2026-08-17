import { config } from '../config.js';
import type { Order, PublicOrder } from '../../shared/types.js';
import { formatMoney } from '../../shared/money.js';

export interface Mail {
  to: string;
  subject: string;
  body: string;
}

/**
 * The console transport is the default so the whole order lifecycle is
 * observable in development without wiring an SMTP account. Swapping in a
 * real transport is a matter of implementing this one function.
 */
export async function sendMail(mail: Mail): Promise<void> {
  if (config.mailTransport === 'console') {
    console.log(
      `\n[mail] from=${config.mailFrom} to=${mail.to}\n[mail] subject: ${mail.subject}\n${mail.body}\n`,
    );
    return;
  }
  throw new Error(
    'SMTP transport is not configured. Set MAIL_TRANSPORT=console or implement sendMail.',
  );
}

export function orderConfirmationMail(order: Order, serviceName: string): Mail {
  return {
    to: order.email,
    subject: `Order ${order.reference} received`,
    body: [
      `We have your unlock request and it is on its way to the network.`,
      ``,
      `Reference: ${order.reference}`,
      `Service:   ${serviceName}`,
      `IMEI:      ${order.imei}`,
      `Paid:      ${formatMoney(order.price_cents, order.currency)}`,
      ``,
      `Track it any time at /tracking using your reference and email.`,
    ].join('\n'),
  };
}

export function orderDeliveredMail(order: PublicOrder): Mail {
  const instructions =
    order.delivery_kind === 'remote'
      ? [
          `Your device has been unlocked remotely — there is no code to enter.`,
          ``,
          `To finish: insert a SIM from the new network, then connect the phone`,
          `to Wi-Fi. If it still asks for a SIM PIN, back up and restore the`,
          `device in Finder or iTunes to pull the new activation record.`,
        ]
      : [
          `Your unlock code is: ${order.result_code}`,
          ``,
          `To use it: power the phone off, insert a SIM from the new network,`,
          `power it back on, and enter the code when prompted for a network or`,
          `unlock PIN. You usually get a limited number of attempts, so type it`,
          `carefully.`,
        ];

  return {
    to: order.email_masked,
    subject: `Your unlock for ${order.reference} is ready`,
    body: [`Good news — the network approved your unlock.`, ``, ...instructions].join('\n'),
  };
}

export function orderRefundedMail(order: Order, reason: string): Mail {
  return {
    to: order.email,
    subject: `Refund issued for ${order.reference}`,
    body: [
      `We could not complete your unlock, so we have refunded it in full.`,
      ``,
      `Reference: ${order.reference}`,
      `Reason:    ${reason}`,
      `Refunded:  ${formatMoney(order.price_cents, order.currency)}`,
      ``,
      `The money goes back to the original payment method, typically within`,
      `5-10 business days depending on your bank.`,
    ].join('\n'),
  };
}
