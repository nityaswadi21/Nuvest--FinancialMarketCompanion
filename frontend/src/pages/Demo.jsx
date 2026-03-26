import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import ScoreCard from '../components/ScoreCard'
import ShapChart from '../components/ShapChart'

// ---------------------------------------------------------------------------
// Option constants
// ---------------------------------------------------------------------------
const EMPLOYMENT_OPTS = [
  { value: 0, label: 'Unemployed' },
  { value: 1, label: 'Freelance' },
  { value: 2, label: 'Salaried' },
]
const RECHARGE_OPTS = [
  { value: 0, label: 'Rarely' },
  { value: 1, label: 'Monthly' },
  { value: 2, label: 'Weekly+' },
]
const RENT_OPTS = [
  { value: 0, label: 'Irregular / No rent' },
  { value: 1, label: 'Consistent & regular' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function addMonths(isoDate, months) {
  const d = new Date(isoDate + 'T00:00:00')
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function tierColor(score) {
  if (score >= 750) return '#1D9E75'
  if (score >= 650) return '#378ADD'
  if (score >= 550) return '#BA7517'
  return '#E24B4A'
}

function incomeBracketLabel(income) {
  if (!income || income <= 0) return null
  if (income < 10000) return '< ₹10,000 bracket'
  if (income < 25000) return '₹10,000 – ₹25,000 bracket'
  if (income < 50000) return '₹25,000 – ₹50,000 bracket'
  if (income < 100000) return '₹50,000 – ₹1,00,000 bracket'
  return '> ₹1,00,000 bracket'
}

const today = new Date().toISOString().slice(0, 10)
const minDate = addMonths(today, 1)
const maxDate = addMonths(today, 24)

// ---------------------------------------------------------------------------
// Feature derivation — 6 user inputs → 11 trajectory model features
// ---------------------------------------------------------------------------
function deriveFeatures({ upiCount, billPct, rentRegularity, income, rechargeFreq, employmentType }) {
  const avg_txn_freq = Number(upiCount)
  // billPct is 0-100
  const fail_ratio = parseFloat((1 - billPct / 100).toFixed(2))
  const consistency_score = parseFloat((billPct / 400).toFixed(3))
  const utility_streak = parseFloat((billPct / 100).toFixed(2))

  // rentRegularity: 0 = irregular, 1 = consistent
  const recency_score = rentRegularity === 1 ? 1.0 : 0.5
  const txn_freq_trend = rentRegularity === 1 ? 2 : -1

  let avg_amount, amount_volatility, total_volume
  const inc = Number(income)
  if (inc < 10000)       { avg_amount = 180;  amount_volatility = 120; total_volume = 3500  }
  else if (inc < 25000)  { avg_amount = 420;  amount_volatility = 280; total_volume = 9000  }
  else if (inc < 50000)  { avg_amount = 750;  amount_volatility = 380; total_volume = 22000 }
  else if (inc < 100000) { avg_amount = 1400; amount_volatility = 600; total_volume = 45000 }
  else                   { avg_amount = 2800; amount_volatility = 900; total_volume = 95000 }

  // rechargeFreq: 0=Rarely, 1=Monthly, 2=Weekly+
  const recharge_count = rechargeFreq === 0 ? 1 : rechargeFreq === 1 ? 5 : 10

  // employmentType: 0=Unemployed, 1=Freelance, 2=Salaried
  const category_diversity = employmentType === 0 ? 2 : employmentType === 1 ? 5 : 7

  return {
    avg_txn_freq, txn_freq_trend, consistency_score, recency_score,
    category_diversity, avg_amount, amount_volatility, fail_ratio,
    utility_streak, total_volume, recharge_count,
  }
}

// ---------------------------------------------------------------------------
// InputField wrapper
// ---------------------------------------------------------------------------
function InputField({ label, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#0A0A0A] mb-1.5">{label}</label>
      {hint && <p className="text-xs text-[#A39E98] mb-2">{hint}</p>}
      {children}
    </div>
  )
}

const inputClass =
  'w-full px-4 py-3 bg-white border border-[#D5D0C8] rounded-xl text-[#0A0A0A] placeholder-[#A39E98] focus:outline-none focus:border-[#1A6B5A] focus:ring-1 focus:ring-[#1A6B5A] transition-colors text-sm'

const btnActiveClass = 'bg-[#1A6B5A]/10 border-[#1A6B5A] text-[#1A6B5A]'
const btnInactiveClass = 'bg-white border-[#D5D0C8] text-[#6B6560] hover:border-[#A39E98]'

// ---------------------------------------------------------------------------
// Plan chart (SVG) — uses optimize_to_target response
// ---------------------------------------------------------------------------
function PlanChart({ plan }) {
  const W = 560, H = 220
  const PAD = { top: 20, right: 28, bottom: 44, left: 52 }
  const IW = W - PAD.left - PAD.right
  const IH = H - PAD.top - PAD.bottom

  const { current_score, baseline_scores, optimistic_scores, months_list, timeline, months_available } = plan
  const minS = 300, maxS = 900

  const toX = m => PAD.left + (m / months_available) * IW
  const toY = s => PAD.top + IH - ((s - minS) / (maxS - minS)) * IH

  const pathOf = pts => pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  const basePts = [{ x: toX(0), y: toY(current_score) },
    ...months_list.map((m, i) => ({ x: toX(m), y: toY(baseline_scores[i]) }))]
  const optPts = [{ x: toX(0), y: toY(current_score) },
    ...months_list.map((m, i) => ({ x: toX(m), y: toY(optimistic_scores[i]) }))]

  const yTicks = [300, 450, 600, 750, 900]
  const xLabels = timeline.slice(0, months_available + 1).filter((_, i) => {
    if (months_available <= 6) return true
    return i % Math.ceil(months_available / 6) === 0 || i === months_available
  })

  const lrCross = timeline.find(e => e.is_low_risk_crossing)
  const targetM = months_available

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 320 }}>
        <rect x={PAD.left} y={toY(750)} width={IW} height={toY(650) - toY(750)} fill="#1D9E7508" />
        <rect x={PAD.left} y={toY(650)} width={IW} height={toY(550) - toY(650)} fill="#378ADD08" />

        {yTicks.map(v => (
          <g key={v}>
            <line x1={PAD.left} y1={toY(v)} x2={W - PAD.right} y2={toY(v)}
              stroke={v === 750 ? '#1D9E7530' : v === 600 ? '#BA751730' : '#2a2d3a'}
              strokeWidth={v === 750 || v === 600 ? 1.5 : 1}
              strokeDasharray={v === 750 || v === 600 ? '4 3' : undefined} />
            <text x={PAD.left - 6} y={toY(v) + 4} fill="#555" fontSize={10} textAnchor="end">{v}</text>
          </g>
        ))}

        <text x={W - PAD.right + 2} y={toY(750) + 4} fill="#1D9E75" fontSize={9}>750</text>
        <text x={W - PAD.right + 2} y={toY(600) + 4} fill="#BA7517" fontSize={9}>600</text>

        <line x1={toX(targetM)} y1={PAD.top} x2={toX(targetM)} y2={H - PAD.bottom}
          stroke="#ffffff30" strokeWidth={1} strokeDasharray="4 3" />
        <text x={toX(targetM)} y={PAD.top - 4} fill="#aaa" fontSize={9} textAnchor="middle">Target</text>

        <path d={[
          pathOf(optPts),
          ...basePts.slice().reverse().map((p, i) => `${i === 0 ? 'L' : 'L'} ${p.x} ${p.y}`),
          'Z'
        ].join(' ')} fill="#1D9E7510" />

        <path d={pathOf(basePts)} fill="none" stroke="#555" strokeWidth={1.5} strokeDasharray="5 4" />
        <path d={pathOf(optPts)} fill="none" stroke="#1D9E75" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

        {optPts.map((p, i) => {
          const isLR = lrCross && i > 0 && months_list[i - 1] === lrCross.month_number
          const isTarget = i === months_available
          const finalScore = optimistic_scores[months_available - 1]
          return (
            <circle key={i} cx={p.x} cy={p.y}
              r={isLR || isTarget ? 6 : 3.5}
              fill={isLR ? '#1D9E75' : isTarget && finalScore >= 750 ? '#1D9E75' : isTarget ? '#BA7517' : '#1D9E75'}
              stroke="#0f1117" strokeWidth={2} />
          )
        })}

        {lrCross && (() => {
          const m = lrCross.month_number
          const p = optPts[m]
          return p ? (
            <text x={p.x} y={p.y - 10} fill="#1D9E75" fontSize={9} textAnchor="middle">Low Risk</text>
          ) : null
        })()}

        {xLabels.map(e => (
          <text key={e.month_number} x={toX(e.month_number)} y={H - 6}
            fill="#555" fontSize={9} textAnchor="middle">
            {e.date_display.slice(0, 6)}
          </text>
        ))}
      </svg>

      <div className="flex items-center gap-6 mt-1 px-1">
        <div className="flex items-center gap-2">
          <svg width={24} height={4}><line x1={0} y1={2} x2={24} y2={2} stroke="#555" strokeWidth={1.5} strokeDasharray="4 3" /></svg>
          <span className="text-xs text-gray-500">Baseline</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width={24} height={4}><line x1={0} y1={2} x2={24} y2={2} stroke="#1D9E75" strokeWidth={2} /></svg>
          <span className="text-xs text-gray-400">With recommendations</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width={16} height={4}><line x1={0} y1={2} x2={16} y2={2} stroke="#1D9E7560" strokeWidth={1.5} strokeDasharray="3 2" /></svg>
          <span className="text-xs text-gray-500">Low Risk 750</span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function Demo() {
  const navigate = useNavigate()

  const [inputs, setInputs] = useState({
    upiCount: 10,
    billPct: 50,
    rentRegularity: '',   // '' | 0 | 1
    income: '',
    rechargeFreq: '',     // '' | 0 | 1 | 2
    employmentType: '',   // '' | 0 | 1 | 2
  })
  const setInput = (k, v) => setInputs(prev => ({ ...prev, [k]: v }))

  const [showTech, setShowTech] = useState(false)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [targetDate, setTargetDate] = useState('')
  const [suggest, setSuggest] = useState(null)

  const [plan, setPlan] = useState(null)
  const [planLoading, setPlanLoading] = useState(false)
  const [planError, setPlanError] = useState(null)

  const [applied, setApplied] = useState(false)

  const planRef = useRef(null)
  const dateRef = useRef(null)

  const incomeNum = parseInt(inputs.income) || 0

  // Derived 11 features (live preview for tech panel)
  const derived = deriveFeatures({
    upiCount: inputs.upiCount,
    billPct: inputs.billPct,
    rentRegularity: inputs.rentRegularity === '' ? 0 : inputs.rentRegularity,
    income: incomeNum,
    rechargeFreq: inputs.rechargeFreq === '' ? 1 : inputs.rechargeFreq,
    employmentType: inputs.employmentType === '' ? 2 : inputs.employmentType,
  })

  const isFormValid = (
    inputs.upiCount > 0 &&
    inputs.rentRegularity !== '' &&
    incomeNum > 0 &&
    inputs.rechargeFreq !== '' &&
    inputs.employmentType !== ''
  )

  // Auto-suggest target date when score arrives
  useEffect(() => {
    if (!result?.score) return
    fetch(`/optimize/suggest?current_score=${result.score}`)
      .then(r => r.json())
      .then(d => {
        setSuggest(d)
        if (d.suggested_date && d.suggested_months > 0) setTargetDate(d.suggested_date)
      })
      .catch(() => { })
  }, [result?.score])

  // Scroll to plan when it loads
  useEffect(() => {
    if (plan) setTimeout(() => planRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }, [plan])

  // POST /score (optimize router — 11 features)
  const submit = async e => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)
    setPlan(null)
    setApplied(false)
    try {
      const features = deriveFeatures({
        upiCount: inputs.upiCount,
        billPct: inputs.billPct,
        rentRegularity: inputs.rentRegularity,
        income: incomeNum,
        rechargeFreq: inputs.rechargeFreq,
        employmentType: inputs.employmentType,
      })
      const res = await fetch('/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(features),
      })
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      setResult(await res.json())
      setTimeout(() => dateRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // POST /optimize?target_date=...
  const getPlan = async () => {
    if (!targetDate) return
    setPlanLoading(true)
    setPlanError(null)
    try {
      const features = deriveFeatures({
        upiCount: inputs.upiCount,
        billPct: inputs.billPct,
        rentRegularity: inputs.rentRegularity,
        income: incomeNum,
        rechargeFreq: inputs.rechargeFreq,
        employmentType: inputs.employmentType,
      })
      const res = await fetch(`/optimize?target_date=${targetDate}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(features),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.detail || `Server error ${res.status}`)
      }
      setPlan(await res.json())
    } catch (err) {
      setPlanError(err.message)
    } finally {
      setPlanLoading(false)
    }
  }

  // Re-score after applying recommendations
  const applyRecs = async () => {
    if (!plan?.recommendations) return
    const base = deriveFeatures({
      upiCount: inputs.upiCount,
      billPct: inputs.billPct,
      rentRegularity: inputs.rentRegularity,
      income: incomeNum,
      rechargeFreq: inputs.rechargeFreq,
      employmentType: inputs.employmentType,
    })
    const newFeatures = { ...base }
    plan.recommendations.forEach(r => { newFeatures[r.feature] = r.target_value })
    setApplied(true)
    try {
      const res = await fetch('/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newFeatures),
      })
      if (res.ok) setResult(await res.json())
    } catch { }
  }

  const chipMonths = [1, 3, 6, 9, 12]

  const FEAS_COLOR = pct => pct >= 75 ? '#1D9E75' : pct >= 50 ? '#BA7517' : '#E24B4A'
  const FEAS_LABEL = pct => pct >= 75 ? 'On track' : pct >= 50 ? 'Stretch goal — start immediately' : 'Not feasible — see suggested date below'

  const URGENCY_COLOR  = u => u === 'now' ? '#E24B4A' : u === 'soon' ? '#BA7517' : '#1D9E75'
  const URGENCY_BG     = u => u === 'now' ? '#E24B4A18' : u === 'soon' ? '#BA751718' : '#1D9E7518'
  const URGENCY_BORDER = u => u === 'now' ? '#E24B4A40' : u === 'soon' ? '#BA751740' : '#1D9E7540'

  const fmtDerived = (key, val) => {
    const currencyKeys = ['avg_amount', 'amount_volatility', 'total_volume']
    if (currencyKeys.includes(key)) return `₹${Number(val).toLocaleString('en-IN')}`
    if (typeof val === 'number' && !Number.isInteger(val)) return val.toFixed(3)
    return String(val)
  }

  const techFields = [
    ['avg_txn_freq', 'avg_txn_freq'], ['fail_ratio', 'fail_ratio'],
    ['consistency_score', 'consistency'], ['utility_streak', 'utility_streak'],
    ['recency_score', 'recency_score'], ['txn_freq_trend', 'txn_freq_trend'],
    ['category_diversity', 'category_div'], ['avg_amount', 'avg_amount'],
    ['amount_volatility', 'volatility'], ['total_volume', 'total_volume'],
    ['recharge_count', 'recharge_count'],
  ]

  // =========================================================================
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
            <button onClick={() => navigate('/dashboard')} className="text-sm text-[#6B6560] hover:text-[#0A0A0A] transition-colors">
              Dashboard
            </button>
            <button onClick={() => navigate('/portfolio')} className="text-sm text-[#6B6560] hover:text-[#0A0A0A] transition-colors">
              Portfolio
            </button>
          </div>
        </div>
      </nav>

      <div className="pt-24 pb-20 px-6">
        <div className="max-w-6xl mx-auto">

          {/* Header */}
          <div className="text-center mb-12">
            <p className="text-sm text-[#1A6B5A] font-medium tracking-wide uppercase mb-3">AI Credit Scoring</p>
            <h1 className="font-serif text-4xl font-bold text-[#0A0A0A] mb-3">Check your credit score</h1>
            <p className="text-[#6B6560] max-w-md mx-auto">
              Fill in your alternative data profile — no bank account or credit history needed.
            </p>
          </div>

          {/* Step A: form + result */}
          <div className="grid lg:grid-cols-2 gap-8 items-start">

            {/* Form */}
            <div className="bg-white border border-[#E8E4DC] rounded-2xl p-8 shadow-sm">
              <form onSubmit={submit} className="space-y-6">

                <InputField label="UPI Transactions per Month" hint="How many digital payments do you make via UPI?">
                  <input
                    type="number" min={0} max={200}
                    value={inputs.upiCount}
                    onChange={e => setInput('upiCount', Number(e.target.value))}
                    className={inputClass}
                    placeholder="e.g. 20"
                  />
                </InputField>

                <InputField label="Bill Payment On-Time" hint="What percentage of utility bills do you pay on time?">
                  <div className="space-y-2">
                    <input
                      type="range" min={0} max={100} step={1}
                      value={inputs.billPct}
                      onChange={e => setInput('billPct', Number(e.target.value))}
                      className="w-full accent-[#1A6B5A]"
                    />
                    <div className="flex justify-between text-xs text-[#A39E98]">
                      <span>0% — Never</span>
                      <span className="text-[#1A6B5A] font-semibold">{inputs.billPct}%</span>
                      <span>100% — Always</span>
                    </div>
                  </div>
                </InputField>

                <InputField label="Rent Payment Regularity">
                  <div className="grid grid-cols-2 gap-3">
                    {RENT_OPTS.map(({ value, label }) => (
                      <button
                        type="button" key={value}
                        onClick={() => setInput('rentRegularity', value)}
                        className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all ${inputs.rentRegularity === value ? btnActiveClass : btnInactiveClass}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </InputField>

                <InputField label="Monthly Income Estimate (₹)" hint="Approximate monthly take-home income">
                  <input
                    type="number" min={0} step={1000}
                    value={inputs.income}
                    onChange={e => setInput('income', e.target.value)}
                    className={inputClass}
                    placeholder="e.g. 35000"
                  />
                  {incomeBracketLabel(incomeNum) && (
                    <span className="inline-block mt-2 text-xs px-2.5 py-1 rounded-full"
                      style={{ background: '#2a2d3a', color: '#888' }}>
                      {incomeBracketLabel(incomeNum)}
                    </span>
                  )}
                </InputField>

                <InputField label="Mobile Recharge Frequency">
                  <div className="grid grid-cols-3 gap-2">
                    {RECHARGE_OPTS.map(({ value, label }) => (
                      <button
                        type="button" key={value}
                        onClick={() => setInput('rechargeFreq', value)}
                        className={`px-3 py-3 rounded-xl border text-xs font-medium transition-all ${inputs.rechargeFreq === value ? btnActiveClass : btnInactiveClass}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </InputField>

                <InputField label="Employment Type">
                  <div className="grid grid-cols-3 gap-2">
                    {EMPLOYMENT_OPTS.map(({ value, label }) => (
                      <button
                        type="button" key={value}
                        onClick={() => setInput('employmentType', value)}
                        className={`px-3 py-3 rounded-xl border text-xs font-medium transition-all ${inputs.employmentType === value ? btnActiveClass : btnInactiveClass}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </InputField>

                {/* Tech detail toggle */}
                <button
                  type="button"
                  onClick={() => setShowTech(v => !v)}
                  className="text-xs text-[#A39E98] hover:text-[#6B6560] transition-colors flex items-center gap-1"
                >
                  <span>{showTech ? '▾' : '▸'}</span> Show derived ML features
                </button>

                {showTech && (
                  <div className="p-4 rounded-xl bg-[#F5F0E8] border border-[#E8E4DC] flex flex-wrap gap-2">
                    {techFields.map(([key, shortKey]) => (
                      <span key={key} className="text-xs px-2.5 py-1 rounded-full bg-white border border-[#D5D0C8] text-[#6B6560] font-mono">
                        {shortKey}: {fmtDerived(key, derived[key])}
                      </span>
                    ))}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !isFormValid}
                  className="w-full py-4 bg-[#1A6B5A] hover:bg-[#155A4A] disabled:bg-[#D5D0C8] disabled:cursor-not-allowed rounded-xl font-semibold text-white text-sm transition-all shadow-sm hover:shadow-md"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-3">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Calculating score…
                    </span>
                  ) : 'Calculate my score →'}
                </button>

                {error && (
                  <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                    {error}
                  </div>
                )}
              </form>
            </div>

            {/* Score result */}
            <div className="sticky top-24">
              {result ? (
                <div className="bg-white border border-[#E8E4DC] rounded-2xl p-8 space-y-8 shadow-sm animate-fade-up">
                  <ScoreCard score={result.score} riskTier={result.risk_tier} />
                  {result.shap_factors?.length > 0 && (
                    <div className="border-t border-[#E8E4DC] pt-8">
                      <ShapChart factors={result.shap_factors} />
                    </div>
                  )}
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="w-full py-3 bg-[#F5F0E8] hover:bg-[#EDE8DF] rounded-xl text-sm font-medium text-[#0A0A0A] transition-colors border border-[#E8E4DC]"
                  >
                    View full dashboard →
                  </button>
                </div>
              ) : (
                <div className="bg-white border border-[#E8E4DC] rounded-2xl p-8 flex flex-col items-center justify-center text-center min-h-96 gap-4 shadow-sm">
                  <div className="w-20 h-20 rounded-full bg-[#F5F0E8] flex items-center justify-center text-4xl">📊</div>
                  <h3 className="text-xl font-semibold text-[#0A0A0A]">Your score will appear here</h3>
                  <p className="text-[#A39E98] text-sm max-w-xs leading-relaxed">
                    Fill in the form on the left and hit "Calculate" to see your AI-generated credit score with explanations.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Step B: Target date + optimization plan */}
          {result && (
            <div ref={dateRef} className="mt-16">
              <div className="text-center mb-8">
                <h2 className="font-serif text-3xl font-bold text-[#0A0A0A] mb-2">Build your improvement plan</h2>
                <p className="text-[#6B6560]">Pick a target date and we'll show you exactly what to do.</p>
              </div>

              <div className="bg-white border border-[#E8E4DC] rounded-2xl p-8 shadow-sm max-w-2xl mx-auto">
                {/* Suggested date hint */}
                {suggest?.message && suggest.suggested_months > 0 && (
                  <div className="mb-6 p-4 rounded-xl bg-[#F5F0E8] border border-[#E8E4DC] text-sm text-[#6B6560]">
                    💡 {suggest.message}
                  </div>
                )}
                {suggest?.suggested_months === 0 && (
                  <div className="mb-6 p-4 rounded-xl bg-[#1D9E7510] border border-[#1D9E7540] text-sm text-[#1D9E75]">
                    🎉 {suggest.message}
                  </div>
                )}

                {/* Quick chips */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {chipMonths.map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setTargetDate(addMonths(today, m))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${targetDate === addMonths(today, m) ? btnActiveClass : btnInactiveClass}`}
                    >
                      +{m} month{m > 1 ? 's' : ''}
                    </button>
                  ))}
                </div>

                <div className="flex gap-3">
                  <input
                    type="date"
                    min={minDate} max={maxDate}
                    value={targetDate}
                    onChange={e => setTargetDate(e.target.value)}
                    className={inputClass + ' flex-1'}
                  />
                  <button
                    onClick={getPlan}
                    disabled={!targetDate || planLoading}
                    className="px-6 py-3 bg-[#1A6B5A] hover:bg-[#155A4A] disabled:bg-[#D5D0C8] disabled:cursor-not-allowed rounded-xl font-semibold text-white text-sm transition-all whitespace-nowrap"
                  >
                    {planLoading ? 'Planning…' : 'Get plan →'}
                  </button>
                </div>

                {planError && (
                  <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                    {planError}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step C: Optimization plan results */}
          {plan && (
            <div ref={planRef} className="mt-12 space-y-8">

              {/* Feasibility header */}
              <div className="bg-white border border-[#E8E4DC] rounded-2xl p-8 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="font-serif text-2xl font-bold text-[#0A0A0A]">
                      Target: {fmtDate(plan.target_date)}
                    </h3>
                    <p className="text-[#6B6560] text-sm mt-1">
                      {plan.months_available} month{plan.months_available !== 1 ? 's' : ''} · {plan.days_available} days
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold tabular-nums" style={{ color: FEAS_COLOR(plan.feasibility_pct) }}>
                      {plan.feasibility_pct}%
                    </div>
                    <div className="text-xs mt-1" style={{ color: FEAS_COLOR(plan.feasibility_pct) }}>
                      {FEAS_LABEL(plan.feasibility_pct)}
                    </div>
                  </div>
                </div>

                {/* Score range */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {[
                    { label: 'Current', score: plan.current_score },
                    { label: 'Baseline', score: plan.baseline_score },
                    { label: 'Optimistic', score: plan.optimistic_score },
                  ].map(({ label, score }) => (
                    <div key={label} className="text-center p-4 rounded-xl bg-[#F5F0E8] border border-[#E8E4DC]">
                      <div className="text-xs text-[#A39E98] mb-1">{label}</div>
                      <div className="text-2xl font-bold tabular-nums" style={{ color: tierColor(score) }}>{score}</div>
                    </div>
                  ))}
                </div>

                {plan.realistic_date && plan.optimistic_score < 750 && (
                  <div className="p-4 rounded-xl bg-[#BA751710] border border-[#BA751740] text-sm text-[#BA7517]">
                    📅 Realistic Low Risk date: <strong>{fmtDate(plan.realistic_date)}</strong> ({plan.realistic_months} months)
                  </div>
                )}
              </div>

              {/* Trajectory chart */}
              <div className="bg-white border border-[#E8E4DC] rounded-2xl p-8 shadow-sm">
                <h3 className="font-serif text-xl font-bold text-[#0A0A0A] mb-6">Score trajectory</h3>
                <PlanChart plan={plan} />
              </div>

              {/* Recommendations */}
              {plan.recommendations?.length > 0 && (
                <div className="bg-white border border-[#E8E4DC] rounded-2xl p-8 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-serif text-xl font-bold text-[#0A0A0A]">Your action plan</h3>
                    <button
                      onClick={applyRecs}
                      disabled={applied}
                      className="px-4 py-2 bg-[#1A6B5A] hover:bg-[#155A4A] disabled:bg-[#D5D0C8] disabled:cursor-not-allowed rounded-lg text-xs font-semibold text-white transition-all"
                    >
                      {applied ? 'Applied ✓' : 'Preview score impact'}
                    </button>
                  </div>
                  <div className="space-y-4">
                    {plan.recommendations.map((r, i) => (
                      <div key={r.feature} className="flex gap-4 p-4 rounded-xl border transition-all"
                        style={{ borderColor: URGENCY_BORDER(r.urgency), background: URGENCY_BG(r.urgency) }}>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                          style={{ background: URGENCY_COLOR(r.urgency) }}>
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-[#0A0A0A]">{r.label}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-[#1D9E75]">+{r.gain} pts</span>
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                                style={{ color: URGENCY_COLOR(r.urgency), background: URGENCY_BG(r.urgency), border: `1px solid ${URGENCY_BORDER(r.urgency)}` }}>
                                {r.urgency}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-[#6B6560] mt-1">{r.description}</p>
                          <div className="flex items-center gap-2 mt-2 text-xs text-[#A39E98]">
                            <span>{r.current_display}</span>
                            <span>→</span>
                            <span className="text-[#1D9E75] font-medium">{r.target_display}</span>
                            <span>· due {r.due_display}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Month-by-month timeline */}
              {plan.timeline?.length > 1 && (
                <div className="bg-white border border-[#E8E4DC] rounded-2xl p-8 shadow-sm">
                  <h3 className="font-serif text-xl font-bold text-[#0A0A0A] mb-6">Month-by-month timeline</h3>
                  <div className="space-y-3">
                    {plan.timeline.slice(1).map(entry => (
                      <div key={entry.month_number}
                        className={`p-4 rounded-xl border ${entry.is_low_risk_crossing ? 'border-[#1D9E75] bg-[#1D9E7508]' : entry.is_target_month ? 'border-[#BA7517] bg-[#BA751708]' : 'border-[#E8E4DC]'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-[#A39E98]">Month {entry.month_number} · {entry.date_display}</span>
                            {entry.is_low_risk_crossing && <span className="text-xs px-2 py-0.5 rounded-full bg-[#1D9E7520] text-[#1D9E75] font-medium">Low Risk ✓</span>}
                            {entry.is_target_month && !entry.is_low_risk_crossing && <span className="text-xs px-2 py-0.5 rounded-full bg-[#BA751720] text-[#BA7517] font-medium">Target</span>}
                          </div>
                          <span className="text-sm font-bold tabular-nums" style={{ color: entry.tier_color }}>
                            {entry.projected_score}
                          </span>
                        </div>
                        <ul className="space-y-1">
                          {entry.actions.map((act, i) => (
                            <li key={i} className="text-xs text-[#6B6560] flex gap-2">
                              <span className="text-[#1A6B5A] shrink-0">•</span>{act}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Milestones */}
              {plan.milestones?.length > 0 && (
                <div className="bg-white border border-[#E8E4DC] rounded-2xl p-8 shadow-sm">
                  <h3 className="font-serif text-xl font-bold text-[#0A0A0A] mb-6">Milestones you'll unlock</h3>
                  <div className="space-y-3">
                    {plan.milestones.map(m => (
                      <div key={m.score} className="flex items-center gap-4 p-4 rounded-xl bg-[#F5F0E8] border border-[#E8E4DC]">
                        <div className="w-12 h-12 rounded-full bg-[#1A6B5A]/10 flex items-center justify-center text-sm font-bold text-[#1A6B5A] shrink-0">
                          {m.score}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-[#0A0A0A]">{m.label}</div>
                          <div className="text-xs text-[#A39E98] mt-0.5">Month {m.month} · {m.display}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      </div>
    </div>
  )
}
