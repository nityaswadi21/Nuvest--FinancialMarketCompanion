import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'

// ─── Content (unchanged) ─────────────────────────────────────────────────────

const stats = [
  { value: '190M+', label: 'Thin-file Indians' },
  { value: '₹0',    label: 'Formal credit history' },
  { value: '0.3s',  label: 'Score generation time' },
]

const problems = [
  {
    icon: '🏦',
    title: 'Banks reject thin-file users',
    body:  'Over 190 million Indians lack a formal credit history, making them invisible to traditional lenders.',
  },
  {
    icon: '📊',
    title: 'Alternative data is untapped',
    body:  'UPI transactions, utility bills, and rent patterns reveal creditworthiness — but banks ignore them.',
  },
  {
    icon: '🔍',
    title: 'No transparency in scoring',
    body:  'Even when scores exist, users have no idea why. Our SHAP-powered explanations change that.',
  },
]

// ─── Dashboard preview mockup ─────────────────────────────────────────────────

function DashboardMockup() {
  const holdings = [
    { sym: 'INFY',      price: '₹1,567',  pnl: '+₹2,209', pct: '+10.4%', pos: true  },
    { sym: 'TCS',       price: '₹3,485',  pnl: '+₹2,204', pct: '+8.6%',  pos: true  },
    { sym: 'HDFCBANK',  price: '₹1,698',  pnl: '+₹3,166', pct: '+10.3%', pos: true  },
    { sym: 'RELIANCE',  price: '₹2,612',  pnl: '-₹2,010', pct: '-6.0%',  pos: false },
    { sym: 'BAJFINANCE',price: '₹7,145',  pnl: '+₹4,725', pct: '+15.2%', pos: true  },
    { sym: 'WIPRO',     price: '₹445',    pnl: '-₹1,044', pct: '-7.3%',  pos: false },
  ]

  return (
    <div style={{
      background: '#0f0f0f',
      borderRadius: 16,
      overflow: 'hidden',
      border: '1px solid #1f1f1f',
      boxShadow: '0 40px 80px rgba(0,0,0,0.4)',
      fontFamily: 'Inter, sans-serif',
      userSelect: 'none',
      pointerEvents: 'none',
    }}>
      {/* Mock nav bar */}
      <div style={{ background: '#0a0a0a', borderBottom: '1px solid #1a1a1a', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: '#1A6B5A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>C</div>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Nuvest</span>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          {['Portfolio', 'Score', 'Dashboard'].map(t => (
            <span key={t} style={{ fontSize: 11, color: '#555' }}>{t}</span>
          ))}
        </div>
      </div>

      <div style={{ padding: '20px 20px 24px' }}>
        {/* Overview cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Current Value', value: '₹2,12,880', color: '#fff' },
            { label: 'Total P&L',     value: '+₹9,832',   color: '#34d399' },
            { label: "Today's Change",value: '+₹416',      color: '#34d399' },
            { label: 'Credit Score',  value: '712',        color: '#60a5fa' },
          ].map(c => (
            <div key={c.label} style={{ background: '#161616', borderRadius: 10, padding: '10px 12px', border: '1px solid #1f1f1f' }}>
              <div style={{ fontSize: 9, color: '#555', marginBottom: 4 }}>{c.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: c.color }}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* Holdings table */}
        <div style={{ background: '#111', borderRadius: 10, border: '1px solid #1f1f1f', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', padding: '8px 14px', borderBottom: '1px solid #1a1a1a' }}>
            {['Symbol', 'Price', 'P&L', 'AI Rec'].map(h => (
              <span key={h} style={{ fontSize: 9, color: '#444', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
            ))}
          </div>
          {holdings.map((h, i) => (
            <div key={h.sym} style={{
              display: 'grid',
              gridTemplateColumns: '1.5fr 1fr 1fr 1fr',
              padding: '9px 14px',
              borderBottom: i < holdings.length - 1 ? '1px solid #151515' : 'none',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#e5e5e5' }}>{h.sym}</span>
              <span style={{ fontSize: 11, color: '#888' }}>{h.price}</span>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: h.pos ? '#34d399' : '#f87171' }}>{h.pnl}</div>
                <div style={{ fontSize: 9, color: h.pos ? '#059669' : '#dc2626' }}>{h.pct}</div>
              </div>
              <span style={{
                display: 'inline-block',
                fontSize: 9,
                fontWeight: 600,
                padding: '2px 7px',
                borderRadius: 20,
                background: h.pos ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)',
                color: h.pos ? '#34d399' : '#f87171',
                border: `1px solid ${h.pos ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
              }}>
                {h.pos ? 'Hold' : 'Sell'}
              </span>
            </div>
          ))}
        </div>

        {/* AI insight strip */}
        <div style={{ marginTop: 14, background: 'rgba(26,107,90,0.1)', border: '1px solid rgba(26,107,90,0.25)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: '#1A6B5A' }}>✦</span>
          <span style={{ fontSize: 10, color: '#6b9e95' }}>Portfolio is well-diversified across IT, Finance, and Energy. Consider trimming WIPRO on the next rally.</span>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Landing() {
  const navigate  = useNavigate()
  const [announcementVisible, setAnnouncementVisible] = useState(true)
  const [dashOpacity, setDashOpacity] = useState(0.15)
  const [dashBlur,    setDashBlur]    = useState(14)
  const heroRef = useRef(null)

  // Scroll reveal: dashboard preview fades in as user scrolls
  useEffect(() => {
    const handleScroll = () => {
      const scrollY   = window.scrollY
      const maxScroll = 500
      const progress  = Math.min(scrollY / maxScroll, 1)
      setDashOpacity(0.15 + 0.85 * progress)
      setDashBlur(14 - 14 * progress)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div style={{ background: '#FAFAF8', color: '#0A0A0A', minHeight: '100vh', overflowX: 'hidden' }}>

      {/* ── Announcement bar ─────────────────────────────────────────────── */}
      {announcementVisible && (
        <div style={{ background: '#0A0A0A', color: '#fff', fontSize: 13, textAlign: 'center', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, position: 'relative' }}>
          <span>Nuvest now supports Upstox portfolio sync</span>
          <span style={{ color: '#1A6B5A', fontWeight: 600 }}>→</span>
          <button
            onClick={() => setAnnouncementVisible(false)}
            style={{ position: 'absolute', right: 16, background: 'none', border: 'none', color: '#666', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* ── Navbar ───────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(250,250,248,0.85)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(10,10,10,0.08)',
        padding: '0 24px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Playfair Display, Georgia, serif', fontWeight: 600, fontSize: 18, color: '#0A0A0A' }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: '#1A6B5A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 12, color: '#fff' }}>C</div>
          Nuvest
        </div>

        {/* Center links */}
        <div style={{ display: 'flex', gap: 32, position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
          <a href="#how-it-works" style={{ fontSize: 14, color: '#6B7280', textDecoration: 'none', fontWeight: 500 }}
            onMouseOver={e => e.target.style.color = '#0A0A0A'}
            onMouseOut={e  => e.target.style.color = '#6B7280'}
          >How it works</a>
          <a href="#problem" style={{ fontSize: 14, color: '#6B7280', textDecoration: 'none', fontWeight: 500 }}
            onMouseOver={e => e.target.style.color = '#0A0A0A'}
            onMouseOut={e  => e.target.style.color = '#6B7280'}
          >Problem</a>
          <button onClick={() => navigate('/portfolio')} style={{ fontSize: 14, color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, fontFamily: 'Inter, sans-serif' }}
            onMouseOver={e => e.target.style.color = '#0A0A0A'}
            onMouseOut={e  => e.target.style.color = '#6B7280'}
          >Portfolio</button>
        </div>

        {/* Right CTAs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => navigate('/demo')}
            style={{ fontSize: 13, color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 500, padding: '6px 12px' }}
            onMouseOver={e => e.target.style.color = '#0A0A0A'}
            onMouseOut={e  => e.target.style.color = '#6B7280'}
          >
            Sign in
          </button>
          <button
            onClick={() => navigate('/demo')}
            style={{ fontSize: 13, fontWeight: 600, color: '#fff', background: '#0A0A0A', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'background 0.15s' }}
            onMouseOver={e => e.currentTarget.style.background = '#1A6B5A'}
            onMouseOut={e  => e.currentTarget.style.background = '#0A0A0A'}
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section ref={heroRef} style={{ position: 'relative', paddingTop: 80, paddingBottom: 0, textAlign: 'center', overflow: 'hidden' }}>

        {/* Subtle teal radial glow */}
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 700, height: 400, background: 'radial-gradient(ellipse at center, rgba(26,107,90,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 2, maxWidth: 760, margin: '0 auto', padding: '0 24px' }}>
          {/* Pill badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 100, border: '1px solid rgba(26,107,90,0.3)', background: 'rgba(26,107,90,0.06)', marginBottom: 32 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1A6B5A', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: 13, color: '#1A6B5A', fontWeight: 500 }}>AI-Powered Financial Inclusion</span>
          </div>

          {/* Main heading — serif */}
          <h1 style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 'clamp(40px, 6vw, 72px)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em', color: '#0A0A0A', marginBottom: 24 }}>
            AI-powered wealth,{' '}
            <span style={{ display: 'block', color: '#1A6B5A' }}>built for every Indian investor.</span>
          </h1>

          <p style={{ fontSize: 18, color: '#6B7280', maxWidth: 520, margin: '0 auto 40px', lineHeight: 1.7, fontWeight: 400 }}>
            190 million Indians lack formal credit history. Nuvest uses UPI transactions,
            bill payments, and rent data to build an explainable credit score — in seconds.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 64 }}>
            <button
              onClick={() => navigate('/demo')}
              style={{ fontSize: 15, fontWeight: 600, color: '#fff', background: '#0A0A0A', border: 'none', borderRadius: 10, padding: '14px 28px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'background 0.15s, transform 0.15s', letterSpacing: '-0.01em' }}
              onMouseOver={e => { e.currentTarget.style.background = '#1A6B5A'; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseOut={e  => { e.currentTarget.style.background = '#0A0A0A'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              Get your credit score →
            </button>
            <a
              href="#how-it-works"
              style={{ fontSize: 15, fontWeight: 600, color: '#0A0A0A', background: 'transparent', border: '1.5px solid #0A0A0A', borderRadius: 10, padding: '14px 28px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', textDecoration: 'none', transition: 'border-color 0.15s, color 0.15s', letterSpacing: '-0.01em', display: 'inline-block' }}
              onMouseOver={e => { e.currentTarget.style.borderColor = '#1A6B5A'; e.currentTarget.style.color = '#1A6B5A' }}
              onMouseOut={e  => { e.currentTarget.style.borderColor = '#0A0A0A'; e.currentTarget.style.color = '#0A0A0A' }}
            >
              See how it works
            </a>
          </div>
        </div>

        {/* ── Dashboard preview (scroll-reveal) ───────────────────────────── */}
        <div style={{
          position: 'relative', zIndex: 1,
          maxWidth: 900, margin: '0 auto',
          padding: '0 24px 0',
          opacity: dashOpacity,
          filter: `blur(${dashBlur}px)`,
          transition: 'opacity 0.08s linear, filter 0.08s linear',
          transformOrigin: 'top center',
        }}>
          {/* Fade mask at bottom so it merges into the page */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, background: 'linear-gradient(to bottom, transparent, #FAFAF8)', zIndex: 5, pointerEvents: 'none' }} />
          <DashboardMockup />
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 24px 0', maxWidth: 700, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 2, borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(10,10,10,0.08)', background: 'rgba(10,10,10,0.02)' }}>
          {stats.map((s, i) => (
            <div key={s.label} style={{ padding: '28px 24px', textAlign: 'center', borderRight: i < 2 ? '1px solid rgba(10,10,10,0.08)' : 'none' }}>
              <div style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 36, fontWeight: 700, color: '#1A6B5A', letterSpacing: '-0.02em' }}>{s.value}</div>
              <div style={{ fontSize: 13, color: '#6B7280', marginTop: 6, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Problem section ───────────────────────────────────────────────── */}
      <section id="problem" style={{ padding: '100px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <h2 style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 700, color: '#0A0A0A', marginBottom: 16, letterSpacing: '-0.02em' }}>
            The problem with traditional credit
          </h2>
          <p style={{ fontSize: 17, color: '#6B7280', maxWidth: 480, margin: '0 auto', lineHeight: 1.6 }}>
            The system was never built for most Indians. We're changing that.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 1, borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(10,10,10,0.08)' }}>
          {problems.map((p, i) => (
            <div key={p.title} style={{ padding: '36px 32px', background: '#FAFAF8', borderRight: i < 2 ? '1px solid rgba(10,10,10,0.08)' : 'none' }}>
              <div style={{ fontSize: 32, marginBottom: 20 }}>{p.icon}</div>
              <h3 style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 20, fontWeight: 600, color: '#0A0A0A', marginBottom: 12, letterSpacing: '-0.01em' }}>{p.title}</h3>
              <p style={{ fontSize: 15, color: '#6B7280', lineHeight: 1.7 }}>{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section id="how-it-works" style={{ padding: '80px 24px 100px', background: '#F3F3F0' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2 style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 700, color: '#0A0A0A', marginBottom: 12, letterSpacing: '-0.02em' }}>
              How Nuvest works
            </h2>
            <p style={{ fontSize: 16, color: '#6B7280' }}>From alternative data to an explainable score in 3 steps</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 32 }}>
            {[
              { step: '01', title: 'Enter your profile',  body: 'Tell us about your UPI usage, bill payments, income, and employment — no bank statements needed.' },
              { step: '02', title: 'AI scores your data', body: 'Our XGBoost model trained on 1000+ alternative-data profiles computes a 0–850 credit score instantly.' },
              { step: '03', title: 'Understand why',      body: 'SHAP values break down exactly which factors boosted or lowered your score, in plain language.' },
            ].map(item => (
              <div key={item.step} style={{ position: 'relative', paddingLeft: 52 }}>
                <div style={{ position: 'absolute', left: 0, top: 0, width: 36, height: 36, borderRadius: 9, border: '1.5px solid rgba(26,107,90,0.35)', background: 'rgba(26,107,90,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#1A6B5A', fontFamily: 'Inter, monospace' }}>
                  {item.step}
                </div>
                <h3 style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 20, fontWeight: 600, color: '#0A0A0A', marginBottom: 10, letterSpacing: '-0.01em' }}>{item.title}</h3>
                <p style={{ fontSize: 15, color: '#6B7280', lineHeight: 1.7 }}>{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section style={{ padding: '100px 24px', textAlign: 'center', background: '#FAFAF8' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 700, color: '#0A0A0A', marginBottom: 16, letterSpacing: '-0.02em' }}>
            Ready to see your score?
          </h2>
          <p style={{ fontSize: 17, color: '#6B7280', marginBottom: 36, lineHeight: 1.6 }}>Takes 30 seconds. No bank account required.</p>
          <button
            onClick={() => navigate('/demo')}
            style={{ fontSize: 15, fontWeight: 600, color: '#fff', background: '#0A0A0A', border: 'none', borderRadius: 10, padding: '15px 32px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'background 0.15s, transform 0.15s', letterSpacing: '-0.01em' }}
            onMouseOver={e => { e.currentTarget.style.background = '#1A6B5A'; e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseOut={e  => { e.currentTarget.style.background = '#0A0A0A'; e.currentTarget.style.transform = 'translateY(0)' }}
          >
            Try the demo →
          </button>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid rgba(10,10,10,0.08)', padding: '24px', textAlign: 'center', fontSize: 13, color: '#9CA3AF' }}>
        Nuvest — Built for the AI for Financial Inclusion Hackathon
      </footer>

    </div>
  )
}
