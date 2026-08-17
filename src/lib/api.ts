import type {
  Brand,
  Network,
  PublicOrder,
  PublicService,
  User,
} from '../../shared/types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code = 'error',
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      credentials: 'same-origin',
      headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
      ...init,
    });
  } catch {
    // A network failure is the one error the server never gets to explain.
    throw new ApiError(0, 'Could not reach the server. Check your connection and try again.');
  }

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload.error ?? 'Something went wrong.',
      payload.code,
    );
  }
  return payload as T;
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });

export interface ImeiCheck {
  valid: boolean;
  reason?: string;
  imei?: string;
  tac?: string;
  brand_slug?: string | null;
  model?: string | null;
  recognised?: boolean;
}

export interface PaymentSummary {
  provider: string;
  reference: string;
  checkout_url: string | null;
  amount_cents: number;
  currency: string;
  list_price_cents: number;
  discount: { code: string; percent_off: number } | null;
}

export interface CountryGroup {
  country: string;
  country_code: string;
  networks: Network[];
}

export interface AdminOrder extends PublicOrder {
  email: string;
  imei: string;
  supplier_reference: string | null;
  attempts: number;
}

export interface AdminStats {
  orders: number;
  delivered: number;
  working: number;
  refunded: number;
  revenue_cents: number;
  margin_cents: number;
  by_network: Array<{ network: string; orders: number; delivered: number }>;
}

export const api = {
  brands: () => request<{ brands: Brand[] }>('/catalog/brands').then((r) => r.brands),

  networksByCountry: () =>
    request<{ countries: CountryGroup[] }>('/catalog/networks/grouped').then(
      (r) => r.countries,
    ),

  quote: (brand: string, network: string) =>
    request<{ service: PublicService }>(
      `/catalog/quote?brand=${encodeURIComponent(brand)}&network=${encodeURIComponent(network)}`,
    ).then((r) => r.service),

  priceFrom: (brand: string) =>
    request<{ price_cents: number; currency: string }>(`/catalog/brands/${brand}/price-from`),

  checkImei: (imei: string) => post<ImeiCheck>('/catalog/imei/check', { imei }),

  createOrder: (input: {
    brand: string;
    network: string;
    imei: string;
    email: string;
    model?: string | null;
    discount_code?: string | null;
  }) => post<{ order: PublicOrder; payment: PaymentSummary }>('/orders', input),

  confirmPayment: (reference: string) =>
    post<{ order: PublicOrder }>(`/orders/${reference}/confirm-payment`),

  track: (reference: string, email: string) =>
    post<{ order: PublicOrder }>('/orders/track', { reference, email }).then((r) => r.order),

  myOrders: () => request<{ orders: PublicOrder[] }>('/orders/mine').then((r) => r.orders),

  register: (email: string, password: string) =>
    post<{ user: User }>('/auth/register', { email, password }).then((r) => r.user),

  login: (email: string, password: string) =>
    post<{ user: User }>('/auth/login', { email, password }).then((r) => r.user),

  logout: () => post<{ ok: true }>('/auth/logout'),

  me: () => request<{ user: User }>('/auth/me').then((r) => r.user),

  admin: {
    stats: () => request<AdminStats>('/admin/stats'),
    orders: (params: { status?: string; q?: string } = {}) => {
      const search = new URLSearchParams();
      if (params.status) search.set('status', params.status);
      if (params.q) search.set('q', params.q);
      const suffix = search.toString() ? `?${search}` : '';
      return request<{ orders: AdminOrder[] }>(`/admin/orders${suffix}`).then((r) => r.orders);
    },
    poll: (reference: string) =>
      post<{ order: PublicOrder }>(`/admin/orders/${reference}/poll`).then((r) => r.order),
    refund: (reference: string, reason: string) =>
      post<{ order: PublicOrder }>(`/admin/orders/${reference}/refund`, { reason }).then(
        (r) => r.order,
      ),
    deliver: (reference: string, code: string) =>
      post<{ order: PublicOrder }>(`/admin/orders/${reference}/deliver`, { code }).then(
        (r) => r.order,
      ),
  },
};
