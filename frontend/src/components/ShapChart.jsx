import { useEffect, useState } from 'react'

const FEATURE_LABELS = {
  // 11 trajectory-model features
  avg_txn_freq:       'Transaction Frequency',
  txn_freq_trend:     'Transaction Trend',
  consistency_score:  'Payment Consistency',
  recency_score:      'Account Activity',
  category_diversity: 'Spending Diversity',
  avg_amount:         'Avg Transaction Amount',
  amount_volatility:  'Amount Volatility',
  fail_ratio:         'Failed Payment Rate',
  utility_streak:     'Utility Payment Streak',
  total_volume:       'Total UPI Volume',
  recharge_count:     'Mobile Recharges',
  // legacy 6-feature labels (fallback)
  upi_transactions_per_month: 'UPI Transactions / Month',
  bill_payment_on_time_pct:   'Bill Payment On-Time %',
  rent_payments_regular:      'Rent Payment Regularity',
  monthly_income_estimate:    'Monthly Income',
  mobile_recharge_frequency:  'Mobile Recharge Frequency',
  employment_type:             'Employment Type',
}

export default function ShapChart({ factors }) {
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 300)
    return () => clearTimeout(t)
  }, [])

  const maxAbs = Math.max(...factors.map((f) => Math.abs(f.impact)), 1)

  return (
    <div className="w-full space-y-3">
      <h3 className="text-lg font-semibold text-white mb-4">What drove your score</h3>
      {factors.map((f, i) => {
        const pct = (Math.abs(f.impact) / maxAbs) * 100
        const isPos = f.direction === 'positive'
        const label = FEATURE_LABELS[f.feature] || f.feature

        return (
          <div
            key={f.feature}
            className="opacity-0 animate-fade-up"
            style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'forwards' }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-gray-300">{label}</span>
              <span className={`text-sm font-semibold tabular-nums ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>
                {isPos ? '+' : ''}{f.impact.toFixed(1)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${isPos ? 'bg-emerald-500' : 'bg-red-500'}`}
                style={{
                  width: animated ? `${pct}%` : '0%',
                  transitionDelay: `${i * 80}ms`,
                }}
              />
            </div>
          </div>
        )
      })}

      <p className="text-xs text-gray-600 pt-3 border-t border-gray-800">
        SHAP values show each factor's contribution to your score relative to the average prediction.
      </p>
    </div>
  )
}
