import { useState, useEffect, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt    = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n ?? 0)
const fmtN   = (n, dp = 2) => (n ?? 0).toFixed(dp)
const sign   = (n) => (n >= 0 ? '+' : '')

// ─── SVG sparkline (no extra deps) ────────────────────────────────────────────
function Sparkline({ symbol, pnl }) {
  const W = 64, H = 24, pts = 12
  // deterministic pseudo-random per symbol
  let seed = 0
  for (let i = 0; i < symbol.length; i++) seed = (seed * 31 + symbol.charCodeAt(i)) >>> 0
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0xFFFFFFFF }

  const raw = Array.from({ length: pts }, (_, i) => {
    const base = 50 + (pnl >= 0 ? i * 2.5 : -i * 2) + rand() * 12 - 6
    return Math.max(5, Math.min(95, base))
  })
  const min = Math.min(...raw), max = Math.max(...raw)
  const norm = raw.map(v => max === min ? 0.5 : (v - min) / (max - min))
  const coords = norm.map((v, i) => `${(i / (pts - 1)) * W},${H - v * (H - 4) - 2}`)
  const color = pnl >= 0 ? '#10b981' : '#ef4444'
  const fill  = pnl >= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)'
  const area  = `M${coords[0]} L${coords.join(' L')} L${W},${H} L0,${H} Z`
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <path d={area} fill={fill} strokeWidth="0" />
      <polyline points={coords.join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// ─── Circular health ring ──────────────────────────────────────────────────────
function HealthRing({ score }) {
  const R = 44, C = 2 * Math.PI * R
  const pct = Math.max(0, Math.min(100, score))
  const dash = (pct / 100) * C
  const color = pct >= 65 ? '#1A6B5A' : pct >= 40 ? '#f59e0b' : '#ef4444'
  const label = pct >= 65 ? 'Healthy' : pct >= 40 ? 'Fair' : 'Weak'
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="112" height="112" viewBox="0 0 112 112">
        <circle cx="56" cy="56" r={R} fill="none" stroke="#F0ECE4" strokeWidth="10" />
        <circle
          cx="56" cy="56" r={R} fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${C}`}
          strokeDashoffset={C * 0.25}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
        <text x="56" y="52" textAnchor="middle" fontSize="18" fontWeight="700" fill="#0A0A0A">{pct}</text>
        <text x="56" y="68" textAnchor="middle" fontSize="10" fill="#A39E98">/ 100</text>
      </svg>
      <span className="text-xs font-semibold" style={{ color }}>{label}</span>
    </div>
  )
}

// ─── Rec badge ────────────────────────────────────────────────────────────────
function RecBadge({ rec }) {
  if (!rec) return <span className="text-[#C4BFB8] text-xs">—</span>
  const styles = {
    Buy:  'bg-emerald-50 border-emerald-200 text-emerald-700',
    Hold: 'bg-amber-50 border-amber-200 text-amber-700',
    Sell: 'bg-red-50 border-red-200 text-red-700',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold ${styles[rec] || styles.Hold}`}>
      {rec}
    </span>
  )
}

// ─── Nav icons ────────────────────────────────────────────────────────────────
const DashboardIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>
)
const PortfolioIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
)
const ScoreIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
  </svg>
)
const SettingsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
  </svg>
)

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner({ white = false }) {
  return (
    <svg className={`animate-spin h-4 w-4 ${white ? 'text-white' : 'text-[#1A6B5A]'}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
    </svg>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Portfolio() {
  const navigate = useNavigate()

  const [status,    setStatus]    = useState({ connected: false, mode: 'mock', user_name: '' })
  const [holdings,  setHoldings]  = useState([])
  const [overview,  setOverview]  = useState(null)
  const [analysis,  setAnalysis]  = useState(null)
  const [expanded,  setExpanded]  = useState(null)   // tradingsymbol of expanded row

  const [loadingData, setLoadingData] = useState(false)
  const [loadingAI,   setLoadingAI]   = useState(false)
  const [loadingConn, setLoadingConn] = useState(false)
  const [error,       setError]       = useState(null)
  const [aiError,     setAiError]     = useState(null)

  // ── On mount: check if Kite redirected back with request_token ──────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const rt = params.get('request_token')
    if (rt) {
      window.history.replaceState({}, '', window.location.pathname)
      handleCallback(rt)
    } else {
      loadAll()
    }
  }, [])

  // ── Load status + holdings + overview in parallel ───────────────────────────
  async function loadAll() {
    setLoadingData(true)
    setError(null)
    try {
      const [sRes, hRes, oRes] = await Promise.all([
        fetch('/portfolio/status'),
        fetch('/portfolio/holdings'),
        fetch('/portfolio/overview'),
      ])
      if (!sRes.ok || !hRes.ok || !oRes.ok)
        throw new Error(`Data fetch failed (${sRes.status}/${hRes.status}/${oRes.status})`)
      const [s, h, o] = await Promise.all([sRes.json(), hRes.json(), oRes.json()])
      setStatus(s)
      setHoldings(h.holdings || [])
      setOverview(o.overview || null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingData(false)
    }
  }

  // ── Kite OAuth: open login URL ───────────────────────────────────────────────
  async function handleConnect() {
    setLoadingConn(true)
    setError(null)
    try {
      const res = await fetch('/portfolio/login')
      if (!res.ok) throw new Error((await res.json()).detail || res.status)
      const { login_url } = await res.json()
      window.location.href = login_url
    } catch (e) {
      setError('Could not get Zerodha login URL: ' + e.message)
      setLoadingConn(false)
    }
  }

  // ── Kite OAuth: exchange request_token ─────────────────────────────────────
  async function handleCallback(requestToken) {
    setLoadingData(true)
    setError(null)
    try {
      const res = await fetch(`/portfolio/callback?request_token=${encodeURIComponent(requestToken)}`)
      if (!res.ok) throw new Error((await res.json()).detail || res.status)
      await loadAll()
    } catch (e) {
      setError('Token exchange failed: ' + e.message)
      setLoadingData(false)
    }
  }

  // ── Disconnect ───────────────────────────────────────────────────────────────
  async function handleDisconnect() {
    try {
      await fetch('/portfolio/logout', { method: 'DELETE' })
    } catch { /* ignore */ }
    setAnalysis(null)
    await loadAll()
  }

  // ── AI analysis ──────────────────────────────────────────────────────────────
  async function runAnalysis() {
    setLoadingAI(true)
    setAiError(null)
    try {
      const res = await fetch('/portfolio/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mock: status.mode === 'mock' }),
      })
      if (!res.ok) throw new Error((await res.json()).detail || res.status)
      const data = await res.json()
      setHoldings(data.holdings || [])
      if (data.overview) setOverview(data.overview)
      setAnalysis(data.analysis || null)
    } catch (e) {
      setAiError(e.message)
    } finally {
      setLoadingAI(false)
    }
  }

  // ── Health score from overview ────────────────────────────────────────────────
  const healthScore = overview
    ? Math.round(
        Math.min(100, Math.max(0,
          50
          + (overview.total_pnl_pct ?? 0) * 1.5
          + (overview.day_change_pct ?? 0) * 2
          + (overview.holdings_count ?? 0) * 2
        ))
      )
    : 0

  const isLive = status.mode === 'live' && status.connected

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#0A0A0A]">

      {/* ── Top navbar ─────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-40 bg-[#FAFAF8]/90 backdrop-blur-md border-b border-[#E8E4DC]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">

          {/* Logo */}
          <button onClick={() => navigate('/')} className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-7 h-7 rounded-lg bg-[#1A6B5A] flex items-center justify-center font-bold text-xs text-white">N</div>
            <span className="font-serif font-semibold text-lg text-[#0A0A0A]">Nuvest</span>
          </button>

          {/* Nav tabs */}
          <div className="hidden md:flex items-center gap-1">
            {[
              { label: 'Dashboard',    path: '/dashboard' },
              { label: 'Portfolio',    path: '/portfolio', active: true },
              { label: 'Credit Score', path: '/demo' },
            ].map(({ label, path, active }) => (
              <button
                key={label}
                onClick={() => navigate(path)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  active
                    ? 'bg-[#F0ECE4] text-[#0A0A0A] font-medium'
                    : 'text-[#6B6560] hover:text-[#0A0A0A] hover:bg-[#F0ECE4]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Right: badge + actions */}
          <div className="flex items-center gap-3">
            <span className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
              isLive
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-500' : 'bg-amber-400'}`} />
              {isLive ? `Live · ${status.user_name}` : 'Mock Data'}
            </span>

            {isLive ? (
              <button
                onClick={handleDisconnect}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#E8E4DC] text-sm font-medium text-[#6B6560] hover:border-red-200 hover:text-red-600 transition-colors shadow-sm"
              >
                Disconnect Zerodha
              </button>
            ) : (
              <button
                onClick={handleConnect}
                disabled={loadingConn}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1A6B5A] hover:bg-[#155A4A] disabled:bg-[#D5D0C8] disabled:cursor-not-allowed text-sm font-medium text-white transition-colors shadow-sm"
              >
                {loadingConn ? <Spinner white /> : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                  </svg>
                )}
                {loadingConn ? 'Connecting…' : 'Connect Zerodha'}
              </button>
            )}

            <button
              onClick={runAnalysis}
              disabled={loadingAI || loadingData}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0A0A0A] hover:bg-[#1f1f1f] disabled:bg-[#D5D0C8] disabled:cursor-not-allowed text-sm font-medium text-white transition-colors shadow-sm"
            >
              {loadingAI ? <Spinner white /> : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                </svg>
              )}
              {loadingAI ? 'Analysing…' : 'Run AI Analysis'}
            </button>
          </div>
        </div>
      </nav>

      {/* ── Main content ───────────────────────────────────────────────────────── */}
      <main className="min-h-screen">
        <div className="max-w-6xl mx-auto px-6 py-8">

          {/* ── Connect banner ──────────────────────────────────────────────── */}
          {!isLive && (
            <div className="mb-6 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5">
              <div className="flex items-center gap-3">
                <svg width="18" height="18" className="text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span className="text-sm text-amber-800">
                  Showing mock data — connect your Zerodha account to view real portfolio.
                </span>
              </div>
              <button onClick={handleConnect} className="text-xs font-semibold text-amber-700 hover:text-amber-900 underline-offset-2 hover:underline transition-colors">
                Connect now →
              </button>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
          )}

          {/* ── Overview cards ──────────────────────────────────────────────── */}
          {overview && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {/* Current value — feature card */}
              <div className="lg:col-span-1 rounded-2xl p-5 border border-[#1A6B5A]/20 shadow-sm" style={{ background: 'linear-gradient(135deg,rgba(26,107,90,0.06),rgba(26,107,90,0.02))' }}>
                <p className="text-xs font-medium text-[#1A6B5A] mb-2 uppercase tracking-wide">Current Value</p>
                <p className="text-2xl font-bold text-[#0A0A0A] leading-none">{fmt(overview.current_value)}</p>
                <p className="text-xs text-[#A39E98] mt-1.5">Invested {fmt(overview.total_invested)}</p>
              </div>

              {/* Total P&L */}
              <div className="rounded-2xl p-5 bg-white border border-[#E8E4DC] shadow-sm">
                <p className="text-xs font-medium text-[#A39E98] mb-2 uppercase tracking-wide">Total P&L</p>
                <p className={`text-2xl font-bold leading-none ${overview.total_pnl >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {sign(overview.total_pnl)}{fmt(overview.total_pnl)}
                </p>
                <p className={`text-xs mt-1.5 ${overview.total_pnl >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {sign(overview.total_pnl_pct)}{fmtN(overview.total_pnl_pct)}% return
                </p>
              </div>

              {/* Today's change */}
              <div className="rounded-2xl p-5 bg-white border border-[#E8E4DC] shadow-sm">
                <p className="text-xs font-medium text-[#A39E98] mb-2 uppercase tracking-wide">Today's Change</p>
                <p className={`text-2xl font-bold leading-none ${overview.day_change >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {sign(overview.day_change)}{fmt(overview.day_change)}
                </p>
                <p className={`text-xs mt-1.5 ${overview.day_change >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {sign(overview.day_change_pct)}{fmtN(overview.day_change_pct)}% today
                </p>
              </div>

              {/* Holdings count */}
              <div className="rounded-2xl p-5 bg-white border border-[#E8E4DC] shadow-sm">
                <p className="text-xs font-medium text-[#A39E98] mb-2 uppercase tracking-wide">Holdings</p>
                <p className="text-2xl font-bold text-[#0A0A0A] leading-none">{overview.holdings_count}</p>
                <div className="flex gap-3 mt-1.5">
                  {overview.top_gainer && <p className="text-xs text-emerald-600">↑ {overview.top_gainer}</p>}
                  {overview.top_loser  && <p className="text-xs text-red-500">↓ {overview.top_loser}</p>}
                </div>
              </div>
            </div>
          )}

          {/* ── Holdings + Right panel ─────────────────────────────────────── */}
          <div className="grid xl:grid-cols-3 gap-6">

            {/* Holdings table */}
            <div className="xl:col-span-2 bg-white border border-[#E8E4DC] rounded-2xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-[#E8E4DC] flex items-center justify-between">
                <h2 className="font-semibold text-[#0A0A0A]">Holdings</h2>
                {loadingData && <Spinner />}
              </div>

              {holdings.length === 0 && !loadingData ? (
                <div className="p-12 text-center text-[#A39E98] text-sm">
                  No holdings data available.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#F0ECE4] text-[#A39E98] text-xs">
                        <th className="px-5 py-3 text-left font-medium">Symbol</th>
                        <th className="px-4 py-3 text-right font-medium">Qty</th>
                        <th className="px-4 py-3 text-right font-medium hidden md:table-cell">Avg</th>
                        <th className="px-4 py-3 text-right font-medium">LTP</th>
                        <th className="px-4 py-3 text-right font-medium">P&L</th>
                        <th className="px-4 py-3 text-center font-medium hidden sm:table-cell">7d</th>
                        <th className="px-4 py-3 text-center font-medium">AI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {holdings.map((h, i) => {
                        const pnlPos  = h.pnl >= 0
                        const dayPos  = h.day_change_percentage >= 0
                        const invested = h.quantity * h.average_price
                        const pnlPct  = invested ? (h.pnl / invested * 100) : 0
                        const isOpen  = expanded === h.tradingsymbol
                        return (
                          <Fragment key={h.tradingsymbol}>
                            <tr
                              onClick={() => setExpanded(isOpen ? null : h.tradingsymbol)}
                              className={`border-b border-[#F5F2EE] cursor-pointer transition-colors ${
                                i % 2 === 0 ? 'bg-white hover:bg-[#FAFAF8]' : 'bg-[#FDFCFA] hover:bg-[#F5F2EE]'
                              } ${isOpen ? 'bg-[#F5F2EE]' : ''}`}
                            >
                              {/* Symbol */}
                              <td className="px-5 py-3.5">
                                <div className="font-semibold text-[#0A0A0A]">{h.tradingsymbol}</div>
                                <div className="text-xs text-[#C4BFB8]">{h.exchange}</div>
                              </td>
                              {/* Qty */}
                              <td className="px-4 py-3.5 text-right text-[#6B6560]">{h.quantity}</td>
                              {/* Avg */}
                              <td className="px-4 py-3.5 text-right text-[#6B6560] hidden md:table-cell">
                                ₹{h.average_price.toLocaleString('en-IN')}
                              </td>
                              {/* LTP */}
                              <td className="px-4 py-3.5 text-right font-medium text-[#0A0A0A]">
                                ₹{h.last_price.toLocaleString('en-IN')}
                                <div className={`text-xs font-normal ${dayPos ? 'text-emerald-600' : 'text-red-500'}`}>
                                  {sign(h.day_change_percentage)}{fmtN(h.day_change_percentage)}%
                                </div>
                              </td>
                              {/* P&L */}
                              <td className="px-4 py-3.5 text-right">
                                <div className={`font-medium ${pnlPos ? 'text-emerald-700' : 'text-red-600'}`}>
                                  {sign(h.pnl)}{fmt(h.pnl)}
                                </div>
                                <div className={`text-xs ${pnlPos ? 'text-emerald-600' : 'text-red-500'}`}>
                                  {sign(pnlPct)}{fmtN(pnlPct)}%
                                </div>
                              </td>
                              {/* Sparkline */}
                              <td className="px-4 py-3.5 hidden sm:table-cell">
                                <div className="flex justify-center">
                                  <Sparkline symbol={h.tradingsymbol} pnl={h.pnl} />
                                </div>
                              </td>
                              {/* AI rec */}
                              <td className="px-4 py-3.5 text-center">
                                <RecBadge rec={h.recommendation} />
                              </td>
                            </tr>

                            {/* Expanded AI reasoning row */}
                            {isOpen && (
                              <tr className="border-b border-[#F0ECE4] bg-[#F5F0E8]/40">
                                <td colSpan={7} className="px-5 py-4">
                                  <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-lg bg-[#1A6B5A]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                      <svg width="12" height="12" className="text-[#1A6B5A]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                                      </svg>
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold text-[#1A6B5A] mb-1">AI Reasoning — {h.tradingsymbol}</p>
                                      {h.rec_reason ? (
                                        <p className="text-xs text-[#6B6560] leading-relaxed">{h.rec_reason}</p>
                                      ) : (
                                        <p className="text-xs text-[#A39E98] italic">Run AI Analysis to see reasoning.</p>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ── Right panel ─────────────────────────────────────────────── */}
            <div className="flex flex-col gap-4">

              {/* Health ring */}
              <div className="bg-white border border-[#E8E4DC] rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-7 h-7 rounded-lg bg-[#1A6B5A]/10 flex items-center justify-center">
                    <svg width="14" height="14" className="text-[#1A6B5A]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                    </svg>
                  </div>
                  <h3 className="font-semibold text-sm text-[#0A0A0A]">Portfolio Health</h3>
                </div>

                <div className="flex items-center gap-6">
                  <HealthRing score={healthScore} />
                  <div className="flex-1 space-y-2">
                    {overview && [
                      { label: 'Return',      val: `${sign(overview.total_pnl_pct)}${fmtN(overview.total_pnl_pct)}%`,  pos: overview.total_pnl_pct >= 0 },
                      { label: 'Today',       val: `${sign(overview.day_change_pct)}${fmtN(overview.day_change_pct)}%`, pos: overview.day_change_pct >= 0 },
                      { label: 'Diversified', val: `${overview.holdings_count} stocks`, pos: (overview.holdings_count ?? 0) >= 5 },
                    ].map(({ label, val, pos }) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="text-xs text-[#A39E98]">{label}</span>
                        <span className={`text-xs font-semibold ${pos ? 'text-emerald-700' : 'text-red-600'}`}>{val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {analysis?.portfolio_health && (
                  <p className="mt-4 text-xs text-[#6B6560] leading-relaxed border-t border-[#F0ECE4] pt-4">
                    {analysis.portfolio_health}
                  </p>
                )}
              </div>

              {/* AI Suggestions */}
              <div className="bg-white border border-[#E8E4DC] rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 text-sm">💡</div>
                  <h3 className="font-semibold text-sm text-[#0A0A0A]">AI Suggestions</h3>
                </div>

                {aiError && (
                  <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                    {aiError}
                  </div>
                )}

                {analysis?.suggestions?.length ? (
                  <ol className="space-y-3">
                    {analysis.suggestions.map((s, i) => (
                      <li key={i} className="flex gap-2.5 text-xs text-[#6B6560]">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#1A6B5A]/10 border border-[#1A6B5A]/20 flex items-center justify-center text-[#1A6B5A] text-xs font-bold">
                          {i + 1}
                        </span>
                        <span className="leading-relaxed">{s}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-xs text-[#A39E98] leading-relaxed mb-3">
                      Get AI-powered rebalancing tips, profit-booking signals, and risk alerts.
                    </p>
                    <button
                      onClick={runAnalysis}
                      disabled={loadingAI || loadingData}
                      className="w-full py-2.5 rounded-xl bg-[#1A6B5A] hover:bg-[#155A4A] disabled:bg-[#D5D0C8] disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      {loadingAI ? <><Spinner white /><span>Analysing…</span></> : 'Run AI Analysis'}
                    </button>
                  </div>
                )}
              </div>

              {/* Setup card */}
              {!isLive && (
                <div className="bg-white border border-dashed border-[#D5D0C8] rounded-2xl p-5 shadow-sm">
                  <p className="text-xs font-semibold text-[#0A0A0A] mb-2">Live Broker Setup</p>
                  <p className="text-xs text-[#A39E98] leading-relaxed mb-3">
                    Set <code className="bg-[#F5F0E8] px-1 rounded text-[#6B6560]">KITE_API_KEY</code> and{' '}
                    <code className="bg-[#F5F0E8] px-1 rounded text-[#6B6560]">KITE_API_SECRET</code> in{' '}
                    <code className="bg-[#F5F0E8] px-1 rounded text-[#6B6560]">backend/.env</code>, then connect Zerodha above.
                  </p>
                  <p className="text-xs text-[#A39E98]">
                    Redirect URL:{' '}
                    <code className="bg-[#F5F0E8] px-1 rounded text-[#6B6560] select-all">
                      http://localhost:5173/portfolio
                    </code>
                  </p>
                </div>
              )}
            </div>

          </div>
        </div>
      </main>
    </div>
  )
}
