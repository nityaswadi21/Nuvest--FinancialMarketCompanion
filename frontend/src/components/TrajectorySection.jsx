/**
 * TrajectorySection — full trajectory UI for the Credit Score page.
 * Props: score (number), features (11-feature object)
 */
import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts'

// ── Theme (matches Demo.jsx palette) ─────────────────────────────────────────
const C = {
  primary:   '#1A6B5A',
  accent:    '#2d7a5e',
  amber:     '#d4820a',
  red:       '#c0392b',
  border:    '#E8E4DC',
  bg:        '#FAFAF8',
  text:      '#0A0A0A',
  secondary: '#6B6560',
  muted:     '#A39E98',
  card:      '#ffffff',
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const todayISO = () => new Date().toISOString().slice(0, 10)

function addMonthsToISO(isoBase, n) {
  const d = new Date(isoBase + 'T00:00:00')
  d.setMonth(d.getMonth() + n)
  return d.toISOString().slice(0, 10)
}

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function monthLabel(baseISO, n) {
  if (n === 0) return 'Now'
  const d = new Date(baseISO + 'T00:00:00')
  d.setMonth(d.getMonth() + n)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function getTierColor(score) {
  if (score >= 750) return '#1A6B5A'
  if (score >= 650) return '#2d7a5e'
  if (score >= 550) return '#d4820a'
  if (score >= 450) return '#c0392b'
  return '#991b1b'
}

function getTier(score) {
  if (score >= 750) return 'Low Risk'
  if (score >= 650) return 'Medium-Low Risk'
  if (score >= 550) return 'Medium Risk'
  if (score >= 450) return 'Medium-High Risk'
  return 'High Risk'
}

function rankBorderColor(rank) {
  if (rank === 1) return C.primary
  if (rank === 2) return C.amber
  return C.border
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Card({ children, style = {} }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
      padding: '1.25rem', ...style,
    }}>
      {children}
    </div>
  )
}

function Spinner({ size = 16 }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      style={{ animation: 'spin 1s linear infinite' }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity={0.25} />
      <path opacity={0.75} fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8,
      padding: '8px 12px', fontSize: 12, color: C.text,
    }}>
      <p style={{ color: C.muted, marginBottom: 4, margin: '0 0 4px' }}>{label}</p>
      {payload.filter(p => p.value != null).map(p => (
        <p key={p.dataKey} style={{ color: p.stroke, margin: '2px 0', fontWeight: 500 }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function TrajectorySection({ score, features }) {
  const today = todayISO()
  const minDate = addMonthsToISO(today, 1)
  const maxDate = addMonthsToISO(today, 24)

  // Date picker state
  const [targetDate, setTargetDate] = useState('')
  const [activeChip, setActiveChip] = useState(null)
  const [suggestData, setSuggestData] = useState(null)

  // Plan (optimize) state
  const [planData, setPlanData] = useState(null)
  const [loadingPlan, setLoadingPlan] = useState(false)
  const [planError, setPlanError] = useState(null)

  // Chart / trajectory state
  const [chartMonths, setChartMonths] = useState(3)
  const [trajData, setTrajData] = useState(null)
  const [loadingTraj, setLoadingTraj] = useState(false)

  // Apply state
  const [applied, setApplied] = useState(false)
  const [activeFeatures, setActiveFeatures] = useState(features)

  // Reset when parent recalculates
  useEffect(() => {
    setActiveFeatures(features)
    setPlanData(null)
    setApplied(false)
    setTargetDate('')
    setActiveChip(null)
    setSuggestData(null)
  }, [features])

  // Load suggest-date hint
  useEffect(() => {
    if (!score || score >= 750) return
    fetch(`/optimize/suggest?current_score=${Math.round(score)}`)
      .then(r => r.json())
      .then(d => setSuggestData(d))
      .catch(() => {})
  }, [score])

  // Load trajectory chart data
  useEffect(() => {
    if (!activeFeatures) return
    setLoadingTraj(true)
    fetch(`/trajectory?months=${chartMonths}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(activeFeatures),
    })
      .then(r => r.json())
      .then(d => setTrajData(d))
      .catch(() => {})
      .finally(() => setLoadingTraj(false))
  }, [chartMonths, activeFeatures])

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleChip(n) {
    setTargetDate(addMonthsToISO(today, n))
    setActiveChip(n)
  }

  async function runOptimize(date, feats) {
    if (!date || !feats) return
    setLoadingPlan(true)
    setPlanError(null)
    try {
      const res = await fetch(`/optimize?target_date=${date}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feats),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.detail || `Server error ${res.status}`)
      }
      const data = await res.json()
      setPlanData(data)
      // Align chart slider to plan's months
      setChartMonths(Math.min(12, Math.max(3, data.months_available)))
    } catch (e) {
      setPlanError(e.message)
    } finally {
      setLoadingPlan(false)
    }
  }

  async function applyRecs() {
    if (!planData || applied || !activeFeatures) return
    // Apply all recommendation target values
    const newFeats = { ...activeFeatures }
    planData.recommendations.forEach(rec => {
      newFeats[rec.feature] = rec.target_value
    })
    setLoadingPlan(true)
    try {
      const optRes = await fetch(`/optimize?target_date=${planData.target_date}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newFeats),
      }).then(r => r.json())
      setActiveFeatures(newFeats)   // triggers trajectory reload
      setPlanData(optRes)
      setApplied(true)
    } catch { /* ignore */ }
    finally { setLoadingPlan(false) }
  }

  // ── Chart data ─────────────────────────────────────────────────────────────
  const maxChartM = Math.max(chartMonths, planData?.months_available || 0)
  const chartData = trajData
    ? Array.from({ length: maxChartM + 1 }, (_, m) => ({
        label:    monthLabel(today, m),
        month:    m,
        baseline: m === 0 ? trajData.current_score : (trajData.baseline_scores[m - 1] ?? null),
        withPlan: m === 0 ? trajData.current_score : (trajData.optimistic_scores[m - 1] ?? null),
        withRecs: planData
          ? (m === 0 ? planData.current_score : (planData.optimistic_scores[m - 1] ?? null))
          : null,
      }))
    : []

  const targetLabel = planData ? monthLabel(today, planData.months_available) : null

  // ── Feasibility display ────────────────────────────────────────────────────
  const feasPct   = planData?.feasibility_pct ?? 0
  const feasColor = feasPct >= 75 ? C.primary : feasPct >= 50 ? C.amber : C.red
  const feasText  = feasPct >= 75
    ? 'On track'
    : feasPct >= 50
    ? 'Stretch goal — start immediately'
    : 'Not feasible'

  // ── Milestones to show (plan > trajectory) ─────────────────────────────────
  const milestones = planData?.milestones?.map(m => ({
    month: m.month, text: m.label,
  })) || trajData?.month_milestones?.map(m => ({
    month: m.month, text: m.milestone,
  })) || []

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>

      {/* ══ A. Target Date Picker ═══════════════════════════════════════════ */}
      <Card>
        <p style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: '0 0 4px' }}>
          Set your target date
        </p>
        <p style={{ fontSize: 12, color: C.secondary, margin: '0 0 14px' }}>
          When do you want to reach Low Risk (750)?
        </p>

        {score >= 750 ? (
          <div style={{
            background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8,
            padding: '10px 14px', fontSize: 13, color: C.primary,
          }}>
            ✓ You are already in the Low Risk tier — maintain your current behaviour.
          </div>
        ) : (
          <>
            <input
              type="date"
              value={targetDate}
              min={minDate}
              max={maxDate}
              onChange={e => { setTargetDate(e.target.value); setActiveChip(null) }}
              style={{
                width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`,
                borderRadius: 8, fontSize: 14, color: C.text, background: '#fff',
                marginBottom: 10, boxSizing: 'border-box', outline: 'none',
              }}
            />

            {/* Quick chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {[1, 3, 6, 9, 12].map(n => (
                <button
                  key={n}
                  onClick={() => handleChip(n)}
                  style={{
                    border: `1px solid ${activeChip === n ? C.primary : C.border}`,
                    borderRadius: 20, padding: '4px 14px', fontSize: 12,
                    cursor: 'pointer', background: activeChip === n ? '#f0f7f4' : 'transparent',
                    color: activeChip === n ? C.primary : C.secondary,
                  }}
                >
                  {n === 1 ? '1 month' : `${n} months`}
                </button>
              ))}
            </div>

            {/* Suggested hint */}
            {suggestData && (
              <p style={{ fontSize: 12, color: C.muted, margin: '0 0 10px' }}>
                {suggestData.message}
              </p>
            )}

            {planError && (
              <p style={{ fontSize: 12, color: C.red, margin: '0 0 8px' }}>{planError}</p>
            )}

            <button
              onClick={() => runOptimize(targetDate, activeFeatures)}
              disabled={!targetDate || loadingPlan}
              style={{
                width: '100%', padding: '10px', border: 'none', borderRadius: 8,
                fontSize: 14, fontWeight: 500, cursor: targetDate && !loadingPlan ? 'pointer' : 'not-allowed',
                background: targetDate ? C.primary : C.border, color: '#fff',
                opacity: !targetDate || loadingPlan ? 0.6 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {loadingPlan ? <><Spinner size={14} /> Building your plan…</> : 'Get my plan'}
            </button>
          </>
        )}
      </Card>

      {/* ══ B. Deadline Banner ══════════════════════════════════════════════ */}
      {planData && (
        <Card style={{ padding: '1rem 1.25rem' }}>
          <p style={{ fontSize: 14, fontWeight: 500, color: C.text, margin: '0 0 10px' }}>
            Target: {fmtDate(planData.target_date)}
            &nbsp;·&nbsp;{planData.months_available} month{planData.months_available !== 1 ? 's' : ''}
            &nbsp;·&nbsp;{planData.days_available} days
          </p>
          <p style={{ fontSize: 12, color: C.secondary, margin: '0 0 6px' }}>
            Plan feasibility: {planData.feasibility_pct}%
          </p>
          <div style={{ width: '100%', height: 6, background: C.border, borderRadius: 3, marginBottom: 4 }}>
            <div style={{
              width: `${feasPct}%`, height: '100%', background: feasColor,
              borderRadius: 3, transition: 'width 0.6s ease',
            }} />
          </div>
          <p style={{ fontSize: 12, color: feasColor, margin: '0 0 ' + (planData.is_feasible ? '0' : '10px') }}>
            {feasText}
          </p>
          {!planData.is_feasible && planData.realistic_date && (
            <button
              onClick={() => {
                const rd = planData.realistic_date
                setTargetDate(rd)
                setActiveChip(null)
                runOptimize(rd, activeFeatures)
              }}
              style={{
                border: `1px solid ${C.primary}`, color: C.primary, background: 'transparent',
                borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer',
                marginTop: 4,
              }}
            >
              Try {fmtDate(planData.realistic_date)} instead →
            </button>
          )}
        </Card>
      )}

      {/* ══ C. Recommendation Cards ═════════════════════════════════════════ */}
      {planData?.recommendations?.slice(0, 4).map(rec => {
        const urgencyStyles = {
          now:   { bg: '#fef2f2', color: C.red,     border: '#fca5a5' },
          soon:  { bg: '#fffbeb', color: C.amber,   border: '#fcd34d' },
          later: { bg: '#f0fdf4', color: C.primary, border: '#86efac' },
        }
        const us = urgencyStyles[rec.urgency] || urgencyStyles.later
        const arrow = rec.direction === 'down' ? '↓' : '↑'

        return (
          <div key={rec.feature} style={{
            background: C.card,
            borderLeft:   `3px solid ${rankBorderColor(rec.rank)}`,
            borderTop:    `1px solid ${C.border}`,
            borderRight:  `1px solid ${C.border}`,
            borderBottom: `1px solid ${C.border}`,
            borderRadius: '0 8px 8px 0',
            padding: '12px 14px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>
                {rec.rank}. {rec.label}
              </span>
              <span style={{
                background: '#f0f7f4', color: C.primary, borderRadius: 12,
                padding: '2px 10px', fontSize: 12, fontWeight: 500, flexShrink: 0,
              }}>
                +{rec.gain} pts
              </span>
            </div>
            <p style={{ fontSize: 12, color: C.secondary, margin: '4px 0' }}>{rec.description}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
              <span style={{ fontSize: 12, color: C.muted }}>
                {arrow} {rec.current_display} → {rec.target_display}
              </span>
              <span style={{
                background: us.bg, color: us.color, border: `1px solid ${us.border}`,
                borderRadius: 6, padding: '2px 8px', fontSize: 11, flexShrink: 0,
              }}>
                Complete by {rec.due_display}
              </span>
            </div>
          </div>
        )
      })}

      {/* ══ D. Month-by-Month Timeline ══════════════════════════════════════ */}
      {planData?.timeline && (
        <Card>
          <p style={{ fontSize: 14, fontWeight: 500, color: C.text, margin: '0 0 14px' }}>
            Your month-by-month plan
          </p>
          <div>
            {planData.timeline.slice(0, 6).map((entry, i, arr) => {
              const isLast = i === arr.length - 1
              const isSpecial = entry.is_low_risk_crossing || entry.month_number === 0
              const dotSize = entry.is_low_risk_crossing ? 14 : 10
              const dotColor = isSpecial ? C.primary : C.border
              const boxShadow = entry.is_low_risk_crossing
                ? `0 0 0 4px ${C.primary}33`
                : 'none'

              return (
                <div key={i} style={{ display: 'flex', gap: 10, paddingBottom: isLast ? 0 : 18 }}>
                  {/* Spine */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 14 }}>
                    <div style={{
                      width: dotSize, height: dotSize, borderRadius: '50%',
                      background: dotColor, boxShadow, flexShrink: 0,
                      marginTop: dotSize === 10 ? 2 : 0,
                    }} />
                    {!isLast && (
                      <div style={{ width: 1, flex: 1, background: C.border, marginTop: 3, minHeight: 16 }} />
                    )}
                  </div>
                  {/* Content */}
                  <div style={{ paddingBottom: 2, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: C.text, margin: 0 }}>
                      {entry.date_display}{entry.month_number === 0 ? ' — Today' : ''}
                    </p>
                    <p style={{ fontSize: 11, color: entry.tier_color, margin: '2px 0 4px' }}>
                      {entry.projected_score} · {entry.tier}
                    </p>
                    {entry.actions.map((a, j) => (
                      <p key={j} style={{ fontSize: 12, color: C.secondary, margin: '1px 0' }}>
                        · {a}
                      </p>
                    ))}
                  </div>
                </div>
              )
            })}
            {planData.timeline.length > 6 && (
              <p style={{ fontSize: 12, color: C.muted, paddingLeft: 22, margin: '8px 0 0' }}>
                … continuing to {fmtDate(planData.target_date)}
              </p>
            )}
          </div>
        </Card>
      )}

      {/* ══ E. Trajectory Chart ═════════════════════════════════════════════ */}
      <Card>
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <p style={{ fontSize: 14, fontWeight: 500, color: C.text, margin: 0 }}>Score projection</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.secondary }}>
            <span>Projection:</span>
            <input
              type="range" min={1} max={12} step={1} value={chartMonths}
              onChange={e => setChartMonths(Number(e.target.value))}
              style={{ accentColor: C.primary, width: 80, cursor: 'pointer' }}
            />
            <span style={{ color: C.text, fontWeight: 500, minWidth: 28 }}>{chartMonths}mo</span>
          </div>
        </div>

        {/* Custom legend */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginBottom: 12 }}>
          {[
            { stroke: C.muted,   dash: '5 4', w: 1.5, label: 'Baseline' },
            { stroke: C.accent,  dash: null,  w: 2,   label: 'With plan' },
            planData && { stroke: C.primary, dash: null, w: 3, label: 'With recs' },
            { stroke: C.primary, dash: '6 4', w: 1, label: 'Low Risk 750' },
            { stroke: C.amber,   dash: '6 4', w: 1, label: 'Medium Risk 600' },
          ].filter(Boolean).map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.secondary }}>
              <svg width={20} height={8}>
                <line x1={0} y1={4} x2={20} y2={4}
                  stroke={item.stroke} strokeWidth={item.w}
                  strokeDasharray={item.dash || undefined}
                />
              </svg>
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        {/* Chart */}
        {loadingTraj ? (
          <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, gap: 8 }}>
            <Spinner /> <span style={{ fontSize: 13 }}>Loading…</span>
          </div>
        ) : trajData ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: C.muted }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                domain={[300, 900]}
                ticks={[300, 400, 500, 600, 700, 800, 900]}
                tick={{ fontSize: 10, fill: C.muted }}
                axisLine={false} tickLine={false} width={34}
              />
              <Tooltip content={<ChartTooltip />} />

              {/* Threshold lines */}
              <ReferenceLine y={750} stroke={C.primary} strokeDasharray="6 4" strokeWidth={1} />
              <ReferenceLine y={600} stroke={C.amber}   strokeDasharray="6 4" strokeWidth={1} />

              {/* Target date vertical line */}
              {targetLabel && (
                <ReferenceLine
                  x={targetLabel}
                  stroke={C.primary} strokeDasharray="4 4" strokeWidth={1} strokeOpacity={0.5}
                  label={{ value: 'Target', position: 'insideTopRight', fill: C.primary, fontSize: 10 }}
                />
              )}

              <Line type="monotone" dataKey="baseline" name="Baseline"
                stroke={C.muted} strokeDasharray="5 4" strokeWidth={1.5}
                dot={false} connectNulls />
              <Line type="monotone" dataKey="withPlan" name="With plan"
                stroke={C.accent} strokeWidth={2}
                dot={false} connectNulls />
              {planData && (
                <Line type="monotone" dataKey="withRecs" name="With recs"
                  stroke={C.primary} strokeWidth={3}
                  dot={false} connectNulls />
              )}
            </LineChart>
          </ResponsiveContainer>
        ) : null}

        {/* ── F. Milestone Pills ── */}
        <div style={{ marginTop: 14 }}>
          <p style={{
            fontSize: 11, color: C.muted, textTransform: 'uppercase',
            letterSpacing: '0.05em', margin: '0 0 8px',
          }}>
            Milestones on your plan
          </p>
          {milestones.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {milestones.map((m, i) => (
                <span key={i} style={{
                  background: '#f0f7f4', color: C.primary,
                  border: `0.5px solid ${C.primary}`,
                  borderRadius: 12, padding: '3px 10px', fontSize: 11,
                }}>
                  Month {m.month} — {m.text}
                </span>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>
              Extend your target date to see milestones
            </p>
          )}
        </div>
      </Card>

      {/* ══ G. Metrics Row ══════════════════════════════════════════════════ */}
      {planData && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          {[
            { label: 'Current score',         value: planData.current_score,    color: C.text },
            { label: 'At target (baseline)',   value: planData.baseline_score,   color: C.text },
            { label: 'At target (with plan)',  value: planData.optimistic_score, color: C.primary },
            {
              label: 'Points still needed',
              value: planData.gap_to_low_risk > 0 ? planData.gap_to_low_risk : '0 ✓',
              color: planData.gap_to_low_risk > 0 ? C.text : C.primary,
            },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: C.bg, borderRadius: 8, padding: '10px 12px' }}>
              <p style={{ fontSize: 11, color: C.muted, margin: '0 0 3px' }}>{label}</p>
              <p style={{ fontSize: 16, fontWeight: 500, color, margin: 0 }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ══ H. Apply Button ═════════════════════════════════════════════════ */}
      {planData && (
        <button
          onClick={applyRecs}
          disabled={applied || loadingPlan}
          style={{
            width: '100%', padding: 12, border: 'none', borderRadius: 8,
            fontSize: 14, fontWeight: 500, color: '#fff',
            background: applied ? C.secondary : C.primary,
            cursor: applied ? 'default' : loadingPlan ? 'wait' : 'pointer',
            opacity: loadingPlan ? 0.7 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {loadingPlan
            ? <><Spinner size={14} /> Applying…</>
            : applied
            ? 'Recommendations applied ✓'
            : 'Apply all recommendations'}
        </button>
      )}

    </div>
  )
}
