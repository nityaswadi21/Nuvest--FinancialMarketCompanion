import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function addMonths(dateStr, n) {
  const d = new Date(dateStr || Date.now())
  d.setMonth(d.getMonth() + n)
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
  if (score >= 450) return '#E24B4A'
  return '#E24B4A'
}

const today = new Date().toISOString().slice(0, 10)
const minDate = addMonths(today, 1)
const maxDate = addMonths(today, 24)

// ---------------------------------------------------------------------------
// Feature derivation — 6 user inputs → 11 model features
// ---------------------------------------------------------------------------
function deriveFeatures({ upiCount, billPct, rentRegularity, income, rechargeFreq, employmentType }) {
  const avg_txn_freq      = upiCount
  const fail_ratio        = parseFloat((1 - billPct / 100).toFixed(2))
  const consistency_score = parseFloat((billPct / 400).toFixed(3))
  const utility_streak    = parseFloat((billPct / 100).toFixed(2))

  const recency_score  = rentRegularity === 'Consistent & regular' ? 1.0 : 0.5
  const txn_freq_trend = rentRegularity === 'Consistent & regular' ? 2 : -1

  let avg_amount, amount_volatility, total_volume
  if      (income < 10000)  { avg_amount = 180;  amount_volatility = 120; total_volume = 3500  }
  else if (income < 25000)  { avg_amount = 420;  amount_volatility = 280; total_volume = 9000  }
  else if (income < 50000)  { avg_amount = 750;  amount_volatility = 380; total_volume = 22000 }
  else if (income < 100000) { avg_amount = 1400; amount_volatility = 600; total_volume = 45000 }
  else                      { avg_amount = 2800; amount_volatility = 900; total_volume = 95000 }

  let recharge_count
  if      (rechargeFreq === 'Rarely (prepaid, infrequent)') recharge_count = 1
  else if (rechargeFreq === 'Monthly')                      recharge_count = 5
  else                                                      recharge_count = 10

  let category_diversity
  if      (employmentType === 'Unemployed')              category_diversity = 2
  else if (employmentType === 'Self-employed / Freelance') category_diversity = 5
  else                                                   category_diversity = 7

  return {
    avg_txn_freq, txn_freq_trend, consistency_score, recency_score,
    category_diversity, avg_amount, amount_volatility, fail_ratio,
    utility_streak, total_volume, recharge_count,
  }
}

function incomeBracketLabel(income) {
  if (!income || income <= 0) return null
  if (income < 10000)  return '< ₹10,000 bracket'
  if (income < 25000)  return '₹10,000 – ₹25,000 bracket'
  if (income < 50000)  return '₹25,000 – ₹50,000 bracket'
  if (income < 100000) return '₹50,000 – ₹1,00,000 bracket'
  return '> ₹1,00,000 bracket'
}

// ---------------------------------------------------------------------------
// Segmented control
// ---------------------------------------------------------------------------
function SegControl({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', background: '#0f1117', border: '0.5px solid #2a2d3a', borderRadius: 8, padding: 3, width: '100%', gap: 3 }}>
      {options.map(opt => (
        <button key={opt} type="button" onClick={() => onChange(opt)}
          style={{
            flex: 1, padding: '7px 10px', fontSize: 12, cursor: 'pointer',
            color: value === opt ? '#ffffff' : '#888',
            borderRadius: 6, textAlign: 'center',
            background: value === opt ? '#1a1d27' : 'transparent',
            border: value === opt ? '0.5px solid #378ADD' : '0.5px solid transparent',
            transition: 'all 0.2s',
          }}>
          {opt}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Score arc
// ---------------------------------------------------------------------------
function ScoreArc({ score }) {
  const R = 72, cx = 88, cy = 88
  const startAngle = -210, sweepTotal = 240
  const toRad = d => (d * Math.PI) / 180
  const ax = a => cx + R * Math.cos(toRad(a))
  const ay = a => cy + R * Math.sin(toRad(a))
  const pct = Math.max(0, Math.min(1, (score - 300) / 600))
  const fill = sweepTotal * pct
  const arc = (a0, sw) => {
    const a1 = a0 + sw
    return `M ${ax(a0)} ${ay(a0)} A ${R} ${R} 0 ${sw > 180 ? 1 : 0} 1 ${ax(a1)} ${ay(a1)}`
  }
  const col = tierColor(score)
  return (
    <svg width={176} height={156} viewBox="0 0 176 156">
      <path d={arc(startAngle, sweepTotal)} fill="none" stroke="#1a1d27" strokeWidth={12} strokeLinecap="round" />
      <path d={arc(startAngle, fill)} fill="none" stroke={col} strokeWidth={12} strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 8px ${col}80)` }} />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Plan chart (SVG)
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
  const optPts  = [{ x: toX(0), y: toY(current_score) },
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
          return (
            <circle key={i} cx={p.x} cy={p.y}
              r={isLR || isTarget ? 6 : 3.5}
              fill={isLR ? '#1D9E75' : isTarget && optimistic_scores[months_available - 1] >= 750 ? '#1D9E75' : isTarget ? '#BA7517' : '#1D9E75'}
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

  // 6 plain-language inputs
  const [inputs, setInputs] = useState({
    upiCount:       10,
    billPct:        50,
    rentRegularity: '',
    income:         '',
    rechargeFreq:   '',
    employmentType: '',
  })

  const [showTech, setShowTech] = useState(false)

  const [result, setResult]         = useState(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)

  const [targetDate, setTargetDate] = useState('')
  const [suggest, setSuggest]       = useState(null)

  const [plan, setPlan]             = useState(null)
  const [planLoading, setPlanLoading] = useState(false)
  const [planError, setPlanError]   = useState(null)

  const [applied, setApplied]       = useState(false)

  const planRef = useRef(null)
  const dateRef = useRef(null)

  const setInput = (k, v) => setInputs(prev => ({ ...prev, [k]: v }))

  // Derived features (computed live from inputs)
  const incomeNum = parseInt(inputs.income) || 0
  const derived = deriveFeatures({
    upiCount:       inputs.upiCount,
    billPct:        inputs.billPct,
    rentRegularity: inputs.rentRegularity || 'Irregular / No rent',
    income:         incomeNum,
    rechargeFreq:   inputs.rechargeFreq || 'Monthly',
    employmentType: inputs.employmentType || 'Salaried',
  })

  // Button enabled when all 6 are filled
  const isFormValid = (
    inputs.upiCount > 0 &&
    inputs.rentRegularity !== '' &&
    incomeNum > 0 &&
    inputs.rechargeFreq !== '' &&
    inputs.employmentType !== ''
  )

  // ---- auto-suggest date when score arrives --------------------------------
  useEffect(() => {
    if (!result?.score) return
    fetch(`/optimize/suggest?current_score=${result.score}`)
      .then(r => r.json())
      .then(d => {
        setSuggest(d)
        if (d.suggested_date && d.suggested_months > 0) setTargetDate(d.suggested_date)
      })
      .catch(() => {})
  }, [result?.score])

  // ---- scroll to plan when it loads ----------------------------------------
  useEffect(() => {
    if (plan) setTimeout(() => planRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }, [plan])

  // ---- POST /score ---------------------------------------------------------
  const submit = async e => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)
    setPlan(null)
    setApplied(false)
    try {
      const features = deriveFeatures({
        upiCount:       inputs.upiCount,
        billPct:        inputs.billPct,
        rentRegularity: inputs.rentRegularity,
        income:         incomeNum,
        rechargeFreq:   inputs.rechargeFreq,
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

  // ---- POST /optimize ------------------------------------------------------
  const getPlan = async () => {
    if (!targetDate) return
    setPlanLoading(true)
    setPlanError(null)
    try {
      const features = deriveFeatures({
        upiCount:       inputs.upiCount,
        billPct:        inputs.billPct,
        rentRegularity: inputs.rentRegularity,
        income:         incomeNum,
        rechargeFreq:   inputs.rechargeFreq,
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

  // ---- Apply recommendations -----------------------------------------------
  const applyRecs = async () => {
    if (!plan?.recommendations) return
    const base = deriveFeatures({
      upiCount:       inputs.upiCount,
      billPct:        inputs.billPct,
      rentRegularity: inputs.rentRegularity,
      income:         incomeNum,
      rechargeFreq:   inputs.rechargeFreq,
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
    } catch {}
  }

  // ---- Quick chip date -------------------------------------------------------
  const chipMonths = [1, 3, 6, 9, 12]

  const FEAS_COLOR = pct => pct >= 75 ? '#1D9E75' : pct >= 50 ? '#BA7517' : '#E24B4A'
  const FEAS_LABEL = pct => pct >= 75 ? 'On track' : pct >= 50 ? 'Stretch goal — start immediately' : 'Not feasible — see suggested date below'

  const URGENCY_COLOR  = u => u === 'now' ? '#E24B4A' : u === 'soon' ? '#BA7517' : '#1D9E75'
  const URGENCY_BG     = u => u === 'now' ? '#E24B4A18' : u === 'soon' ? '#BA751718' : '#1D9E7518'
  const URGENCY_BORDER = u => u === 'now' ? '#E24B4A40' : u === 'soon' ? '#BA751740' : '#1D9E7540'

  // ---- Tech detail chip formatter -------------------------------------------
  const fmtDerived = (key, val) => {
    const currencyKeys = ['avg_amount', 'amount_volatility', 'total_volume']
    if (currencyKeys.includes(key)) return `₹${Number(val).toLocaleString('en-IN')}`
    if (typeof val === 'number' && !Number.isInteger(val)) return val.toFixed(3)
    return String(val)
  }

  const techFields = [
    ['avg_txn_freq', 'avg_txn_freq'],      ['fail_ratio', 'fail_ratio'],
    ['consistency_score', 'consistency'],  ['utility_streak', 'utility_streak'],
    ['recency_score', 'recency_score'],    ['txn_freq_trend', 'txn_freq_trend'],
    ['category_diversity', 'category_div'],['avg_amount', 'avg_amount'],
    ['amount_volatility', 'volatility'],   ['total_volume', 'total_volume'],
    ['recharge_count', 'recharge_count'],
  ]

  // =========================================================================
  return (
    <div className="min-h-screen text-white" style={{ background: '#0f1117' }}>

      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 backdrop-blur border-b" style={{ background: '#0f111780', borderColor: '#2a2d3a' }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm" style={{ background: '#378ADD' }}>C</div>
            <span className="font-semibold text-lg">CreditAI</span>
          </button>
          <button onClick={() => navigate('/dashboard')} className="text-sm text-gray-400 hover:text-white transition-colors">
            Dashboard →
          </button>
        </div>
      </nav>

      <div className="pt-24 pb-20 px-6">
        <div className="max-w-6xl mx-auto">

          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold mb-3">Get your credit score</h1>
            <p className="text-gray-400">Answer 6 simple questions — no bank account or bureau data needed.</p>
          </div>

          {/* ── Step A: form + result ─────────────────────────────────────── */}
          <div className="grid lg:grid-cols-2 gap-8 items-start">

            {/* Form */}
            <div className="rounded-2xl p-8 border" style={{ background: '#1a1d27', borderColor: '#2a2d3a' }}>
              <h2 className="font-semibold text-lg mb-6">Your Financial Profile</h2>
              <form onSubmit={submit} className="space-y-6">

                {/* INPUT 1 — UPI Transactions */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">UPI Transactions per Month</label>
                  <p className="text-xs text-gray-600 mb-2">How many digital payments do you make via UPI?</p>
                  <input
                    type="number" min={0} max={60} step={1}
                    value={inputs.upiCount}
                    placeholder="e.g. 25"
                    onChange={e => setInput('upiCount', parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-3 rounded-xl border text-white focus:outline-none focus:border-blue-500 transition-colors"
                    style={{ background: '#0f1117', borderColor: '#2a2d3a' }}
                  />
                </div>

                {/* INPUT 2 — Bills on-time % */}
                <div>
                  <div className="flex justify-between items-baseline mb-1">
                    <label className="text-sm font-medium text-gray-300">Bill Payment On-Time (%)</label>
                    <span className="text-sm font-semibold" style={{ color: '#378ADD' }}>{inputs.billPct}%</span>
                  </div>
                  <p className="text-xs text-gray-600 mb-2">What fraction of utility bills do you pay on time?</p>
                  <input
                    type="range" min={0} max={100} step={1}
                    value={inputs.billPct}
                    onChange={e => setInput('billPct', parseInt(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                  <div className="flex justify-between text-xs text-gray-600 mt-0.5">
                    <span>0% — Never</span><span>100% — Always</span>
                  </div>
                </div>

                {/* INPUT 3 — Rent regularity */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Rent Payment Regularity</label>
                  <SegControl
                    options={['Irregular / No rent', 'Consistent & regular']}
                    value={inputs.rentRegularity}
                    onChange={v => setInput('rentRegularity', v)}
                  />
                </div>

                {/* INPUT 4 — Monthly income */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Monthly Income Estimate (₹)</label>
                  <p className="text-xs text-gray-600 mb-2">Approximate monthly take-home income</p>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                    <input
                      type="number" min={0} step={1000}
                      value={inputs.income}
                      placeholder="e.g. 35000"
                      onChange={e => setInput('income', e.target.value)}
                      className="w-full pl-8 pr-4 py-3 rounded-xl border text-white focus:outline-none focus:border-blue-500 transition-colors"
                      style={{ background: '#0f1117', borderColor: '#2a2d3a' }}
                    />
                  </div>
                  {incomeBracketLabel(incomeNum) && (
                    <span className="inline-block mt-2 text-xs px-2.5 py-1 rounded-full"
                      style={{ background: '#2a2d3a', color: '#888' }}>
                      {incomeBracketLabel(incomeNum)}
                    </span>
                  )}
                </div>

                {/* INPUT 5 — Recharge frequency */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Mobile Recharge Frequency</label>
                  <SegControl
                    options={['Rarely (prepaid, infrequent)', 'Monthly', 'Frequently (weekly+)']}
                    value={inputs.rechargeFreq}
                    onChange={v => setInput('rechargeFreq', v)}
                  />
                </div>

                {/* INPUT 6 — Employment type */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Employment Type</label>
                  <SegControl
                    options={['Unemployed', 'Self-employed / Freelance', 'Salaried']}
                    value={inputs.employmentType}
                    onChange={v => setInput('employmentType', v)}
                  />
                </div>

                {/* Collapsible tech details */}
                <div>
                  <button type="button" onClick={() => setShowTech(v => !v)}
                    className="text-xs transition-colors"
                    style={{ color: '#555', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>
                    {showTech ? 'Hide technical details ▲' : 'Show technical details ▼'}
                  </button>
                  {showTech && (
                    <div className="mt-3 grid grid-cols-2 gap-1.5">
                      {techFields.map(([key, label]) => (
                        <div key={key}
                          style={{ fontSize: 11, color: '#555', background: '#0f1117', borderRadius: 6, padding: '4px 8px' }}>
                          <span style={{ color: '#444' }}>{label}: </span>
                          <span style={{ color: '#777' }}>{fmtDerived(key, derived[key])}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button type="submit" disabled={!isFormValid || loading}
                  className="w-full py-4 rounded-xl font-semibold text-lg transition-all"
                  style={{
                    background: isFormValid && !loading ? '#1D9E75' : '#2a2d3a',
                    cursor: isFormValid && !loading ? 'pointer' : 'not-allowed',
                    opacity: isFormValid && !loading ? 1 : 0.4,
                    color: 'white',
                  }}>
                  {loading ? (
                    <span className="flex items-center justify-center gap-3">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Calculating score…
                    </span>
                  ) : 'Calculate my score →'}
                </button>

                {error && (
                  <div className="p-4 rounded-xl text-sm" style={{ background: '#E24B4A18', border: '1px solid #E24B4A40', color: '#E24B4A' }}>
                    {error}
                  </div>
                )}
              </form>
            </div>

            {/* Score result */}
            <div className="sticky top-24">
              {result ? (
                <div className="rounded-2xl p-8 border animate-fade-up space-y-6" style={{ background: '#1a1d27', borderColor: '#2a2d3a' }}>
                  <div className="flex flex-col items-center">
                    <div className="relative">
                      <ScoreArc score={result.score} />
                      <div className="absolute inset-0 flex flex-col items-center justify-center pb-3">
                        <div className="text-5xl font-bold tabular-nums" style={{ color: tierColor(result.score) }}>
                          {result.score}
                        </div>
                        <div className="text-xs text-gray-500 mt-1 tracking-widest uppercase">Credit Score</div>
                      </div>
                    </div>
                    <div className="mt-1 px-4 py-1.5 rounded-full text-sm font-semibold"
                      style={{ background: tierColor(result.score) + '20', color: tierColor(result.score), border: `1px solid ${tierColor(result.score)}40` }}>
                      {result.risk_tier}
                    </div>
                  </div>

                  {result.top_factors?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Top improvement actions</p>
                      <div className="space-y-2">
                        {result.top_factors.map((f, i) => (
                          <div key={f.feature} className="flex items-center gap-3 p-3 rounded-xl border"
                            style={{ background: '#0f1117', borderColor: '#2a2d3a' }}>
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                              style={{ background: '#378ADD20', border: '1px solid #378ADD40', color: '#378ADD' }}>
                              {i + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-200 truncate">{f.label}</p>
                              <p className="text-xs text-gray-500">{f.current_display} → {f.target_display}</p>
                            </div>
                            <span className="text-sm font-semibold shrink-0" style={{ color: '#1D9E75' }}>+{f.gain}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {applied && (
                    <div className="p-3 rounded-xl text-sm text-center font-medium"
                      style={{ background: '#1D9E7518', border: '1px solid #1D9E7540', color: '#1D9E75' }}>
                      Recommendations applied — score recalculated
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl p-8 border flex flex-col items-center justify-center text-center min-h-96 gap-4"
                  style={{ background: '#1a1d27', borderColor: '#2a2d3a' }}>
                  <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl" style={{ background: '#0f1117' }}>📊</div>
                  <h3 className="text-xl font-semibold text-gray-300">Your score will appear here</h3>
                  <p className="text-gray-600 text-sm max-w-xs">Fill in the form and hit Calculate to see your AI-generated credit score.</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Step B: target date ──────────────────────────────────────── */}
          {result && (
            <div ref={dateRef} className="mt-10 rounded-2xl p-8 border" style={{ background: '#1a1d27', borderColor: '#2a2d3a' }}>
              {result.score >= 750 ? (
                <div className="text-center py-4">
                  <div className="text-4xl mb-3">🎉</div>
                  <h2 className="text-2xl font-bold mb-2" style={{ color: '#1D9E75' }}>You are already in Low Risk tier!</h2>
                  <p className="text-gray-400">Your score of {result.score} qualifies you for premium loans up to ₹2,50,000 at the best interest rates.</p>
                </div>
              ) : (
                <>
                  <h2 className="text-xl font-bold mb-1">Want to reach Low Risk (750+)?</h2>
                  <p className="text-gray-400 mb-6 text-sm">Set your target date and we'll reverse-engineer a personalised plan.</p>

                  {suggest && (
                    <div className="mb-4 text-sm" style={{ color: '#aaa' }}>
                      💡 {suggest.message}
                    </div>
                  )}

                  <div className="flex gap-2 flex-wrap mb-4">
                    {chipMonths.map(n => {
                      const d = addMonths(today, n)
                      return (
                        <button key={n} onClick={() => setTargetDate(d)}
                          className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
                          style={targetDate === d
                            ? { background: '#378ADD20', borderColor: '#378ADD', color: '#378ADD' }
                            : { background: 'transparent', borderColor: '#2a2d3a', color: '#aaa' }}>
                          {n} month{n > 1 ? 's' : ''}
                        </button>
                      )
                    })}
                  </div>

                  <div className="flex gap-4 items-end flex-wrap">
                    <div className="flex-1 min-w-48">
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">Target date</label>
                      <input type="date" min={minDate} max={maxDate} value={targetDate}
                        onChange={e => setTargetDate(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border text-white focus:outline-none focus:border-blue-500 transition-colors"
                        style={{ background: '#0f1117', borderColor: '#2a2d3a', colorScheme: 'dark' }} />
                    </div>
                    <button onClick={getPlan} disabled={!targetDate || planLoading}
                      className="px-8 py-3 rounded-xl font-semibold transition-all"
                      style={{ background: targetDate && !planLoading ? '#378ADD' : '#2a2d3a',
                        cursor: targetDate && !planLoading ? 'pointer' : 'not-allowed', color: 'white' }}>
                      {planLoading ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          Building your plan…
                        </span>
                      ) : 'Get my plan →'}
                    </button>
                  </div>

                  {planError && (
                    <div className="mt-4 p-3 rounded-xl text-sm" style={{ background: '#E24B4A18', border: '1px solid #E24B4A40', color: '#E24B4A' }}>
                      {planError}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Step D: Full plan ────────────────────────────────────────── */}
          {plan && (
            <div ref={planRef} className="mt-10 space-y-8">

              {/* 1. DEADLINE BANNER */}
              <div className="rounded-2xl p-6 border" style={{ background: '#1a1d27', borderColor: '#2a2d3a' }}>
                <div className="flex flex-col sm:flex-row sm:items-start gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4 flex-wrap">
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Target date</p>
                        <p className="font-semibold text-lg">{fmtDate(plan.target_date)}</p>
                      </div>
                      <div className="w-px h-10 bg-gray-700 hidden sm:block" />
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Months remaining</p>
                        <p className="font-semibold text-lg">{plan.months_available} months</p>
                      </div>
                      <div className="w-px h-10 bg-gray-700 hidden sm:block" />
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Days remaining</p>
                        <p className="font-semibold text-lg">{plan.days_available} days</p>
                      </div>
                      <div className="w-px h-10 bg-gray-700 hidden sm:block" />
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Points needed/month</p>
                        <p className="font-semibold text-lg">{plan.points_needed_monthly}</p>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-sm font-medium text-gray-300">Feasibility</span>
                        <span className="text-sm font-bold" style={{ color: FEAS_COLOR(plan.feasibility_pct) }}>
                          {plan.feasibility_pct}% — {FEAS_LABEL(plan.feasibility_pct)}
                        </span>
                      </div>
                      <div className="h-3 rounded-full overflow-hidden" style={{ background: '#0f1117' }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${plan.feasibility_pct}%`, background: FEAS_COLOR(plan.feasibility_pct) }} />
                      </div>
                    </div>
                  </div>
                </div>

                {!plan.is_feasible && plan.realistic_date && (
                  <div className="mt-5 p-4 rounded-xl border flex items-center justify-between gap-4"
                    style={{ background: '#BA751710', borderColor: '#BA751730' }}>
                    <div>
                      <p className="text-sm font-medium" style={{ color: '#BA7517' }}>
                        Suggested realistic date: {fmtDate(plan.realistic_date)} ({plan.realistic_months} months)
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">Based on your improvement trajectory</p>
                    </div>
                    <button onClick={() => { setTargetDate(plan.realistic_date); getPlan() }}
                      className="px-4 py-2 rounded-lg text-sm font-medium shrink-0 transition-all hover:opacity-90"
                      style={{ background: '#BA751730', border: '1px solid #BA751750', color: '#BA7517' }}>
                      Use this date →
                    </button>
                  </div>
                )}
              </div>

              {/* 2. RECOMMENDATIONS */}
              <div>
                <h3 className="font-semibold text-lg mb-4">Personalised Recommendations</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  {plan.recommendations.map(r => (
                    <div key={r.feature} className="rounded-xl p-5 border" style={{ background: '#1a1d27', borderColor: '#2a2d3a' }}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                            style={{ background: '#378ADD20', border: '1px solid #378ADD40', color: '#378ADD' }}>
                            {r.rank}
                          </div>
                          <span className="font-semibold text-sm">{r.label}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                          style={{ background: '#1D9E7520', border: '1px solid #1D9E7540', color: '#1D9E75' }}>
                          +{r.gain} pts
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mb-3 leading-relaxed">{r.description}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
                        <span className="font-medium text-gray-300">{r.current_display}</span>
                        <span className="text-gray-600">→</span>
                        <span className="font-medium" style={{ color: '#1D9E75' }}>{r.target_display}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium border"
                          style={{ background: URGENCY_BG(r.urgency), borderColor: URGENCY_BORDER(r.urgency), color: URGENCY_COLOR(r.urgency) }}>
                          Complete by {r.due_display}
                        </span>
                        <span className="text-xs text-gray-600">~{r.effort_months}mo effort</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. TIMELINE */}
              <div>
                <h3 className="font-semibold text-lg mb-4">Month-by-Month Timeline</h3>
                <div className="rounded-2xl p-6 border" style={{ background: '#1a1d27', borderColor: '#2a2d3a' }}>
                  <div className="relative">
                    <div className="absolute left-4 top-4 bottom-4 w-px" style={{ background: '#2a2d3a' }} />
                    <div className="space-y-0">
                      {plan.timeline.slice(0, 7).map((entry) => {
                        const isLR     = entry.is_low_risk_crossing
                        const isTarget = entry.is_target_month
                        const dotColor = isLR ? '#1D9E75' : entry.month_number === 0 ? '#378ADD' : entry.tier_color
                        const dotSize  = isLR || isTarget ? 'w-5 h-5' : 'w-3 h-3'
                        return (
                          <div key={entry.month_number} className="relative flex gap-6 pb-8">
                            <div className={`${dotSize} rounded-full shrink-0 mt-1 z-10 flex items-center justify-center`}
                              style={{ background: dotColor, border: `2px solid #0f1117`,
                                boxShadow: isLR ? `0 0 12px ${dotColor}80` : undefined }}>
                              {isLR && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                            <div className="flex-1 -mt-0.5">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="text-sm font-semibold">
                                  {entry.month_number === 0 ? 'Today' : entry.date_display}
                                </span>
                                <span className="text-2xl font-bold tabular-nums" style={{ color: dotColor }}>
                                  {entry.projected_score}
                                </span>
                                <span className="text-xs px-2 py-0.5 rounded-full"
                                  style={{ background: dotColor + '20', color: dotColor, border: `1px solid ${dotColor}40` }}>
                                  {entry.tier}
                                </span>
                                {isLR && <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                                  style={{ background: '#1D9E7530', color: '#1D9E75' }}>🎯 Low Risk reached!</span>}
                                {isTarget && !isLR && <span className="text-xs px-2 py-0.5 rounded-full"
                                  style={{ background: '#378ADD20', color: '#378ADD' }}>Target date</span>}
                              </div>
                              {entry.month_number > 0 && entry.actions && (
                                <ul className="space-y-0.5">
                                  {entry.actions.map((a, i) => (
                                    <li key={i} className="text-xs text-gray-500 flex items-start gap-1.5">
                                      <span className="text-gray-600 shrink-0 mt-0.5">•</span>{a}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        )
                      })}
                      {plan.timeline.length > 7 && (
                        <div className="relative flex gap-6 pb-2">
                          <div className="w-3 h-3 rounded-full shrink-0 mt-1 z-10" style={{ background: '#2a2d3a' }} />
                          <p className="text-xs text-gray-600 -mt-0.5">+{plan.timeline.length - 7} more months to target date</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. CHART */}
              <div>
                <h3 className="font-semibold text-lg mb-4">Score Trajectory Chart</h3>
                <div className="rounded-2xl p-6 border" style={{ background: '#1a1d27', borderColor: '#2a2d3a' }}>
                  <PlanChart plan={plan} />
                </div>
              </div>

              {/* 5. MILESTONES */}
              <div>
                <h3 className="font-semibold text-lg mb-4">Milestones You'll Unlock</h3>
                {plan.milestones.length > 0 ? (
                  <div className="flex flex-wrap gap-3">
                    {plan.milestones.map((m, i) => (
                      <div key={i} className="flex items-center gap-2 px-4 py-2 rounded-full border"
                        style={{ background: '#1D9E7510', borderColor: '#1D9E7530' }}>
                        <span className="w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center"
                          style={{ background: '#1D9E7530', color: '#1D9E75' }}>{m.month}</span>
                        <span className="text-sm text-gray-200">{m.label}</span>
                        <span className="text-xs text-gray-500">· {m.display}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 p-4 rounded-xl border" style={{ borderColor: '#2a2d3a' }}>
                    Extend your target date to unlock milestones along the way.
                  </p>
                )}
              </div>

              {/* 6. METRICS ROW */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Current Score', value: plan.current_score, color: tierColor(plan.current_score) },
                  { label: 'Score at Target (baseline)', value: plan.baseline_score, color: tierColor(plan.baseline_score) },
                  { label: 'Score at Target (with plan)', value: plan.optimistic_score, color: tierColor(plan.optimistic_score) },
                  { label: 'Gap to Low Risk', value: plan.gap_to_low_risk > 0 ? `-${plan.gap_to_low_risk} pts` : 'Achieved!', color: plan.gap_to_low_risk > 0 ? '#BA7517' : '#1D9E75' },
                ].map(m => (
                  <div key={m.label} className="rounded-xl p-4 border" style={{ background: '#1a1d27', borderColor: '#2a2d3a' }}>
                    <p className="text-xs text-gray-500 mb-1">{m.label}</p>
                    <p className="text-2xl font-bold tabular-nums" style={{ color: m.color }}>{m.value}</p>
                  </div>
                ))}
              </div>

              {/* 7. APPLY BUTTON */}
              <div className="flex justify-center pb-4">
                <button onClick={applyRecs} disabled={applied}
                  className="px-8 py-4 rounded-xl font-semibold text-lg transition-all"
                  style={applied
                    ? { background: '#1D9E7520', border: '1px solid #1D9E7540', color: '#1D9E75', cursor: 'default' }
                    : { background: '#378ADD', color: 'white', cursor: 'pointer' }}>
                  {applied ? 'Recommendations applied ✓' : 'Apply all recommendations & recalculate →'}
                </button>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  )
}
