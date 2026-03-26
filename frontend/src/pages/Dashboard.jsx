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
    <div className="bg-white border border-[#E8E4DC] rounded-2xl p-6 flex flex-col gap-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="w-12 h-12 rounded-xl bg-[#F5F0E8] flex items-center justify-center text-2xl">{icon}</div>
        {tag && (
          <span className="px-2.5 py-1 text-xs rounded-full bg-[#1A6B5A]/10 border border-[#1A6B5A]/20 text-[#1A6B5A] font-medium">
            {tag}
          </span>
        )}
      </div>
      <div>
        <h3 className="font-semibold text-lg mb-1 text-[#0A0A0A]">{title}</h3>
        <p className="text-sm text-[#A39E98]">{subtitle}</p>
      </div>
      <div className="mt-auto pt-4 border-t border-[#E8E4DC]">
        <div className="h-2 rounded-full bg-[#F5F0E8] animate-shimmer" />
        <div className="grid grid-cols-3 gap-2 mt-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-[#F5F0E8]" />
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
    <div className="min-h-screen bg-[#FAFAF8] text-[#0A0A0A]">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-[#FAFAF8]/90 backdrop-blur-md border-b border-[#E8E4DC]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#1A6B5A] flex items-center justify-center font-bold text-xs text-white">N</div>
            <span className="font-serif font-semibold text-lg text-[#0A0A0A]">Nuvest</span>
          </button>
          <div className="flex items-center gap-6">
            <button onClick={() => navigate('/portfolio')} className="text-sm text-[#6B6560] hover:text-[#0A0A0A] transition-colors">
              Portfolio
            </button>
            <button onClick={() => navigate('/demo')} className="text-sm text-[#6B6560] hover:text-[#0A0A0A] transition-colors">
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
              <p className="text-sm text-[#A39E98] mb-1">Your Dashboard</p>
              <h1 className="font-serif text-3xl font-bold text-[#0A0A0A]">Financial Overview</h1>
            </div>
            <div className="flex items-center gap-4">
              <RiskBadge tier={mockScore.risk_tier} size="lg" />
            </div>
          </div>

          {/* Score summary banner */}
          <div className="mb-8 p-6 rounded-2xl bg-[#1A6B5A]/8 border border-[#1A6B5A]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            style={{ background: 'rgba(26,107,90,0.06)' }}>
            <div>
              <p className="text-sm text-[#1A6B5A] font-medium mb-1">Your current credit score</p>
              <div className="font-serif text-5xl font-bold text-[#0A0A0A]">{mockScore.score}</div>
              <p className="text-[#6B6560] text-sm mt-1">Based on your most recent profile submission</p>
            </div>
            <button
              onClick={() => navigate('/demo')}
              className="self-start sm:self-auto px-5 py-2.5 bg-[#1A6B5A] hover:bg-[#155A4A] rounded-xl text-sm font-medium text-white transition-colors shadow-sm"
            >
              Update profile →
            </button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Credit Score',    value: '712',    sub: '+12 this month',       color: 'text-emerald-700' },
              { label: 'Risk Tier',       value: 'Low',    sub: 'Top 30%',              color: 'text-emerald-700' },
              { label: 'SIP Capacity',    value: '₹4,200', sub: 'Recommended / mo',     color: 'text-[#1A6B5A]'  },
              { label: 'Tax Saving Opp.', value: '₹12,400',sub: 'Estimated annual',     color: 'text-amber-700'  },
            ].map((s) => (
              <div key={s.label} className="bg-white border border-[#E8E4DC] rounded-xl p-4 shadow-sm">
                <p className="text-xs text-[#A39E98] mb-1">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-[#C4BFB8] mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Feature panels */}
          <div className="grid md:grid-cols-2 gap-6">
            <div
              className="bg-white border border-[#E8E4DC] rounded-2xl p-6 flex flex-col gap-4 cursor-pointer hover:border-[#1A6B5A]/40 hover:shadow-md transition-all shadow-sm"
              onClick={() => navigate('/portfolio')}
            >
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-xl bg-[#F5F0E8] flex items-center justify-center text-2xl">📊</div>
                <span className="px-2.5 py-1 text-xs rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium">Live</span>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1 text-[#0A0A0A]">Zerodha Portfolio</h3>
                <p className="text-sm text-[#A39E98]">View your holdings, P&L, and get AI-powered Buy/Hold/Sell recommendations per stock.</p>
              </div>
              <div className="mt-auto pt-4 border-t border-[#E8E4DC]">
                <span className="text-sm text-[#1A6B5A] font-medium">Open Portfolio →</span>
              </div>
            </div>

            <PlaceholderCard
              icon="📈"
              title="SIP & ETF Recommendations"
              subtitle="Personalised mutual fund and ETF picks based on your Low risk tier. Dynamic rebalancing suggestions coming next."
              tag="Phase 3 — Coming Soon"
            />
            <PlaceholderCard
              icon="💰"
              title="Tax Optimizer & Harvesting Advisor"
              subtitle="Connect your portfolio to get AI-powered tax-loss harvesting suggestions and Section 80C optimisation."
              tag="Phase 3 — Coming Soon"
            />
          </div>

          {/* Broker integration teaser */}
          <div className="mt-6 p-6 rounded-2xl bg-white border border-[#E8E4DC] border-dashed shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
              <div>
                <p className="text-sm text-[#A39E98] mb-1">Broker Integration</p>
                <h3 className="font-semibold text-lg text-[#0A0A0A]">Connect Zerodha or Upstox</h3>
                <p className="text-sm text-[#A39E98] mt-1">Link your brokerage account to enable real portfolio analysis and live recommendations.</p>
              </div>
              <div className="flex gap-3">
                <button className="px-4 py-2 rounded-lg bg-[#F5F0E8] border border-[#E8E4DC] text-sm font-medium text-[#6B6560] hover:border-[#1A6B5A]/40 transition-colors">
                  Zerodha Kite
                </button>
                <button className="px-4 py-2 rounded-lg bg-[#F5F0E8] border border-[#E8E4DC] text-sm font-medium text-[#6B6560] hover:border-[#1A6B5A]/40 transition-colors">
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
