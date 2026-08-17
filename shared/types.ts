/** Domain types shared by the API server and the React client. */

export type OrderStatus =
  | 'awaiting_payment'
  | 'submitted'
  | 'in_progress'
  | 'delivered'
  | 'not_found'
  | 'rejected'
  | 'refunded'
  | 'cancelled';

/** Statuses from which an order can never move again. */
export const TERMINAL_STATUSES: readonly OrderStatus[] = [
  'delivered',
  'refunded',
  'cancelled',
];

/**
 * Legal transitions for an unlock order.
 *
 * `not_found` and `rejected` are failure states but not terminal: a failed
 * order is always refunded, either automatically by the worker or by an
 * admin, so money never sits with us for work we could not deliver.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  awaiting_payment: ['submitted', 'cancelled'],
  submitted: ['in_progress', 'delivered', 'not_found', 'rejected'],
  in_progress: ['delivered', 'not_found', 'rejected'],
  not_found: ['refunded'],
  rejected: ['refunded'],
  delivered: [],
  refunded: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

/** How the unlock is delivered to the customer once the supplier returns it. */
export type DeliveryKind = 'code' | 'remote';

export interface Brand {
  id: number;
  slug: string;
  name: string;
  /** Apple is unlocked remotely against the carrier whitelist; others get a code. */
  delivery_kind: DeliveryKind;
}

export interface Network {
  id: number;
  slug: string;
  name: string;
  country: string;
  country_code: string;
}

/**
 * A sellable unlock: one brand + one network, with its own price and SLA.
 * This is the row a customer actually buys.
 */
export interface Service {
  id: number;
  brand_id: number;
  network_id: number;
  name: string;
  /** Retail price in minor units (cents) to avoid float rounding on money. */
  price_cents: number;
  /** What we pay the supplier, in cents. Never exposed to customers. */
  cost_cents: number;
  currency: string;
  min_hours: number;
  max_hours: number;
  success_rate: number;
  active: number;
  requires_model: number;
}

export interface PublicService {
  id: number;
  name: string;
  brand: string;
  network: string;
  country: string;
  price_cents: number;
  currency: string;
  min_hours: number;
  max_hours: number;
  success_rate: number;
  delivery_kind: DeliveryKind;
  requires_model: boolean;
}

export interface Order {
  id: number;
  reference: string;
  user_id: number | null;
  email: string;
  service_id: number;
  imei: string;
  model: string | null;
  status: OrderStatus;
  price_cents: number;
  currency: string;
  /** Unlock code or remote-unlock confirmation, only set once delivered. */
  result_code: string | null;
  result_message: string | null;
  supplier_reference: string | null;
  /** Poll bookkeeping for the fulfilment worker; never sent to the client. */
  attempts: number;
  next_poll_at: string | null;
  created_at: string;
  updated_at: string;
  delivered_at: string | null;
}

export interface OrderEvent {
  id: number;
  order_id: number;
  status: OrderStatus;
  message: string;
  created_at: string;
}

export interface PublicOrder {
  reference: string;
  email_masked: string;
  status: OrderStatus;
  status_label: string;
  imei_masked: string;
  service: string;
  brand: string;
  network: string;
  price_cents: number;
  currency: string;
  model: string | null;
  result_code: string | null;
  result_message: string | null;
  delivery_kind: DeliveryKind;
  eta_hours: [number, number];
  created_at: string;
  delivered_at: string | null;
  events: Array<Pick<OrderEvent, 'status' | 'message' | 'created_at'>>;
}

export interface User {
  id: number;
  email: string;
  role: 'customer' | 'admin';
  created_at: string;
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  awaiting_payment: 'Awaiting payment',
  submitted: 'Submitted to network',
  in_progress: 'Processing',
  delivered: 'Unlock delivered',
  not_found: 'Not found in database',
  rejected: 'Rejected by network',
  refunded: 'Refunded',
  cancelled: 'Cancelled',
};
