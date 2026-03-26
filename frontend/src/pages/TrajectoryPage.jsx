/**
 * TrajectoryPage — full-page credit score trajectory planner.
 * Reads { score, features } from localStorage key 'nuvest_trajectory'.
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ReferenceLine, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Cell,
} from 'recharts'

const C = {
  primary: '#1a5c45', accent: '#2d7a5e',
  amber: '#d4820a', red: '#c0392b',
  border: '#e8e4dc', bg: '#f5f3ef',
  card: '#ffffff', text: '#1a1a1a',
  secondary: '#555', muted: '#999', nav: '#1A3A2A',
}

const todayISO = () => new Date().toISOString().slice(0, 10)

function addMonthsToISO(base, n) {
  const d = new Date(base + 'T00:00:00')
  d.setMonth(d.getMonth() + n)
  return d.toISOString().slice(0, 10)
}

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function monthLabel(baseISO, n) {
  if (n === 0) return 'Now'
  const d = new Date(baseISO + 'T00:00:00')
  d.setMonth(d.getMonth() + n)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function getTier(s) {
  if (s >= 750) return { label: 'Low Risk',         color: C.primary }
  if (s >= 650) return { label: 'Medium-Low Risk',  color: C.accent }
  if (s >= 550) return { label: 'Medium Risk',      color: C.amber }
  if (s >= 450) return { label: 'Medium-High Risk', color: C.red }
  return              { label: 'High Risk',          color: '#991b1b' }
}

function loanEligibility(s) {
  if (s >= 750) return 'Up to ₹25L+'
  if (s >= 650) return 'Up to ₹5L'
  if (s >= 550) return 'Up to ₹1L'
  return 'Not eligible'
}
function interestRate(s) {
  if (s >= 750) return '10 – 13% p.a.'
  if (s >= 650) return '14 – 18% p.a.'
  if (s >= 550) return '18 – 22% p.a.'
  return '24%+ p.a.'
}
function creditLimit(s) {
  if (s >= 750) return '₹2,00,000+'
  if (s >= 650) return '₹75,000'
  if (s >= 550) return '₹25,000'
  return '₹5,000'
}

const FEAT_LABEL = {
  avg_txn_freq:       'UPI Transactions/mo',
  consistency_score:  'Bill Payment %',
  fail_ratio:         'Payment Fail Rate',
  utility_streak:     'Utility Streak',
  total_volume:       'Monthly Income',
  recharge_count:     'Recharge Frequency',
  category_diversity: 'Txn Diversity',
  recency_score:      'Account Activity',
  avg_amount:         'Avg Txn Amount',
  amount_volatility:  'Amount Volatility',
  txn_freq_trend:     'Txn Trend',
}

function Card({ children, style = {} }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '1.25rem', ...style }}>
      {children}
    </div>
  )
}

function SectionTitle({ children, style = {} }) {
  return (
    <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: '0 0 12px', letterSpacing: '-0.01em', ...style }}>
      {children}
    </p>
  )
}

function Spinner({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      style={{ animation: 'trajSpin 1s linear infinite', flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity={0.25} />
      <path opacity={0.75} fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', fontSize: 12, color: C.text, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      <p style={{ color: C.muted, margin: '0 0 6px', fontWeight: 500 }}>{label}</p>
      {payload.filter(p => p.value != null).map(p => (
        <p key={p.dataKey} style={{ color: p.stroke, margin: '3px 0', fontWeight: 500 }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  )
}

export default function TrajectoryPage() {
  const navigate = useNavigate()
  const today = todayISO()
  const minDate = addMonthsToISO(today, 1)
  const maxDate = addMonthsToISO(today, 24)

  const [score, setScore]       = useState(null)
  const [features, setFeatures] = useState(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('nuvest_trajectory')
      if (stored) {
        const { score: s, features: f } = JSON.parse(stored)
        setScore(s); setFeatures(f)
      }
    } catch { /* ignore */ }
  }, [])

  const [targetDate, setTargetDate]     = useState('')
  const [activeChip, setActiveChip]     = useState(null)
  const [suggestData, setSuggestData]   = useState(null)
  const [planData, setPlanData]         = useState(null)
  const [loadingPlan, setLoadingPlan]   = useState(false)
  const [planError, setPlanError]       = useState(null)
  const [trajData, setTrajData]         = useState(null)
  const [loadingTraj, setLoadingTraj]   = useState(false)
  const [applied, setApplied]           = useState(false)
  const [activeFeatures, setActiveFeatures] = useState(null)
  const [impactWindow, setImpactWindow] = useState('current')
  const [displayScore, setDisplayScore] = useState(null)

  useEffect(() => { if (features) setActiveFeatures(features) }, [features])
  useEffect(() => { if (score != null) setDisplayScore(score) }, [score])

  useEffect(() => {
    if (!score || score >= 750) return
    fetch(`/optimize/suggest?current_score=${Math.round(score)}`)
      .then(r => r.json()).then(d => setSuggestData(d)).catch(() => {})
  }, [score])

  // chart months driven by plan only (no slider)
  const chartMonths = planData?.months_available || 6

  useEffect(() => {
    if (!activeFeatures) return
    setLoadingTraj(true)
    fetch(`/trajectory?months=${chartMonths}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(activeFeatures),
    })
      .then(r => r.json()).then(d => setTrajData(d)).catch(() => {})
      .finally(() => setLoadingTraj(false))
  }, [chartMonths, activeFeatures])

  function handleChip(n) { setTargetDate(addMonthsToISO(today, n)); setActiveChip(n) }

  async function runOptimize(date, feats) {
    if (!date || !feats) return
    setLoadingPlan(true); setPlanError(null)
    try {
      const res = await fetch(`/optimize?target_date=${date}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feats),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || `Error ${res.status}`) }
      setPlanData(await res.json())
    } catch (e) { setPlanError(e.message) }
    finally { setLoadingPlan(false) }
  }

  async function applyRecs() {
    if (!planData || applied || !activeFeatures) return
    const newFeats = { ...activeFeatures }
    planData.recommendations.forEach(rec => { newFeats[rec.feature] = rec.target_value })
    setLoadingPlan(true)
    try {
      const [scoreRes, optRes] = await Promise.all([
        fetch('/score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newFeats) }).then(r => r.json()),
        fetch(`/optimize?target_date=${planData.target_date}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newFeats) }).then(r => r.json()),
      ])
      setActiveFeatures(newFeats)
      setPlanData(optRes)
      setDisplayScore(scoreRes.score)
      setApplied(true)
    } catch { /* ignore */ }
    finally { setLoadingPlan(false) }
  }

  // Chart data
  const chartData = trajData
    ? Array.from({ length: chartMonths + 1 }, (_, m) => ({
        label:       monthLabel(today, m),
        month:       m,
        Baseline:    m === 0 ? trajData.current_score : (trajData.baseline_scores[m - 1] ?? null),
        'With Plan': m === 0 ? trajData.current_score : (trajData.optimistic_scores[m - 1] ?? null),
        'With Recs': planData
          ? (m === 0 ? planData.current_score : (planData.optimistic_scores[m - 1] ?? null))
          : null,
      }))
    : []

  const targetLabel = planData ? monthLabel(today, planData.months_available) : null

  const feasPct   = planData?.feasibility_pct ?? 0
  const feasColor = feasPct >= 75 ? C.primary : feasPct >= 50 ? C.amber : C.red
  const feasBg    = feasPct >= 75 ? '#f0fdf4'  : feasPct >= 50 ? '#fffbeb' : '#fef2f2'
  const feasMsg   = feasPct >= 75
    ? `On track — you can reach 750 by ${fmtDate(planData?.target_date)}.`
    : feasPct >= 50
    ? `Stretch goal — start all actions immediately to have a chance by ${fmtDate(planData?.target_date)}.`
    : `Not feasible in this timeframe. Try ${planData?.realistic_months ? planData.realistic_months + ' months' : 'a longer period'} instead.`

  const milestones  = planData?.milestones || []
  const tier        = displayScore ? getTier(displayScore) : null
  const targetScore = planData?.optimistic_score ?? null

  const impactBars = planData?.recommendations
    ? [...planData.recommendations]
        .sort((a, b) => b.gain - a.gain)
        .slice(0, 6)
        .map(r => ({
          name:  FEAT_LABEL[r.feature] || r.feature,
          gain:  Math.round(r.gain),
          color: r.gain > 10 ? C.primary : r.gain > 5 ? C.accent : C.amber,
        }))
    : []

  if (!score || !features) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <p style={{ fontSize: 16, color: C.secondary }}>No score data found.</p>
        <button onClick={() => navigate('/demo')}
          style={{ padding: '10px 24px', background: C.primary, color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
          ← Calculate your score first
        </button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'Inter, sans-serif' }}>
      <style>{`@keyframes trajSpin { to { transform: rotate(360deg) } }`}</style>

      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: C.nav, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px' }}>
        <button onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer' }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: '#fff' }}>N</div>
          <span style={{ fontFamily: 'Playfair Display, Georgia, serif', fontWeight: 600, fontSize: 18, color: '#fff' }}>Nuvest</span>
        </button>
        <div style={{ display: 'flex', gap: 24 }}>
          {[['Credit Score', '/demo'], ['Dashboard', '/dashboard'], ['Portfolio', '/portfolio']].map(([l, p]) => (
            <button key={p} onClick={() => navigate(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'rgba(255,255,255,0.7)', fontFamily: 'Inter, sans-serif' }}>{l}</button>
          ))}
        </div>
      </nav>

      {/* Hero */}
      <div style={{ background: C.nav, borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '28px 40px 32px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <button onClick={() => navigate('/demo')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', fontSize: 13, fontFamily: 'Inter, sans-serif', marginBottom: 16, padding: 0 }}>
            ← Back to Credit Score
          </button>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 40, flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Your Credit Score</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 56, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{Math.round(displayScore)}</span>
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>/ 850</span>
              </div>
              {tier && (
                <div style={{ display: 'inline-block', marginTop: 8, padding: '4px 12px', background: `${tier.color}33`, border: `1px solid ${tier.color}88`, borderRadius: 20, fontSize: 13, fontWeight: 600, color: '#fff' }}>
                  {tier.label}
                </div>
              )}
            </div>
            {[
              { label: 'Gap to Low Risk', value: displayScore >= 750 ? '0 — Already there!' : `${750 - Math.round(displayScore)} pts needed` },
              { label: 'Score Range',     value: '300 – 850' },
              { label: applied ? 'Status' : 'Trajectory Mode', value: applied ? '✓ Recs Applied' : 'AI-Powered Plan' },
            ].map(({ label, value }) => (
              <div key={label} style={{ borderLeft: '1px solid rgba(255,255,255,0.15)', paddingLeft: 32 }}>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
                <p style={{ fontSize: 16, fontWeight: 600, color: '#fff', margin: 0 }}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main 2-col */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px 64px', display: 'grid', gridTemplateColumns: '360px 1fr', gap: 24, alignItems: 'start' }}>

        {/* ── LEFT ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Date Picker */}
          <Card>
            <SectionTitle>Set your target date</SectionTitle>
            <p style={{ fontSize: 12, color: C.muted, margin: '-4px 0 14px' }}>When do you want to reach Low Risk (750)?</p>
            {displayScore >= 750 ? (
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: C.primary }}>
                ✓ Already in the Low Risk tier — keep your habits.
              </div>
            ) : (
              <>
                <input type="date" value={targetDate} min={minDate} max={maxDate}
                  onChange={e => { setTargetDate(e.target.value); setActiveChip(null) }}
                  style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 14, color: C.text, background: '#fff', marginBottom: 12, boxSizing: 'border-box', outline: 'none', fontFamily: 'Inter, sans-serif' }}
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {[1, 3, 6, 9, 12].map(n => (
                    <button key={n} onClick={() => handleChip(n)}
                      style={{ border: `1px solid ${activeChip === n ? C.primary : C.border}`, borderRadius: 20, padding: '5px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'Inter, sans-serif', background: activeChip === n ? '#f0f7f4' : 'transparent', color: activeChip === n ? C.primary : C.secondary }}>
                      {n === 1 ? '1 month' : `${n} months`}
                    </button>
                  ))}
                </div>
                {suggestData && (
                  <div style={{ background: C.bg, borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
                    <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>{suggestData.message}</p>
                    {suggestData.suggested_months > 0 && (
                      <button onClick={() => { setTargetDate(suggestData.suggested_date); setActiveChip(suggestData.suggested_months) }}
                        style={{ marginTop: 6, fontSize: 12, color: C.primary, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'Inter, sans-serif', textDecoration: 'underline' }}>
                        Use suggested date →
                      </button>
                    )}
                  </div>
                )}
                {planError && <p style={{ fontSize: 12, color: C.red, margin: '0 0 10px' }}>{planError}</p>}
                <button onClick={() => runOptimize(targetDate, activeFeatures)} disabled={!targetDate || loadingPlan}
                  style={{ width: '100%', padding: '12px', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, fontFamily: 'Inter, sans-serif', cursor: targetDate && !loadingPlan ? 'pointer' : 'not-allowed', background: targetDate ? C.primary : C.border, color: '#fff', opacity: !targetDate || loadingPlan ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {loadingPlan ? <><Spinner size={15} /> Building your plan…</> : 'Get my plan'}
                </button>
              </>
            )}
          </Card>

          {/* Feasibility Banner */}
          {planData && (
            <div style={{ background: feasBg, border: `1.5px solid ${feasColor}66`, borderRadius: 12, padding: '1rem 1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: feasColor }}>
                  {feasPct >= 75 ? '✓ Feasible' : feasPct >= 50 ? '⚡ Stretch Goal' : '✗ Not Feasible'}
                </span>
                <span style={{ fontSize: 24, fontWeight: 800, color: feasColor, fontFamily: 'Playfair Display, Georgia, serif' }}>{feasPct}%</span>
              </div>
              <p style={{ fontSize: 13, color: C.text, margin: '0 0 10px', lineHeight: 1.5 }}>{feasMsg}</p>
              {!planData.is_feasible && planData.realistic_date && (
                <button onClick={() => { const rd = planData.realistic_date; setTargetDate(rd); setActiveChip(null); runOptimize(rd, activeFeatures) }}
                  style={{ fontSize: 12, color: feasColor, background: 'none', border: `1px solid ${feasColor}`, borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
                  Try {fmtDate(planData.realistic_date)} ({planData.realistic_months}mo) →
                </button>
              )}
            </div>
          )}

          {/* Feature Improvement Table */}
          {planData?.recommendations?.length > 0 && (
            <Card style={{ padding: '1rem 1.25rem' }}>
              <SectionTitle>How each input must change</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {planData.recommendations.slice(0, 6).map(rec => (
                  <div key={rec.feature} style={{
                    display: 'grid', gridTemplateColumns: '1fr auto',
                    background: rec.gain > 0 ? '#f0fdf4' : C.bg,
                    border: `1px solid ${rec.gain > 0 ? '#86efac' : C.border}`,
                    borderRadius: 8, padding: '8px 10px', alignItems: 'center', gap: 8,
                  }}>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: '0 0 3px' }}>{FEAT_LABEL[rec.feature] || rec.feature}</p>
                      <p style={{ fontSize: 11, color: C.secondary, margin: 0 }}>
                        {rec.current_display} → <strong style={{ color: C.primary }}>{rec.target_display}</strong>
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {rec.gain > 0
                        ? <span style={{ fontSize: 13, fontWeight: 700, color: C.primary }}>+{Math.round(rec.gain)} pts</span>
                        : <span style={{ fontSize: 11, color: C.muted }}>Already optimal</span>
                      }
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Action Timeline */}
          {planData?.timeline?.length > 0 && (
            <Card style={{ padding: '1rem 1.25rem' }}>
              <SectionTitle>Your action plan</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {planData.timeline.slice(0, 6).map((t, i) => (
                  <div key={t.month_number} style={{ display: 'flex', gap: 12 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 28, flexShrink: 0 }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: t.is_target_month ? C.primary : C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                        {t.month_number}
                      </div>
                      {i < Math.min(planData.timeline.length - 1, 5) && (
                        <div style={{ width: 2, flex: 1, background: C.border, minHeight: 14 }} />
                      )}
                    </div>
                    <div style={{ paddingBottom: 14, flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{t.date_display}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: t.tier_color || C.primary }}>{t.projected_score}</span>
                      </div>
                      {t.actions?.length > 0 && (
                        <p style={{ fontSize: 11, color: C.secondary, margin: '3px 0 0', lineHeight: 1.4 }}>{t.actions.slice(0, 2).join(' · ')}</p>
                      )}
                    </div>
                  </div>
                ))}
                {planData.timeline.length > 6 && (
                  <p style={{ fontSize: 11, color: C.muted, margin: '0 0 0 40px' }}>…continuing to {fmtDate(planData.target_date)}</p>
                )}
              </div>
            </Card>
          )}

          {/* Apply Button */}
          {planData && !applied && (
            <button onClick={applyRecs} disabled={loadingPlan}
              style={{ width: '100%', padding: '14px', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, fontFamily: 'Inter, sans-serif', cursor: loadingPlan ? 'not-allowed' : 'pointer', background: C.primary, color: '#fff', opacity: loadingPlan ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {loadingPlan ? <><Spinner size={15} /> Applying…</> : '✓ Apply all recommendations'}
            </button>
          )}
          {applied && (
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: C.primary, fontWeight: 600, textAlign: 'center' }}>
              ✓ Recommendations applied — chart updated
            </div>
          )}
        </div>

        {/* ── RIGHT ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Score Projection Chart */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <SectionTitle style={{ margin: 0 }}>Score Projection</SectionTitle>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                {[['Baseline', C.muted, '4 4'], ['With Plan', C.accent, '0'], ['With Recs', C.primary, '0']].map(([n, c, d]) => (
                  <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <svg width="24" height="2"><line x1="0" y1="1" x2="24" y2="1" stroke={c} strokeWidth="2" strokeDasharray={d} /></svg>
                    <span style={{ fontSize: 11, color: C.secondary }}>{n}</span>
                  </div>
                ))}
              </div>
            </div>
            {loadingTraj ? (
              <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: C.muted }}>
                <Spinner size={18} /> Loading chart…
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={chartData} margin={{ top: 8, right: 20, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.muted }} />
                  <YAxis domain={[280, 860]} tick={{ fontSize: 11, fill: C.muted }} />
                  <Tooltip content={<ChartTooltip />} />
                  <ReferenceLine y={750} stroke={C.primary} strokeDasharray="4 4" strokeWidth={1.5}
                    label={{ value: 'Low Risk 750', position: 'insideTopRight', fontSize: 10, fill: C.primary }} />
                  <ReferenceLine y={650} stroke={C.amber} strokeDasharray="3 3" strokeWidth={1}
                    label={{ value: '650', position: 'insideTopRight', fontSize: 10, fill: C.amber }} />
                  {targetLabel && (
                    <ReferenceLine x={targetLabel} stroke={C.red} strokeDasharray="6 3" strokeWidth={2}
                      label={{ value: 'Target', position: 'top', fontSize: 10, fill: C.red }} />
                  )}
                  <Line type="monotone" dataKey="Baseline"    stroke={C.muted}   strokeWidth={2}   dot={false} strokeDasharray="4 4" connectNulls />
                  <Line type="monotone" dataKey="With Plan"   stroke={C.accent}  strokeWidth={2.5} dot={false} connectNulls />
                  {planData && <Line type="monotone" dataKey="With Recs" stroke={C.primary} strokeWidth={3} dot={false} connectNulls />}
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* 4-card score impact row */}
          {planData && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
              {[
                { label: 'Current Score',  value: Math.round(displayScore),                                                                          color: C.text },
                { label: 'Baseline End',   value: trajData ? Math.round(trajData.baseline_scores?.[chartMonths - 1] ?? displayScore) : '—',          color: C.secondary },
                { label: 'With Plan',      value: targetScore ? Math.round(targetScore) : '—',                                                        color: C.accent },
                { label: 'Max Gain',       value: targetScore ? `+${Math.round(targetScore - displayScore)} pts` : '—',                               color: C.primary },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
                  <p style={{ fontSize: 11, color: C.muted, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
                  <p style={{ fontSize: 22, fontWeight: 700, color, margin: 0, fontFamily: 'Playfair Display, Georgia, serif' }}>{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Variable Impact Explorer */}
          {impactBars.length > 0 && (
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <SectionTitle style={{ margin: 0 }}>Variable Impact Explorer</SectionTitle>
                <div style={{ display: 'flex', gap: 4 }}>
                  {['current', '1mo', '3mo', '6mo'].map(w => (
                    <button key={w} onClick={() => setImpactWindow(w)}
                      style={{ border: `1px solid ${impactWindow === w ? C.primary : C.border}`, borderRadius: 20, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'Inter, sans-serif', background: impactWindow === w ? C.primary : 'transparent', color: impactWindow === w ? '#fff' : C.secondary }}>
                      {w}
                    </button>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={impactBars} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 130 }}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: C.muted }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: C.text }} width={130} />
                  <Tooltip formatter={v => [`+${v} pts`, 'Score Impact']} />
                  <Bar dataKey="gain" radius={[0, 4, 4, 0]}>
                    {impactBars.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Benefit Unlock Tracker */}
          {planData && (
            <Card>
              <SectionTitle>Benefit Unlock Tracker</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                {[
                  { label: 'Loan Eligibility', icon: '🏦', fn: loanEligibility },
                  { label: 'Interest Rate',     icon: '📉', fn: interestRate },
                  { label: 'Credit Limit',      icon: '💳', fn: creditLimit },
                ].map(({ label, icon, fn }) => {
                  const cur     = fn(Math.round(displayScore))
                  const target  = fn(Math.round(targetScore || displayScore))
                  const changed = cur !== target
                  return (
                    <div key={label} style={{ background: C.bg, borderRadius: 10, padding: '14px', border: `1px solid ${changed ? C.primary + '55' : C.border}` }}>
                      <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
                      <p style={{ fontSize: 11, color: C.muted, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
                      <p style={{ fontSize: 12, color: C.secondary, margin: '0 0 4px' }}>Now: <strong style={{ color: C.text }}>{cur}</strong></p>
                      <p style={{ fontSize: 12, color: changed ? C.primary : C.muted, margin: 0, fontWeight: changed ? 700 : 400 }}>
                        {changed ? `→ ${target}` : 'No change'}
                      </p>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          {/* Milestone Timeline */}
          {milestones.length > 0 && (
            <Card>
              <SectionTitle>Milestone Timeline</SectionTitle>
              <div style={{ display: 'flex', alignItems: 'center', overflowX: 'auto', paddingBottom: 4 }}>
                {milestones.map((m, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ textAlign: 'center', minWidth: 110 }}>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px', fontSize: 13, fontWeight: 700, color: '#fff' }}>
                        {m.score}
                      </div>
                      <p style={{ fontSize: 11, fontWeight: 600, color: C.text, margin: '0 0 2px' }}>{m.label || m.milestone}</p>
                      <p style={{ fontSize: 10, color: C.muted, margin: 0 }}>{m.display || fmtDate(m.date)}</p>
                    </div>
                    {i < milestones.length - 1 && (
                      <div style={{ width: 40, height: 2, background: C.border, flexShrink: 0 }} />
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

        </div>
      </div>
    </div>
  )
}
