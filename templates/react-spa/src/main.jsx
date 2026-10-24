import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { OktaAuth, toRelativeUrl } from '@okta/okta-auth-js';
import { Security, LoginCallback, useOktaAuth } from '@okta/okta-react';
import './styles.css';

// Router base: the configured BASE_PATH when the page is really served under it, else the
// path Mimic serves the app from (Mimic picks that URL, so an unrelated value cannot match).
const configured = (import.meta.env.VITE_BASE_PATH || '').replace(/\/$/, '');
const mimicPath = window.location.pathname.match(/^.*\/__mimic__\/[^/]+\/[^/]+\/\d+/);
const BASE = (
  configured && window.location.pathname.startsWith(configured)
    ? configured
    : (mimicPath && mimicPath[0]) || import.meta.env.BASE_URL
).replace(/\/$/, '');

const oktaAuth = new OktaAuth({
  issuer: import.meta.env.VITE_OKTA_ISSUER,
  clientId: import.meta.env.VITE_OKTA_CLIENT_ID,
  redirectUri: window.location.origin + BASE + '/login/callback',
  scopes: ['openid', 'profile', 'email'],
  pkce: true,
});

function Home() {
  const { authState, oktaAuth } = useOktaAuth();
  const [user, setUser] = React.useState(null);
  React.useEffect(() => {
    if (!authState?.isAuthenticated) return;
    // The token can be revoked from another tab (auth state syncs across tabs); treat that as signed out.
    oktaAuth.getUser().then(setUser).catch(() => setUser(null));
  }, [authState, oktaAuth]);

  if (!authState) return <p className="muted">Loading…</p>;
  if (authState.error) return <div className="error">{String(authState.error)}</div>;
  if (!authState.isAuthenticated)
    return (
      <>
        <p className="muted">You are signed out. Sign in to see the ID token claims.</p>
        <button className="btn" onClick={() => oktaAuth.signInWithRedirect()}>Sign in with Okta</button>
      </>
    );
  return (
    <>
      <div className="row">
        <span className="status"><span className="dot" /> Signed in{user?.email ? ` as ${user.email}` : ''}</span>
        <button className="btn secondary" onClick={() => oktaAuth.signOut()}>Sign out</button>
      </div>
      <pre>{JSON.stringify(user, null, 2)}</pre>
    </>
  );
}

function App() {
  const navigate = useNavigate();
  // BrowserRouter has a basename, so navigate with the path relative to it.
  const restoreOriginalUri = async (_oktaAuth, originalUri) => {
    const base = BASE;
    const rel = toRelativeUrl(originalUri || '/', window.location.origin);
    navigate(rel.startsWith(base) ? rel.slice(base.length) || '/' : rel, { replace: true });
  };
  return (
    <Security oktaAuth={oktaAuth} restoreOriginalUri={restoreOriginalUri}>
      <div className="shell">
        <div className="card">
          <span className="badge">@okta/okta-react</span>
          <h1>Okta React SDK</h1>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login/callback" element={<LoginCallback />} />
          </Routes>
        </div>
      </div>
    </Security>
  );
}

createRoot(document.getElementById('root')).render(
  <BrowserRouter basename={BASE}><App /></BrowserRouter>
);
