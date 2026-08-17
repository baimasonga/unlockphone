import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { Alert, Field, Spinner } from '../components/ui';
import type { ApiError } from '../lib/api';

export function SignIn() {
  return <AuthForm mode="signin" />;
}

export function SignUp() {
  return <AuthForm mode="signup" />;
}

function AuthForm({ mode }: { mode: 'signin' | 'signup' }) {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isSignUp = mode === 'signup';

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (isSignUp) await signUp(email, password);
      else await signIn(email, password);
      navigate('/account');
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-page max-w-md py-14 sm:py-20">
      <h1 className="text-3xl font-extrabold tracking-tight">
        {isSignUp ? 'Create an account' : 'Sign in'}
      </h1>
      <p className="mt-2 text-[rgb(var(--ink-soft))]">
        {isSignUp
          ? 'Keep every unlock you order in one place. Orders you already placed with this email are pulled in automatically.'
          : 'Access your unlock history and codes.'}
      </p>

      <form className="card mt-8 space-y-5 p-6 sm:p-8" onSubmit={submit}>
        {error && <Alert tone="error">{error}</Alert>}

        <Field label="Email" htmlFor="email">
          <input
            id="email"
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          hint={isSignUp ? 'At least 8 characters.' : undefined}
        >
          <input
            id="password"
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            minLength={isSignUp ? 8 : undefined}
            required
          />
        </Field>

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy && <Spinner />}
          {isSignUp ? 'Create account' : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[rgb(var(--ink-soft))]">
        {isSignUp ? 'Already have an account? ' : 'No account yet? '}
        <Link
          to={isSignUp ? '/signin' : '/signup'}
          className="font-semibold text-brand-700 hover:underline"
        >
          {isSignUp ? 'Sign in' : 'Create one'}
        </Link>
      </p>

      <p className="mt-4 text-center text-xs text-[rgb(var(--ink-soft))]">
        You do not need an account to order — guest checkout works fine, and you can track
        with your reference.
      </p>
    </div>
  );
}
