import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const API = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '');

const roles = [
  'General Technical Interview',
  'Software Engineer',
  'Web Developer',
  'Data Analyst',
  'AI / ML Engineer',
  'Cybersecurity Analyst'
];

const levels = ['Junior', 'Mid-level', 'Senior'];

function getSavedUser() {
  try {
    return JSON.parse(localStorage.getItem('interviewai_user') || 'null');
  } catch {
    return null;
  }
}

function App() {
  // Authentication
  const [token, setToken] = useState(
    () => localStorage.getItem('interviewai_token') || ''
  );

  const [user, setUser] = useState(() => getSavedUser());
  const [authMode, setAuthMode] = useState('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const [theme, setTheme] = useState(
    () => localStorage.getItem('interviewai_theme') || 'dark'
  );

  // InterviewAI
  const [view, setView] = useState('home');
  const [role, setRole] = useState(roles[0]);
  const [level, setLevel] = useState(levels[0]);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [configured, setConfigured] = useState(null);

  const bottomRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('interviewai_theme', theme);
  }, [theme]);

  function toggleTheme() {
    setTheme(current => current === 'dark' ? 'light' : 'dark');
  }

  useEffect(() => {
    if (!showLogoutConfirm) return;

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setShowLogoutConfirm(false);
      }
    }

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showLogoutConfirm]);

  useEffect(() => {
    fetch(`${API}/api/health`)
      .then(r => r.json())
      .then(d => setConfigured(Boolean(d.aiConfigured)))
      .catch(() => setConfigured(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: 'smooth'
    });
  }, [messages, loading]);

  async function handleAuth(e) {
    e.preventDefault();

    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      setAuthError('Please enter your email and password.');
      return;
    }

    if (authMode === 'signup' && password.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }

    setAuthLoading(true);
    setAuthError('');

    try {
      const endpoint =
        authMode === 'signup'
          ? '/api/auth/signup'
          : '/api/auth/login';

      const response = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: cleanEmail,
          password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
          (authMode === 'signup'
            ? 'Could not create account.'
            : 'Could not log in.')
        );
      }

      localStorage.setItem(
        'interviewai_token',
        data.token
      );

      localStorage.setItem(
        'interviewai_user',
        JSON.stringify(data.user)
      );

      setToken(data.token);
      setUser(data.user);

      setEmail('');
      setPassword('');
      setAuthError('');
      setView('home');
    } catch (err) {
      setAuthError(
        err.message || 'Could not connect to the server.'
      );
    } finally {
      setAuthLoading(false);
    }
  }

  function switchAuthMode(mode) {
    setAuthMode(mode);
    setAuthError('');
    setPassword('');
  }

  function logout() {
    localStorage.removeItem('interviewai_token');
    localStorage.removeItem('interviewai_user');

    setToken('');
    setUser(null);
    setMessages([]);
    setQuestion('');
    setError('');
    setView('home');
    setShowLogoutConfirm(false);
  }

  function openAssistant(seed = '') {
    setView('assistant');

    if (seed) {
      setQuestion(seed);
    }

    setError('');
  }

  async function askQuestion(e) {
    e?.preventDefault();

    const text = question.trim();

    if (!text || loading) {
      return;
    }

    const previous = messages;

    setMessages([
      ...previous,
      {
        role: 'user',
        content: text
      }
    ]);

    setQuestion('');
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API}/api/ask`, {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },

        body: JSON.stringify({
          question: text,
          role,
          level,
          history: previous
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || 'Could not get an answer.'
        );
      }

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: data.answer
        }
      ]);

      setConfigured(true);
    } catch (err) {
      setError(
        err.message || 'Backend connection failed.'
      );
    } finally {
      setLoading(false);
    }
  }

  function newChat() {
    setMessages([]);
    setQuestion('');
    setError('');
    setView('assistant');
  }

  // ====================================================
  // LOGIN / SIGN UP SCREEN
  // ====================================================

  if (!token) {
    return (
      <div className="app-shell auth-shell">

        <header className="nav auth-nav">
          <button className="brand">
            <span className="brand-mark">I</span>
            InterviewAI
          </button>

          <button
            className="theme-toggle"
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>


        
        </header>

        <main className="auth-page">

          <section className="auth-intro">

            <div className="eyebrow">
              YOUR TECHNICAL INTERVIEW AI
            </div>

            <h1>
              Prepare smarter.
              <span> Interview better.</span>
            </h1>

            <p>
              Ask technical and interview questions and get
              clear, interview-ready answers personalized to
              your role and experience level.
            </p>

            <div className="auth-features">

              <div>
                <span>01</span>
                <p>Ask any interview question</p>
              </div>

              <div>
                <span>02</span>
                <p>Get AI-powered explanations</p>
              </div>

              <div>
                <span>03</span>
                <p>Prepare for your target role</p>
              </div>

            </div>

          </section>

          <section className="auth-card">

            <div className="auth-card-header">

              <div className="auth-icon">I</div>

              <h2>
                {authMode === 'login'
                  ? 'Welcome back'
                  : 'Create your account'}
              </h2>

              <p>
                {authMode === 'login'
                  ? 'Sign in to continue to InterviewAI.'
                  : 'Create an account to start preparing.'}
              </p>

            </div>

            <div className="auth-tabs">

              <button
                className={
                  authMode === 'signup' ? 'active' : ''
                }
                onClick={() =>
                  switchAuthMode('signup')
                }
                type="button"
              >
                Sign up
              </button>

              <button
                className={
                  authMode === 'login' ? 'active' : ''
                }
                onClick={() =>
                  switchAuthMode('login')
                }
                type="button"
              >
                Log in
              </button>

            </div>

            <form
              className="auth-form"
              onSubmit={handleAuth}
            >

              <label>
                Email address

                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e =>
                    setEmail(e.target.value)
                  }
                  autoComplete="email"
                  required
                />
              </label>

              <label>
                Password

                <input
                  type="password"
                  placeholder={
                    authMode === 'signup'
                      ? 'At least 6 characters'
                      : 'Enter your password'
                  }
                  value={password}
                  onChange={e =>
                    setPassword(e.target.value)
                  }
                  autoComplete={
                    authMode === 'login'
                      ? 'current-password'
                      : 'new-password'
                  }
                  required
                />
              </label>

              {authError && (
                <div className="error auth-error">
                  {authError}
                </div>
              )}

              <button
                className="primary auth-submit"
                disabled={authLoading}
              >
                {authLoading
                  ? 'Please wait...'
                  : authMode === 'login'
                  ? 'Log in'
                  : 'Create account'}
              </button>

            </form>

            <div className="auth-switch">

              {authMode === 'login'
                ? "Don't have an account?"
                : 'Already have an account?'}

              <button
                type="button"
                onClick={() =>
                  switchAuthMode(
                    authMode === 'login'
                      ? 'signup'
                      : 'login'
                  )
                }
              >
                {authMode === 'login'
                  ? 'Sign up'
                  : 'Log in'}
              </button>

            </div>

          </section>

        </main>

      
      </div>
    );
  }

  // ====================================================
  // MAIN APPLICATION
  // ====================================================

  return (
    <div className="app-shell">

      <header className="nav">

        <button
          className="brand"
          onClick={() => setView('home')}
        >
          <span className="brand-mark">I</span>
          InterviewAI
        </button>

        <div className="nav-actions">



          <span className="status">
            <span
              className={`status-dot ${
                configured === false ? 'offline' : ''
              }`}
            ></span>

            {configured === false
              ? 'AI setup needed'
              : 'AI assistant'}
          </span>

          <span className="user-email">
            {user?.email}
          </span>

          <button
            className="ghost"
            onClick={newChat}
          >
            New chat
          </button>

          <button
            className="logout-button"
            onClick={() => setShowLogoutConfirm(true)}
          >
            Log out
          </button>

          <button
            className="theme-toggle"
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>

        </div>

      </header>

      {view === 'home' && (
        <main className="home">

          <section className="hero">

            <div className="eyebrow">
              YOUR TECHNICAL INTERVIEW AI
            </div>

            <h1>
              Prepare with purpose.{' '}
              <span>Answer with confidence.</span>
            </h1>

            <p>
              Your AI interview preparation workspace.
              Choose your target role and experience level,
              ask what you need to master, and get focused,
              interview-ready guidance.
            </p>

            <div className="hero-actions">

              <button
                className="primary"
                onClick={() => openAssistant()}
              >
                Start preparing <span>→</span>
              </button>

              <span className="small-note">
                Signed in as {user?.email}
              </span>

            </div>

          </section>

          <section className="feature-grid">

            <article>
              <div className="icon">01</div>
              <h3>Focused preparation</h3>
              <p>
                Prepare around the topics and questions that
                matter for your target role.
              </p>
            </article>

            <article>
              <div className="icon">02</div>
              <h3>Role-aware guidance</h3>
              <p>
                Get explanations shaped around your selected
                role and experience level.
              </p>
            </article>

            <article>
              <div className="icon">03</div>
              <h3>Build real confidence</h3>
              <p>
                Ask follow-up questions until you can explain
                the concept clearly in an interview.
              </p>
            </article>

          </section>

        </main>
      )}

      {view === 'assistant' && (
        <main className="assistant-wrap">

          <aside className="context-panel panel">

            <div className="step-label">
              ANSWER CONTEXT
            </div>

            <h2>Set your interview context</h2>

            <p className="muted">
              InterviewAI adapts its depth, examples, and
              terminology to this context.
            </p>

            <label>
              Target role

              <select
                value={role}
                onChange={e =>
                  setRole(e.target.value)
                }
              >
                {roles.map(r => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>

            <label>
              Experience level

              <select
                value={level}
                onChange={e =>
                  setLevel(e.target.value)
                }
              >
                {levels.map(l => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </label>

            <div className="context-note">
              <strong>Tip</strong>

              <span>
                Ask follow-up questions like “give me an
                example” or “explain it more simply.”
              </span>
            </div>

          </aside>

          <section className="chat-panel panel">

            <div className="chat-head">

              <div className="chat-head-left">
                <button
                  className="back-button"
                  type="button"
                  onClick={() => setView('home')}
                  aria-label="Back to home"
                  title="Back to home"
                >
                  <span aria-hidden="true">←</span>
                </button>

                <div>
                  <div className="step-label">
                    INTERVIEWAI ASSISTANT
                  </div>

                  <h2>
                    What do you want to prepare?
                  </h2>
                </div>
              </div>

              <span className="role-chip">
                {role} · {level}
              </span>

            </div>

            <div className="chat-body">

              {messages.length === 0 && (
                <div className="empty-state">

                  <div className="ai-orb">AI</div>

                  <h3>
                    Ready for your {role} interview
                  </h3>

                  <p>
                    Ask a technical, conceptual, or interview
                    question. Your answer will be tailored to
                    the {level.toLowerCase()} level and the
                    role you selected.
                  </p>

                  <div className="context-note">
                    <strong>Personalized session</strong>
                    <span>
                      Change the role or experience level at any
                      time to adjust the depth and focus of the answer.
                    </span>
                  </div>

                </div>
              )}

              {messages.map((m, i) => (
                <div
                  className={`message-row ${m.role}`}
                  key={i}
                >

                  <div className="avatar">
                    {m.role === 'assistant'
                      ? 'AI'
                      : 'You'}
                  </div>

                  <div className="message-bubble">
                    {m.content}
                  </div>

                </div>
              ))}

              {loading && (
                <div className="message-row assistant">

                  <div className="avatar">AI</div>

                  <div className="message-bubble typing">
                    <i></i>
                    <i></i>
                    <i></i>
                  </div>

                </div>
              )}

              <div ref={bottomRef}></div>

            </div>

            {error && (
              <div className="error chat-error">
                {error}
              </div>
            )}

            {configured === false && (
              <div className="setup-banner">
                Add <code>GEMINI_API_KEY</code> to{' '}
                <code>backend/.env</code> and restart
                the backend to enable real AI answers.
              </div>
            )}

            <form
              className="composer"
              onSubmit={askQuestion}
            >

              <textarea
                value={question}
                onChange={e =>
                  setQuestion(e.target.value)
                }
                onKeyDown={e => {
                  if (
                    e.key === 'Enter' &&
                    !e.shiftKey
                  ) {
                    e.preventDefault();
                    askQuestion(e);
                  }
                }}
                placeholder={`Ask a ${role} interview question…`}
                rows="2"
              />

              <button
                className="send-button"
                disabled={
                  !question.trim() || loading
                }
                aria-label="Send question"
              >
                ↑
              </button>

            </form>

            <div className="composer-note">
              Enter to send · Shift + Enter for a new line
            </div>

          </section>

        </main>
      )}

      {showLogoutConfirm && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={e => {
            if (e.target === e.currentTarget) {
              setShowLogoutConfirm(false);
            }
          }}
        >
          <div
            className="logout-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-title"
          >
            <div className="logout-modal-icon">↗</div>

            <div className="logout-modal-copy">
              <h3 id="logout-title">Log out of InterviewAI?</h3>
              <p>
                You’ll need to sign in again to continue your
                interview preparation.
              </p>
            </div>

            <div className="logout-modal-actions">
              <button
                className="modal-cancel"
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Cancel
              </button>

              <button
                className="modal-logout"
                type="button"
                onClick={logout}
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

createRoot(
  document.getElementById('root')
).render(<App />);
