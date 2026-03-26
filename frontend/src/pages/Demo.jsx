import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ScoreCard from '../components/ScoreCard'
import ShapChart from '../components/ShapChart'

// Map 6 form fields → 11 trajectory model features
function deriveFeatures(form) {
  const txn     = Number(form.upi_transactions_per_month) || 0
  const onTime  = Number(form.bill_payment_on_time_pct)   || 0
  const income  = Number(form.monthly_income_estimate)    || 1
  const recharge = Number(form.mobile_recharge_frequency) || 0  // 0=rarely,1=monthly,2=weekly+
  const emp     = Number(form.employment_type)            || 0  // 0=unemployed,1=freelance,2=salaried
  const rent    = Number(form.rent_payments_regular)      || 0

  const rechargeCount = [1, 3, 6][recharge] ?? 1
  const avgAmount     = income / Math.max(txn, 1)

  return {
    avg_txn_freq:       txn,
    txn_freq_trend:     0.0,
    consistency_score:  onTime * 0.25,
    recency_score:      0.5 + emp * 0.25,
    category_diversity: Math.min(txn / 5, 10),
    avg_amount:         avgAmount,
    amount_volatility:  avgAmount * 0.3,
    fail_ratio:         Math.max(0.01, (1 - onTime) * 0.35),
    utility_streak:     Math.min(1.0, rent * 0.5 + rechargeCount / 8),
    total_volume:       income,
    recharge_count:     rechargeCount,
  }
}

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

const defaultForm = {
  upi_transactions_per_month: 45,
  bill_payment_on_time_pct: 0.88,
  rent_payments_regular: 1,
  monthly_income_estimate: 35000,
  mobile_recharge_frequency: 1,
  employment_type: 2,
}

function Label({ children }) {
  return (
    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#0A0A0A', marginBottom: 6 }}>
      {children}
    </label>
  )
}

function Hint({ children }) {
  return (
    <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 5, lineHeight: 1.5 }}>{children}</p>
  )
}

const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  border: '1.5px solid #E5E7EB',
  borderRadius: 10,
  fontSize: 14,
  color: '#0A0A0A',
  outline: 'none',
  fontFamily: 'Inter, sans-serif',
  boxSizing: 'border-box',
  background: '#fff',
  transition: 'border-color 0.15s',
}

function PillToggle({ options, value, onChange, cols = options.length }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8 }}>
      {options.map(({ value: v, label }) => {
        const selected = value === v
        return (
          <button
            type="button"
            key={v}
            onClick={() => onChange(v)}
            style={{
              padding: '9px 12px',
              borderRadius: 100,
              border: selected ? '1.5px solid #1A6B5A' : '1.5px solid #E5E7EB',
              background: selected ? '#1A6B5A' : '#fff',
              color: selected ? '#fff' : '#6B7280',
              fontSize: 13,
              fontWeight: selected ? 600 : 500,
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

export default function Demo() {
  const navigate = useNavigate()
  const [form, setForm] = useState(defaultForm)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }))

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          upi_transactions_per_month: Number(form.upi_transactions_per_month),
          monthly_income_estimate: Number(form.monthly_income_estimate),
          bill_payment_on_time_pct: Number(form.bill_payment_on_time_pct),
        }),
      })
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      const data = await res.json()
      const derived = deriveFeatures(form)
      setResult(data)
      localStorage.setItem('nuvest_last_result', JSON.stringify(data))
      localStorage.setItem('nuvest_last_form', JSON.stringify(form))
      localStorage.setItem('nuvest_trajectory', JSON.stringify({ score: data.score, features: derived }))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8', fontFamily: 'Inter, sans-serif' }}>

      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: '#1A3A2A',
        height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px',
      }}>
        <button
          onClick={() => navigate('/')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <div style={{ width: 28, height: 28, borderRadius: 7, background: '#1A6B5A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: '#fff', fontFamily: 'Inter, sans-serif' }}>N</div>
          <span style={{ fontFamily: 'Playfair Display, Georgia, serif', fontWeight: 600, fontSize: 18, color: '#fff' }}>Nuvest</span>
        </button>
        <div style={{ display: 'flex', gap: 28 }}>
          <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'rgba(255,255,255,0.7)', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}
            onMouseOver={e => e.currentTarget.style.color = '#fff'}
            onMouseOut={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
          >Dashboard</button>
          <button onClick={() => navigate('/portfolio')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'rgba(255,255,255,0.7)', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}
            onMouseOver={e => e.currentTarget.style.color = '#fff'}
            onMouseOut={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
          >Portfolio</button>
        </div>
      </nav>

      {/* ── Subtitle ───────────────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', padding: '36px 24px 0' }}>
        <p style={{ fontSize: 15, color: '#6B7280', maxWidth: 480, margin: '0 auto', lineHeight: 1.6 }}>
          Fill in your alternative data profile — no bank account or credit history needed.
        </p>
      </div>

      {/* ── Two-column layout ──────────────────────────────────────────── */}
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '32px 24px 64px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, alignItems: 'start' }}>

        {/* ── Left: Form ─────────────────────────────────────────────── */}
        <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', padding: 32 }}>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* UPI Transactions */}
            <div>
              <Label>UPI Transactions per Month</Label>
              <input
                type="number" min={0} max={200}
                value={form.upi_transactions_per_month}
                onChange={(e) => set('upi_transactions_per_month', e.target.value)}
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#1A6B5A'}
                onBlur={e => e.target.style.borderColor = '#E5E7EB'}
              />
              <Hint>How many digital payments do you make via UPI each month?</Hint>
            </div>

            {/* Bill Payment Slider */}
            <div>
              <Label>Bill Payment On-Time</Label>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: '#1A6B5A', fontFamily: 'Inter, sans-serif' }}>
                  {Math.round(form.bill_payment_on_time_pct * 100)}%
                </span>
              </div>
              <input
                type="range" min={0} max={1} step={0.01}
                value={form.bill_payment_on_time_pct}
                onChange={(e) => set('bill_payment_on_time_pct', parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#1A6B5A' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>0% — Never</span>
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>100% — Always</span>
              </div>
            </div>

            {/* Rent Payment */}
            <div>
              <Label>Rent Payment Regularity</Label>
              <PillToggle
                options={[{ value: 0, label: 'Irregular / No rent' }, { value: 1, label: 'Consistent & regular' }]}
                value={form.rent_payments_regular}
                onChange={(v) => set('rent_payments_regular', v)}
                cols={2}
              />
            </div>

            {/* Monthly Income */}
            <div>
              <Label>Monthly Income</Label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#6B7280', fontWeight: 500 }}>₹</span>
                <input
                  type="number" min={0} step={1000}
                  value={form.monthly_income_estimate}
                  onChange={(e) => set('monthly_income_estimate', e.target.value)}
                  style={{ ...inputStyle, paddingLeft: 30 }}
                  placeholder="e.g. 35000"
                  onFocus={e => e.target.style.borderColor = '#1A6B5A'}
                  onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                />
              </div>
              <Hint>Approximate monthly take-home income</Hint>
            </div>

            {/* Mobile Recharge */}
            <div>
              <Label>Mobile Recharge Frequency</Label>
              <PillToggle
                options={RECHARGE_OPTS}
                value={form.mobile_recharge_frequency}
                onChange={(v) => set('mobile_recharge_frequency', v)}
                cols={3}
              />
            </div>

            {/* Employment */}
            <div>
              <Label>Employment Type</Label>
              <PillToggle
                options={EMPLOYMENT_OPTS}
                value={form.employment_type}
                onChange={(v) => set('employment_type', v)}
                cols={3}
              />
            </div>

            {error && (
              <div style={{ padding: '12px 16px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: 13 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                background: loading ? '#D1D5DB' : '#1A3A2A',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'Inter, sans-serif',
                transition: 'background 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
              onMouseOver={e => { if (!loading) e.currentTarget.style.background = '#1A6B5A' }}
              onMouseOut={e => { if (!loading) e.currentTarget.style.background = '#1A3A2A' }}
            >
              {loading ? (
                <>
                  <svg style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} viewBox="0 0 24 24" fill="none">
                    <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Calculating score…
                </>
              ) : 'Calculate my score →'}
            </button>
          </form>
        </div>

        {/* ── Right: Result ──────────────────────────────────────────── */}
        <div style={{ position: 'sticky', top: 76 }}>
          {result ? (
            <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', padding: 32 }}>
              <ScoreCard score={result.score} riskTier={result.risk_tier} />
              <div style={{ borderTop: '1px solid #F3F4F6', marginTop: 28, paddingTop: 28 }}>
                <ShapChart factors={result.shap_factors} />
              </div>

              {/* Trajectory CTA */}
              <div style={{ marginTop: 24, padding: '16px', background: '#f0f7f4', borderRadius: 12, border: '1px solid #c6e4d8' }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#1a5c45', margin: '0 0 4px' }}>
                  Want to improve your score?
                </p>
                <p style={{ fontSize: 12, color: '#555', margin: '0 0 12px', lineHeight: 1.5 }}>
                  See your personalised month-by-month improvement plan, score projections, and AI recommendations.
                </p>
                <button
                  onClick={() => navigate('/trajectory')}
                  style={{
                    width: '100%', padding: '12px', background: '#1a5c45', color: '#fff',
                    border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                  onMouseOver={e => e.currentTarget.style.background = '#2d7a5e'}
                  onMouseOut={e => e.currentTarget.style.background = '#1a5c45'}
                >
                  View Score Trajectory →
                </button>
              </div>

              <button
                onClick={() => navigate('/dashboard')}
                style={{ marginTop: 12, width: '100%', padding: '11px', background: '#F9FAFB', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: 13, fontWeight: 500, color: '#0A0A0A', cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'background 0.15s' }}
                onMouseOver={e => e.currentTarget.style.background = '#F3F4F6'}
                onMouseOut={e => e.currentTarget.style.background = '#F9FAFB'}
              >
                View full dashboard →
              </button>
            </div>
          ) : (
            <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 380, gap: 20 }}>
              {/* Empty ring */}
              <svg width="200" height="170" viewBox="0 0 220 190">
                <path
                  d={(() => {
                    const R = 90, cx = 110, cy = 110
                    const toRad = (d) => (d * Math.PI) / 180
                    const arcX = (a) => cx + R * Math.cos(toRad(a))
                    const arcY = (a) => cy + R * Math.sin(toRad(a))
                    const a1 = -210, sweep = 240, a2 = a1 + sweep
                    return `M ${arcX(a1)} ${arcY(a1)} A ${R} ${R} 0 1 1 ${arcX(a2)} ${arcY(a2)}`
                  })()}
                  fill="none" stroke="#E5E7EB" strokeWidth="14" strokeLinecap="round"
                />
              </svg>
              <div style={{ textAlign: 'center', marginTop: -20 }}>
                <p style={{ fontSize: 16, fontWeight: 600, color: '#0A0A0A', marginBottom: 8 }}>Your score will appear here</p>
                <p style={{ fontSize: 13, color: '#9CA3AF', maxWidth: 240, lineHeight: 1.6, margin: '0 auto' }}>
                  Fill in the form and hit "Calculate my score" to see your AI-generated credit score.
                </p>
              </div>
            </div>
          )}
        </div>

      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
