import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { Skeleton, StatusPill } from '../components/ui';
import { OrderDetail } from './Tracking';
import { formatMoney } from '../../shared/money';
import type { PublicOrder } from '../../shared/types';

export function Account() {
  const { user, loading } = useAuth();
  const [orders, setOrders] = useState<PublicOrder[] | null>(null);
  const [selected, setSelected] = useState<PublicOrder | null>(null);

  useEffect(() => {
    if (!user) return;
    api
      .myOrders()
      .then(setOrders)
      .catch(() => setOrders([]));
  }, [user]);

  if (loading) {
    return (
      <div className="container-page max-w-4xl py-14">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="mt-6 h-64" />
      </div>
    );
  }

  if (!user) return <Navigate to="/signin" replace />;

  return (
    <div className="container-page max-w-4xl py-10 sm:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Your orders</h1>
          <p className="mt-2 text-[rgb(var(--ink-soft))]">Signed in as {user.email}</p>
        </div>
        <Link to="/unlock" className="btn-primary">
          Unlock another phone
        </Link>
      </div>

      {!orders ? (
        <Skeleton className="mt-8 h-48" />
      ) : orders.length === 0 ? (
        <div className="card mt-8 p-10 text-center">
          <p className="text-lg font-bold">No orders yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-[rgb(var(--ink-soft))]">
            When you unlock a phone, it shows up here with its live status and code.
          </p>
          <Link to="/unlock" className="btn-primary mt-6">
            Unlock a phone
          </Link>
        </div>
      ) : selected ? (
        <div className="mt-8">
          <button type="button" className="btn-ghost px-0" onClick={() => setSelected(null)}>
            ← All orders
          </button>
          <OrderDetail order={selected} />
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {orders.map((order) => (
            <li key={order.reference}>
              <button
                type="button"
                onClick={() => setSelected(order)}
                className="card flex w-full flex-wrap items-center justify-between gap-4 p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="min-w-0">
                  <p className="font-mono text-sm font-bold">{order.reference}</p>
                  <p className="mt-1 truncate text-sm text-[rgb(var(--ink-soft))]">
                    {order.service}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-bold">
                    {formatMoney(order.price_cents, order.currency)}
                  </span>
                  <StatusPill status={order.status} label={order.status_label} />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
