import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt  = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n ?? 0)
const fmtN = (n, dp = 2) => (n ?? 0).toFixed(dp)
const sign = (n) => (n >= 0 ? '+' : '')

// ─── Avatar colours ────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  ['#DBEAFE','#1D4ED8'], ['#DCF5E7','#15803D'], ['#FEE2E2','#DC2626'],
  ['#FEF3C7','#D97706'], ['#EDE9FE','#6D28D9'], ['#FCE7F3','#BE185D'],
  ['#CCFBF1','#0F766E'], ['#FFF7ED','#C2410C'],
]
function avatarColors(symbol) {
  let h = 0
  for (let i = 0; i < symbol.length; i++) h = (h * 31 + symbol.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

// ─── Deterministic sparkline data ─────────────────────────────────────────────
function makeChartData(symbol, pnl, avgPrice, points = 30) {
  let seed = 0
  for (let i = 0; i < symbol.length; i++) seed = (seed * 31 + symbol.charCodeAt(i)) >>> 0
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0xFFFFFFFF }
  const trend = pnl >= 0 ? 1 : -1
  const data = []
  let price = avgPrice * (1 - trend * 0.04)
  const now = Date.now()
  for (let i = 0; i < points; i++) {
    price += trend * (rand() * 3 - 0.8) + (rand() - 0.5) * 2
    const date = new Date(now - (points - i) * 24 * 60 * 60 * 1000)
    data.push({
      date: date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
      price: Math.max(1, +price.toFixed(2)),
    })
  }
  return data
}

// ─── Health ring ───────────────────────────────────────────────────────────────
function HealthRing({ score }) {
  const R = 40, C = 2 * Math.PI * R
  const pct = Math.max(0, Math.min(100, score))
  const dash = (pct / 100) * C
  const color = pct >= 65 ? '#16A34A' : pct >= 40 ? '#D97706' : '#DC2626'
  const label = pct >= 65 ? 'Healthy' : pct >= 40 ? 'Fair' : 'Weak'
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={R} fill="none" stroke="#F3F4F6" strokeWidth="8" />
        <circle
          cx="48" cy="48" r={R} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${C}`}
          strokeDashoffset={C * 0.25}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
        <text x="48" y="44" textAnchor="middle" fontSize="18" fontWeight="700" fill="#111827">{pct}</text>
        <text x="48" y="57" textAnchor="middle" fontSize="9" fill="#9CA3AF">/ 100</text>
      </svg>
      <span className="text-xs font-semibold" style={{ color }}>{label} Portfolio</span>
    </div>
  )
}

// ─── Rec badge ────────────────────────────────────────────────────────────────
function RecBadge({ rec }) {
  if (!rec) return null
  const styles = { Buy: 'bg-green-50 text-green-700', Hold: 'bg-amber-50 text-amber-700', Sell: 'bg-red-50 text-red-700' }
  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[rec] || styles.Hold}`}>{rec}</span>
  )
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner({ white = false, sm = false }) {
  const sz = sm ? 'h-3.5 w-3.5' : 'h-4 w-4'
  return (
    <svg className={`animate-spin ${sz} ${white ? 'text-white' : 'text-[#16A34A]'}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
    </svg>
  )
}

// ─── Custom chart tooltip ─────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="text-gray-400 mb-0.5">{label}</p>
      <p className="font-semibold text-gray-900">{fmt(payload[0].value)}</p>
    </div>
  )
}

// ─── Typing indicator ─────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <span className="flex gap-1 items-center py-0.5">
      {[0, 150, 300].map(d => (
        <span key={d} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
      ))}
    </span>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Portfolio() {
  const navigate = useNavigate()

  const [status,    setStatus]    = useState({ connected: false, mode: 'mock', user_name: '' })
  const [holdings,  setHoldings]  = useState([])
  const [overview,  setOverview]  = useState(null)
  const [analysis,  setAnalysis]  = useState(null)
  const [selected,  setSelected]  = useState(null)
  const [search,    setSearch]    = useState('')

  const [loadingData, setLoadingData] = useState(false)
  const [loadingAI,   setLoadingAI]   = useState(false)
  const [loadingConn, setLoadingConn] = useState(false)
  const [error,       setError]       = useState(null)
  const [aiError,     setAiError]     = useState(null)

  // Right panel state
  const [aiOpen,       setAiOpen]       = useState(true)
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput,    setChatInput]    = useState('')
  const [chatLoading,  setChatLoading]  = useState(false)
  const chatEndRef = useRef(null)

  // ── On mount ────────────────────────────────────────────────────────────────
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

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // ── Load status + holdings + overview ───────────────────────────────────────
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

  // ── Kite OAuth ───────────────────────────────────────────────────────────────
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

  async function handleDisconnect() {
    try { await fetch('/portfolio/logout', { method: 'DELETE' }) } catch { /* ignore */ }
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

  // ── Portfolio chat ────────────────────────────────────────────────────────────
  async function sendChat(message) {
    if (!message.trim() || chatLoading) return
    setChatMessages(prev => [...prev, { role: 'user', content: message }])
    setChatInput('')
    setChatLoading(true)
    setChatMessages(prev => [...prev, { role: 'assistant', content: '' }])
    try {
      const res = await fetch('/portfolio/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, holdings, overview, health_score: healthScore }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || res.status)
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value, { stream: true })
        for (const line of text.split('\n')) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6).trim()
          if (payload === '[DONE]') break
          try {
            const { text: chunk } = JSON.parse(payload)
            setChatMessages(prev => {
              const updated = [...prev]
              const last = { ...updated[updated.length - 1] }
              last.content += chunk
              updated[updated.length - 1] = last
              return updated
            })
          } catch { /* malformed chunk, skip */ }
        }
      }
    } catch (e) {
      setChatMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { ...updated[updated.length - 1], content: 'Sorry, something went wrong. Please try again.' }
        return updated
      })
    } finally {
      setChatLoading(false)
    }
  }

  // ── Derived ──────────────────────────────────────────────────────────────────
  const healthScore = overview
    ? Math.round(Math.min(100, Math.max(0,
        50 + (overview.total_pnl_pct ?? 0) * 1.5 + (overview.day_change_pct ?? 0) * 2 + (overview.holdings_count ?? 0) * 2
      )))
    : 0

  const isLive = status.mode === 'live' && status.connected

  const filtered = holdings.filter(h =>
    h.tradingsymbol.toLowerCase().includes(search.toLowerCase())
  )
  const grouped = useMemo(() => {
    const map = {}
    for (const h of filtered) {
      const ex = h.exchange || 'NSE'
      if (!map[ex]) map[ex] = []
      map[ex].push(h)
    }
    return map
  }, [filtered])

  const selectedHolding = holdings.find(h => h.tradingsymbol === selected)

  const chartData = useMemo(() => {
    if (!selectedHolding) return []
    return makeChartData(selectedHolding.tradingsymbol, selectedHolding.pnl, selectedHolding.average_price, 30)
  }, [selectedHolding])

  const chartColor = selectedHolding?.pnl >= 0 ? '#16A34A' : '#DC2626'

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white text-gray-900" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Top navbar ─────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-40 bg-white border-b border-gray-100">
        <div className="max-w-screen-2xl mx-auto px-6 h-14 flex items-center justify-between">

          <button onClick={() => navigate('/')} className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-7 h-7 rounded-lg bg-[#16A34A] flex items-center justify-center font-bold text-xs text-white">N</div>
            <span className="font-bold text-base text-gray-900 tracking-tight">Nuvest</span>
          </button>

          <div className="hidden md:flex items-center gap-1">
            {[
              { label: 'Dashboard',    path: '/dashboard' },
              { label: 'Portfolio',    path: '/portfolio', active: true },
              { label: 'Credit Score', path: '/demo' },
            ].map(({ label, path, active }) => (
              <button
                key={label}
                onClick={() => navigate(path)}
                className={`px-3.5 py-1.5 text-sm rounded-lg transition-colors ${
                  active ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2.5">
            <span className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
              isLive ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-600'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-green-500' : 'bg-amber-400'}`} />
              {isLive ? `Live · ${status.user_name}` : 'Mock Data'}
            </span>

            {isLive ? (
              <button
                onClick={handleDisconnect}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-white border border-gray-200 text-sm font-medium text-gray-600 hover:border-red-200 hover:text-red-600 transition-colors"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={handleConnect}
                disabled={loadingConn}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#16A34A] hover:bg-[#15803D] disabled:opacity-50 text-sm font-medium text-white transition-colors"
              >
                {loadingConn ? <Spinner white sm /> : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                  </svg>
                )}
                Connect Zerodha
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* ── Error banner ───────────────────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-50 border-b border-red-100 px-6 py-2.5 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-4">✕</button>
        </div>
      )}

      {/* ── 3-column layout ────────────────────────────────────────────────────── */}
      <div className="flex" style={{ height: 'calc(100vh - 56px)' }}>

        {/* ══ LEFT PANEL (280px): Holdings list ══════════════════════════════════ */}
        <aside className="flex-shrink-0 border-r border-gray-100 flex flex-col bg-[#FAFAF9]" style={{ width: 280 }}>

          {/* Net Worth */}
          <div className="px-5 pt-5 pb-4 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Net Worth</p>
            {loadingData ? (
              <div className="h-8 w-36 bg-gray-100 rounded animate-pulse" />
            ) : (
              <p className="text-2xl font-bold text-gray-900 tracking-tight">{fmt(overview?.current_value)}</p>
            )}
            {overview && (
              <p className={`text-sm font-medium mt-0.5 ${overview.total_pnl >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                {sign(overview.total_pnl)}{fmt(overview.total_pnl)} ({sign(overview.total_pnl_pct)}{fmtN(overview.total_pnl_pct)}%)
              </p>
            )}
          </div>

          {/* Search */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
              </svg>
              <input
                type="text"
                placeholder="Search holdings…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20 focus:border-[#16A34A]"
              />
            </div>
          </div>

          {/* Holdings list */}
          <div className="flex-1 overflow-y-auto">
            {loadingData ? (
              <div className="p-4 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="w-9 h-9 rounded-full bg-gray-200 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="h-3.5 w-24 bg-gray-200 rounded mb-1.5" />
                      <div className="h-3 w-16 bg-gray-100 rounded" />
                    </div>
                    <div className="h-3.5 w-14 bg-gray-200 rounded" />
                  </div>
                ))}
              </div>
            ) : (
              Object.entries(grouped).map(([exchange, items]) => (
                <div key={exchange}>
                  <div className="px-5 pt-4 pb-1.5">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{exchange}</span>
                  </div>
                  {items.map(h => {
                    const [bg, fg] = avatarColors(h.tradingsymbol)
                    const isSelected = selected === h.tradingsymbol
                    const pnlPos = h.pnl >= 0
                    return (
                      <button
                        key={h.tradingsymbol}
                        onClick={() => setSelected(isSelected ? null : h.tradingsymbol)}
                        className={`w-full flex items-center gap-3 px-5 py-3 transition-colors text-left ${
                          isSelected ? 'bg-white shadow-sm border-r-2 border-r-[#16A34A]' : 'hover:bg-white/70'
                        }`}
                      >
                        <div
                          className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                          style={{ background: bg, color: fg }}
                        >
                          {h.tradingsymbol.slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{h.tradingsymbol}</p>
                          <p className="text-xs text-gray-400">{h.quantity} shares · {h.exchange}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-sm font-semibold ${pnlPos ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                            {sign(h.pnl)}{fmt(h.pnl)}
                          </p>
                          <p className={`text-xs ${pnlPos ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                            {sign(h.day_change_percentage)}{fmtN(h.day_change_percentage)}%
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ))
            )}
          </div>
        </aside>

        {/* ══ CENTER PANEL: Stock detail ══════════════════════════════════════════ */}
        <main className="flex-1 overflow-y-auto bg-white min-w-0">
          {selectedHolding ? (
            /* ── Stock detail view ───────────────────────────────────────────── */
            <div className="max-w-2xl mx-auto px-8 py-8">

              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  {(() => {
                    const [bg, fg] = avatarColors(selectedHolding.tradingsymbol)
                    return (
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: bg, color: fg }}>
                        {selectedHolding.tradingsymbol.slice(0, 2)}
                      </div>
                    )
                  })()}
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedHolding.tradingsymbol}</h2>
                    <p className="text-sm text-gray-400">{selectedHolding.exchange} · {selectedHolding.product}</p>
                  </div>
                  {selectedHolding.recommendation && <RecBadge rec={selectedHolding.recommendation} />}
                </div>
                <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-50 transition-colors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>

              {/* Price + change */}
              <div className="mb-6">
                <p className="text-4xl font-bold text-gray-900 tracking-tight">{fmt(selectedHolding.last_price)}</p>
                <p className={`text-base font-medium mt-1 ${selectedHolding.day_change >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                  {sign(selectedHolding.day_change)}{fmt(selectedHolding.day_change)} ({sign(selectedHolding.day_change_percentage)}{fmtN(selectedHolding.day_change_percentage)}%) today
                </p>
              </div>

              {/* Chart */}
              <div className="mb-8" style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={chartColor} stopOpacity={0.12} />
                        <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} interval={6} />
                    <YAxis hide domain={['auto', 'auto']} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="price"
                      stroke={chartColor}
                      strokeWidth={2}
                      fill="url(#chartGrad)"
                      dot={false}
                      activeDot={{ r: 4, fill: chartColor, strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-0 mb-8 rounded-xl border border-gray-100 overflow-hidden">
                {[
                  { label: 'Avg Buy Price', value: fmt(selectedHolding.average_price) },
                  { label: 'Current Price', value: fmt(selectedHolding.last_price) },
                  { label: 'Quantity',       value: selectedHolding.quantity },
                  { label: 'Invested',       value: fmt(selectedHolding.quantity * selectedHolding.average_price) },
                  { label: 'Current Value',  value: fmt(selectedHolding.quantity * selectedHolding.last_price) },
                  { label: 'Total P&L',      value: fmt(selectedHolding.pnl), colored: true, val: selectedHolding.pnl },
                ].map(({ label, value, colored, val }, i) => (
                  <div key={label} className={`px-5 py-4 bg-white ${i < 3 ? 'border-b border-gray-100' : ''} ${i % 3 !== 2 ? 'border-r border-gray-100' : ''}`}>
                    <p className="text-xs text-gray-400 mb-1">{label}</p>
                    <p className={`text-sm font-semibold ${colored ? (val >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]') : 'text-gray-900'}`}>
                      {colored && sign(val)}{value}
                    </p>
                  </div>
                ))}
              </div>

              {/* AI reason */}
              {selectedHolding.rec_reason && (
                <div className="rounded-xl bg-gray-50 px-5 py-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">AI Insight</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{selectedHolding.rec_reason}</p>
                </div>
              )}
            </div>

          ) : (
            /* ── Placeholder when nothing selected ───────────────────────────── */
            <div className="flex flex-col items-center justify-center h-full px-8 text-center">
              {overview && (
                <div className="w-full max-w-md mb-10">
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: 'Invested',      value: fmt(overview.total_invested) },
                      { label: 'Current Value', value: fmt(overview.current_value) },
                      { label: 'Total Return',  value: `${sign(overview.total_pnl_pct)}${fmtN(overview.total_pnl_pct)}%`, colored: true, val: overview.total_pnl },
                    ].map(({ label, value, colored, val }) => (
                      <div key={label} className="rounded-xl bg-gray-50 px-4 py-4">
                        <p className="text-xs text-gray-400 mb-1.5">{label}</p>
                        <p className={`text-base font-bold ${colored ? (val >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]') : 'text-gray-900'}`}>{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-col items-center text-gray-300 gap-2">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/>
                </svg>
                <p className="text-sm text-gray-400">Select a holding to view chart &amp; details</p>
              </div>
            </div>
          )}
        </main>

        {/* ══ RIGHT PANEL (320px): AI Analysis + Chat ═════════════════════════════ */}
        <aside
          className="flex-shrink-0 border-l border-gray-100 flex flex-col overflow-hidden bg-[#FAFAF9]"
          style={{ width: 320 }}
        >

          {/* ── 1. Portfolio Health ──────────────────────────────────────────── */}
          <div className="flex-shrink-0 px-5 py-4 border-b border-gray-100">
            {loadingData ? (
              <div className="flex flex-col items-center gap-3 py-1">
                <div className="w-20 h-20 rounded-full bg-gray-100 animate-pulse" />
                <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
              </div>
            ) : (
              <HealthRing score={healthScore} />
            )}
            {overview && !loadingData && (
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  ↑ <strong className="text-[#16A34A] font-semibold">{overview.top_gainer}</strong>
                </span>
                <span className="text-xs text-gray-400">
                  ↓ <strong className="text-[#DC2626] font-semibold">{overview.top_loser}</strong>
                </span>
              </div>
            )}
          </div>

          {/* ── 2. AI Assessment (collapsible) ──────────────────────────────── */}
          <div className="flex-shrink-0 border-b border-gray-100 flex flex-col" style={{ maxHeight: aiOpen ? 270 : 'none' }}>

            {/* Toggle header */}
            <button
              onClick={() => setAiOpen(!aiOpen)}
              className="flex-shrink-0 flex items-center justify-between px-5 py-3 hover:bg-gray-100/60 transition-colors"
            >
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">AI Assessment</span>
              <svg
                width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: aiOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
              >
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>

            {aiOpen && (
              <div className="overflow-y-auto px-4 pb-4 flex flex-col gap-2.5">

                {/* Loading */}
                {loadingAI && (
                  <div className="flex items-center justify-center gap-2 py-5 text-xs text-gray-400">
                    <Spinner /> Analysing portfolio…
                  </div>
                )}

                {/* Error */}
                {aiError && !loadingAI && (
                  <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2.5 text-xs text-red-600 flex items-start justify-between gap-2">
                    <span>{aiError}</span>
                    <button onClick={() => setAiError(null)} className="text-red-400 hover:text-red-600 flex-shrink-0">✕</button>
                  </div>
                )}

                {/* Analysis content */}
                {analysis && !loadingAI && (
                  <>
                    {analysis.portfolio_health && (
                      <div className="rounded-lg bg-white border border-gray-100 px-3 py-2.5">
                        <p className="text-xs text-gray-600 leading-relaxed">{analysis.portfolio_health}</p>
                      </div>
                    )}
                    {analysis.suggestions?.length > 0 && (
                      <div className="space-y-1.5">
                        {analysis.suggestions.map((s, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-2 rounded-lg bg-white border border-gray-100 px-3 py-2.5"
                            style={{ borderLeft: '3px solid #0F766E' }}
                          >
                            <span className="text-xs font-bold text-teal-700 flex-shrink-0 mt-px">{i + 1}.</span>
                            <p className="text-xs text-gray-600 leading-relaxed">{s}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* Empty state */}
                {!analysis && !loadingAI && !aiError && (
                  <p className="text-xs text-gray-400 text-center py-2">No analysis yet</p>
                )}

                {/* Run button */}
                <button
                  onClick={runAnalysis}
                  disabled={loadingAI}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-[#16A34A] hover:bg-[#15803D] disabled:opacity-50 text-xs font-semibold text-white transition-colors mt-0.5"
                >
                  {loadingAI ? <><Spinner white sm /> Analysing…</> : 'Run AI Analysis'}
                </button>
              </div>
            )}
          </div>

          {/* ── 3. Portfolio Chat ────────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col min-h-0">

            {/* Section title */}
            <div className="flex-shrink-0 px-5 py-2.5 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Ask about your portfolio</p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
              {chatMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center py-4 gap-2">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                  </svg>
                  <p className="text-xs text-gray-300">Ask anything about your holdings</p>
                </div>
              )}
              {chatMessages.map((msg, i) => {
                const isLast = i === chatMessages.length - 1
                const isEmpty = msg.content === ''
                return (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-gray-900 text-white rounded-tr-sm'
                        : 'bg-white border border-gray-100 text-gray-700 rounded-tl-sm shadow-sm'
                    }`}>
                      {isEmpty && chatLoading && isLast ? <TypingDots /> : msg.content || '…'}
                    </div>
                  </div>
                )
              })}
              <div ref={chatEndRef} />
            </div>

            {/* Starter chips — shown only before first message */}
            {chatMessages.length === 0 && (
              <div className="flex-shrink-0 px-3 pb-2 flex flex-col gap-1.5">
                {['Should I rebalance?', "What's my biggest risk?", 'Which stock should I exit?'].map(q => (
                  <button
                    key={q}
                    onClick={() => sendChat(q)}
                    disabled={chatLoading}
                    className="text-left text-xs px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-500 hover:border-teal-400 hover:text-teal-700 hover:bg-teal-50/40 transition-colors disabled:opacity-40"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Input row */}
            <div className="flex-shrink-0 p-3 border-t border-gray-100">
              <div className="flex gap-2">
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey && chatInput.trim() && !chatLoading) {
                      e.preventDefault()
                      sendChat(chatInput.trim())
                    }
                  }}
                  placeholder="Ask anything…"
                  className="flex-1 text-xs px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 placeholder-gray-300"
                />
                <button
                  onClick={() => chatInput.trim() && !chatLoading && sendChat(chatInput.trim())}
                  disabled={chatLoading || !chatInput.trim()}
                  className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-[#16A34A] hover:bg-[#15803D] disabled:opacity-40 transition-colors"
                >
                  {chatLoading
                    ? <Spinner white sm />
                    : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 2L11 13M22 2L15 22l-4-9-9-4z"/>
                      </svg>
                    )
                  }
                </button>
              </div>
            </div>
          </div>
        </aside>

      </div>
    </div>
  )
}
