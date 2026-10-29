import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { request } from './api';
import { readRecoveryLink } from './recovery';
export function ResetPassword() {
  const [recovery, setRecovery] = useState(() => readRecoveryLink(window.location.search, window.location.hash));
  const [message, setMessage] = useState(''), [error, setError] = useState(''), [loading, setLoading] = useState(false);
  useEffect(() => {
    const clearAddress = () => window.history.replaceState(null, '', window.location.pathname);
    const takeNewLink = () => {
      setRecovery(readRecoveryLink(window.location.search, window.location.hash));
      setMessage(''); setError(''); clearAddress();
    };
    clearAddress();
    window.addEventListener('hashchange', takeNewLink);
    return () => window.removeEventListener('hashchange', takeNewLink);
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if ('error' in recovery) return;
    setLoading(true); setError('');
    try {
      const form = new FormData(event.currentTarget);
      const result = await request<{message:string}>('/auth/password', { ...recovery, password:form.get('password') });
      setMessage(result.message); setRecovery({ error: '' });
    } catch (error) { setError((error as Error).message); }
    finally { setLoading(false); }
  }
  return <main className="login"><section className="login-form"><Link to="/admin/login">PATAG</Link><h1>Reset your password</h1>
    {message ? <p role="status">{message}</p> : 'error' in recovery ? <p role="alert">{recovery.error}</p> : <form onSubmit={submit}>
      <label>New password<input name="password" type="password" required minLength={15} maxLength={128} autoComplete="new-password" /></label>
      {error && <p role="alert" className="error">{error}</p>}<button className="primary" disabled={loading}>{loading?'Updating…':'Update password'}</button>
    </form>}<Link to="/admin/login">Return to sign in</Link></section></main>;
}
