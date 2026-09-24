import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const API = 'http://localhost:3000';
const roles = ['General Technical Interview', 'Software Engineer', 'Web Developer', 'Data Analyst', 'AI / ML Engineer', 'Cybersecurity Analyst'];
const levels = ['Junior', 'Mid-level', 'Senior'];
const suggestions = [
  'What is the difference between SQL and NoSQL?',
  'Explain REST APIs in a simple way.',
  'What is overfitting and how can I prevent it?',
  'How should I answer “Tell me about yourself”?'
];

function App() {
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
    fetch(`${API}/api/health`).then(r => r.json()).then(d => setConfigured(Boolean(d.aiConfigured))).catch(() => setConfigured(false));
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  function openAssistant(seed = '') {
    setView('assistant');
    if (seed) setQuestion(seed);
    setError('');
  }

  async function askQuestion(e) {
    e?.preventDefault();
    const text = question.trim();
    if (!text || loading) return;

    const previous = messages;
    setMessages([...previous, { role: 'user', content: text }]);
    setQuestion('');
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API}/api/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text, role, level, history: previous })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not get an answer.');
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
      setConfigured(true);
    } catch (err) {
      setError(err.message || 'Backend connection failed.');
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

  return <div className="app-shell">
    <header className="nav">
      <button className="brand" onClick={() => setView('home')}><span className="brand-mark">I</span>InterviewAI</button>
      <div className="nav-actions">
        <span className="status"><span className={`status-dot ${configured === false ? 'offline' : ''}`}></span>{configured === false ? 'AI setup needed' : 'AI assistant'}</span>
        <button className="ghost" onClick={newChat}>New chat</button>
      </div>
    </header>

    {view === 'home' && <main className="home">
      <section className="hero">
        <div className="eyebrow">YOUR TECHNICAL INTERVIEW AI</div>
        <h1>Ask interview questions. <span>Get clear answers.</span></h1>
        <p>Use InterviewAI as your personal interview coach. Ask any technical or common interview question and get an interview-ready explanation, example, and practical tip.</p>
        <div className="hero-actions">
          <button className="primary" onClick={() => openAssistant()}>Ask InterviewAI <span>→</span></button>
          <span className="small-note">No account required</span>
        </div>
      </section>
      <section className="feature-grid">
        <article><div className="icon">01</div><h3>You ask the questions</h3><p>Ask exactly what you want to understand before your interview.</p></article>
        <article><div className="icon">02</div><h3>AI explains clearly</h3><p>Get focused answers adapted to your target role and experience level.</p></article>
        <article><div className="icon">03</div><h3>Prepare faster</h3><p>Follow up on any answer until the concept is completely clear.</p></article>
      </section>
    </main>}

    {view === 'assistant' && <main className="assistant-wrap">
      <aside className="context-panel panel">
        <div className="step-label">ANSWER CONTEXT</div>
        <h2>Personalize your answers</h2>
        <p className="muted">This only changes how InterviewAI explains the answer.</p>
        <label>Target role<select value={role} onChange={e => setRole(e.target.value)}>{roles.map(r => <option key={r}>{r}</option>)}</select></label>
        <label>Experience level<select value={level} onChange={e => setLevel(e.target.value)}>{levels.map(l => <option key={l}>{l}</option>)}</select></label>
        <div className="context-note"><strong>Tip</strong><span>Ask follow-up questions like “give me an example” or “explain it more simply.”</span></div>
      </aside>

      <section className="chat-panel panel">
        <div className="chat-head"><div><div className="step-label">INTERVIEWAI ASSISTANT</div><h2>What do you want to prepare?</h2></div><span className="role-chip">{level}</span></div>

        <div className="chat-body">
          {messages.length === 0 && <div className="empty-state">
            <div className="ai-orb">AI</div>
            <h3>Ask me any interview question</h3>
            <p>I can explain technical concepts, help with common HR questions, or show you how to structure a strong interview answer.</p>
            <div className="suggestion-grid">{suggestions.map(s => <button key={s} onClick={() => setQuestion(s)}>{s}<span>↗</span></button>)}</div>
          </div>}

          {messages.map((m, i) => <div className={`message-row ${m.role}`} key={i}>
            <div className="avatar">{m.role === 'assistant' ? 'AI' : 'You'}</div>
            <div className="message-bubble">{m.content}</div>
          </div>)}
          {loading && <div className="message-row assistant"><div className="avatar">AI</div><div className="message-bubble typing"><i></i><i></i><i></i></div></div>}
          <div ref={bottomRef}></div>
        </div>

        {error && <div className="error chat-error">{error}</div>}
        {configured === false && <div className="setup-banner">Add <code>GEMINI_API_KEY</code> to <code>backend/.env</code> and restart the backend to enable real AI answers.</div>}
        <form className="composer" onSubmit={askQuestion}>
          <textarea value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); askQuestion(e); } }} placeholder="Ask an interview question…" rows="2" />
          <button className="send-button" disabled={!question.trim() || loading} aria-label="Send question">↑</button>
        </form>
        <div className="composer-note">Enter to send · Shift + Enter for a new line</div>
      </section>
    </main>}

    <footer>InterviewAI · Focused interview Q&A assistant</footer>
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
