import { useEffect } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Unlock } from './pages/Unlock';
import { Tracking } from './pages/Tracking';
import { NetworkCheck } from './pages/NetworkCheck';
import { Networks } from './pages/Networks';
import { Faq } from './pages/Faq';
import { SignIn, SignUp } from './pages/Auth';
import { Account } from './pages/Account';
import { Admin } from './pages/Admin';
import { BrandLanding, IPHONE_CONTENT, SAMSUNG_CONTENT } from './pages/BrandLanding';

/** Routers do not reset scroll on navigation; this does. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function NotFound() {
  return (
    <div className="container-page max-w-lg py-24 text-center">
      <p className="text-sm font-bold uppercase tracking-widest text-brand-600">404</p>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight">This page moved on</h1>
      <p className="mt-3 text-[rgb(var(--ink-soft))]">
        The link is broken or the page no longer exists. Everything still works from here.
      </p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Link to="/unlock" className="btn-primary">
          Unlock a phone
        </Link>
        <Link to="/tracking" className="btn-secondary">
          Track an order
        </Link>
      </div>
    </div>
  );
}

export function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="/unlock" element={<Unlock />} />
          <Route path="/unlock-phone" element={<Unlock />} />
          <Route path="/unlock-iphone" element={<BrandLanding {...IPHONE_CONTENT} />} />
          <Route path="/unlock-samsung" element={<BrandLanding {...SAMSUNG_CONTENT} />} />
          <Route path="/network-check" element={<NetworkCheck />} />
          <Route path="/networks" element={<Networks />} />
          <Route path="/tracking" element={<Tracking />} />
          <Route path="/faq" element={<Faq />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/account" element={<Account />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  );
}
