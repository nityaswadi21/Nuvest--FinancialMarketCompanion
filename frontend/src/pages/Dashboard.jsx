import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import RiskBadge from '../components/RiskBadge'
import TrajectoryChart from '../components/TrajectoryChart'

const mockScore = { score: 712, risk_tier: 'Low' }

const PERSONAS = {
  priya: {
    label: 'Priya',
    sub: 'Low risk · ~780',
    color: 'emerald',
    features: {
      avg_txn_freq: 28, txn_freq_trend: 3, consistency_score: 0.18,
      recency_score: 1.0, category_diversity: 8, avg_amount: 950,
      amount_volatility: 200, fail_ratio: 0.02, utility_streak: 1.0,
      total_volume: 45000, recharge_count: 6,
    },
  },
  ravi: {
    label: 'Ravi',
    sub: 'Medium risk · ~600',
    color: 'amber',
    features: {
      avg_txn_freq: 12, txn_freq_trend: -1, consistency_score: 0.09,
      recency_score: 0.83, category_diversity: 4, avg_amount: 420,
      amount_volatility: 380, fail_ratio: 0.09, utility_streak: 0.67,
      total_volume: 18000, recharge_count: 3,
    },
  },
  anand: {
    label: 'Anand',
    sub: 'High risk · ~420',
    color: 'red',
    features: {
      avg_txn_freq: 5, txn_freq_trend: -3, consistency_score: 0.04,
      recency_score: 0.5, category_diversity: 2, avg_amount: 180,
      amount_volatility: 210, fail_ratio: 0.28, utility_streak: 0.17,
      total_volume: 4000, recharge_count: 1,
    },
  },
}

const COLOR_CLASSES = {
  emerald: { btn: 'bg-emerald-600/15 border-emerald-500/40 text-emerald-300', active: 'bg-emerald-600/30 border-emerald-400' },
  amber:   { btn: 'bg-amber-600/15 border-amber-500/40 text-amber-300',       active: 'bg-amber-600/30 border-amber-400' },
  red:     { btn: 'bg-red-600/15 border-red-500/40 text-red-300',             active: 'bg-red-600/30 border-red-400' },
}

function PlaceholderCard({ icon, title, subtitle, tag }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center text-2xl">{icon}</div>
        {tag && (
          <span className="px-2.5 py-1 text-xs rounded-full bg-blue-600/15 border border-blue-600/30 text-blue-400 font-medium">
            {tag}
          </span>
        )}
      </div>
      <div>
        <h3 className="font-semibold text-lg mb-1">{title}</h3>
        <p className="text-sm text-gray-500">{subtitle}</p>
      </div>
      <div className="mt-auto pt-4 border-t border-gray-800">
        <div className="h-2 rounded-full bg-gray-800 animate-shimmer" />
        <div className="grid grid-cols-3 gap-2 mt-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-gray-800/60" />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [activePersona, setActivePersona] = useState(null)
  const [trajectory, setTrajectory] = useState(null)
  const [trajLoading, setTrajLoading] = useState(false)

  const loadTrajectory = async (key) => {
    if (activePersona === key) return
    setActivePersona(key)
    setTrajLoading(true)
    setTrajectory(null)
    try {
      const res = await fetch('/trajectory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(PERSONAS[key].features),
      })
      const data = await res.json()
      setTrajectory(data)
    } catch {
      // ignore
    } finally {
      setTrajLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-gray-950/80 backdrop-blur border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-sm">C</div>
            <span className="font-semibold text-lg">CreditAI</span>
          </button>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/demo')} className="text-sm text-gray-400 hover:text-white transition-colors">
              Recalculate score
            </button>
          </div>
        </div>
      </nav>

      <div className="pt-24 pb-16 px-6">
        <div className="max-w-6xl mx-auto">

          {/* Header row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
            <div>
              <p className="text-sm text-gray-500 mb-1">Your Dashboard</p>
              <h1 className="text-3xl font-bold">Financial Overview</h1>
            </div>
            <div className="flex items-center gap-4">
              <RiskBadge tier={mockScore.risk_tier} size="lg" />
            </div>
          </div>

          {/* Score summary banner */}
          <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-blue-600/15 to-violet-600/10 border border-blue-600/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm text-blue-400 mb-1">Your current credit score</p>
              <div className="text-5xl font-bold text-white">{mockScore.score}</div>
              <p className="text-gray-400 text-sm mt-1">Based on your most recent profile submission</p>
            </div>
            <button
              onClick={() => navigate('/demo')}
              className="self-start sm:self-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-medium transition-colors"
            >
              Update profile →
            </button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Credit Score', value: '712', sub: '+12 this month', color: 'text-emerald-400' },
              { label: 'Risk Tier', value: 'Low', sub: 'Top 30%', color: 'text-emerald-400' },
              { label: 'SIP Capacity', value: '₹4,200', sub: 'Recommended / mo', color: 'text-blue-400' },
              { label: 'Tax Saving Opp.', value: '₹12,400', sub: 'Estimated annual', color: 'text-violet-400' },
            ].map((s) => (
              <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-600 mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Feature panels */}
          <div className="grid md:grid-cols-2 gap-6">
            <PlaceholderCard
              icon="📈"
              title="SIP & ETF Recommendations"
              subtitle="Personalized mutual fund and ETF picks based on your Low risk tier. Dynamic rebalancing suggestions coming next."
              tag="Phase 3 — Coming Soon"
            />
            <PlaceholderCard
              icon="💰"
              title="Tax Optimizer & Harvesting Advisor"
              subtitle="Connect your portfolio to get AI-powered tax-loss harvesting suggestions and Section 80C optimization."
              tag="Phase 3 — Coming Soon"
            />
          </div>

          {/* Score Trajectory */}
          <div className="mt-6 bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
              <div>
                <h3 className="font-semibold text-lg">90-Day Score Trajectory</h3>
                <p className="text-sm text-gray-500 mt-0.5">See how your score could grow — and the top actions to get there faster.</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(PERSONAS).map(([key, p]) => {
                  const cls = COLOR_CLASSES[p.color]
                  const isActive = activePersona === key
                  return (
                    <button
                      key={key}
                      onClick={() => loadTrajectory(key)}
                      className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                        isActive ? cls.active : cls.btn
                      } hover:opacity-90`}
                    >
                      <span className="font-semibold">{p.label}</span>
                      <span className="ml-1 opacity-70">{p.sub}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {!activePersona && (
              <div className="flex items-center justify-center h-40 text-gray-600 text-sm">
                Select a persona above to see their score trajectory
              </div>
            )}

            {trajLoading && (
              <div className="flex items-center justify-center h-40">
                <svg className="animate-spin h-6 w-6 text-blue-500" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
              </div>
            )}

            {trajectory && !trajLoading && (
              <TrajectoryChart data={trajectory} />
            )}
          </div>

          {/* Zerodha / Upstox integration teaser */}
          <div className="mt-6 p-6 rounded-2xl bg-gray-900 border border-gray-800 border-dashed">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Broker Integration</p>
                <h3 className="font-semibold text-lg">Connect Zerodha or Upstox</h3>
                <p className="text-sm text-gray-500 mt-1">Link your brokerage account to enable real portfolio analysis and live recommendations.</p>
              </div>
              <div className="flex gap-3">
                <button className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm font-medium text-gray-300 hover:border-gray-600 transition-colors">
                  Zerodha Kite
                </button>
                <button className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm font-medium text-gray-300 hover:border-gray-600 transition-colors">
                  Upstox
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
