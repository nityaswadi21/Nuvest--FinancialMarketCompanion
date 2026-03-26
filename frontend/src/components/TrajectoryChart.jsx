// SVG line chart showing baseline vs optimistic score trajectory + action plan

const W = 480
const H = 200
const PAD = { top: 16, right: 24, bottom: 32, left: 44 }
const INNER_W = W - PAD.left - PAD.right
const INNER_H = H - PAD.top - PAD.bottom

function scoreColor(score) {
  if (score >= 650) return '#10b981'
  if (score >= 450) return '#f59e0b'
  return '#ef4444'
}

function LinePath({ points, color, dashed }) {
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ')
  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={dashed ? '5 4' : undefined}
    />
  )
}

function Dot({ x, y, color }) {
  return <circle cx={x} cy={y} r={4} fill={color} stroke="#0f172a" strokeWidth={2} />
}

export default function TrajectoryChart({ data }) {
  if (!data) return null

  const { current_score, baseline_scores, optimistic_scores, months, action_plan, max_gain } = data

  // All scores for axis range
  const all = [current_score, ...baseline_scores, ...optimistic_scores]
  const minS = Math.max(300, Math.min(...all) - 30)
  const maxS = Math.min(900, Math.max(...all) + 30)

  const toX = (m) => PAD.left + ((m - 0) / months.length) * INNER_W
  const toY = (s) => PAD.top + INNER_H - ((s - minS) / (maxS - minS)) * INNER_H

  const currentPt = { x: toX(0), y: toY(current_score) }
  const baselinePts = months.map((m, i) => ({ x: toX(m), y: toY(baseline_scores[i]) }))
  const optimisticPts = months.map((m, i) => ({ x: toX(m), y: toY(optimistic_scores[i]) }))

  const yTicks = [minS, Math.round((minS + maxS) / 2), maxS]

  return (
    <div className="space-y-6">
      {/* Chart */}
      <div className="bg-gray-800/40 rounded-xl p-4 overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 280, maxHeight: 200 }}>
          {/* Grid lines */}
          {yTicks.map((v) => (
            <g key={v}>
              <line
                x1={PAD.left} y1={toY(v)}
                x2={W - PAD.right} y2={toY(v)}
                stroke="#374151" strokeWidth={1} strokeDasharray="3 3"
              />
              <text x={PAD.left - 6} y={toY(v) + 4} fill="#6b7280" fontSize={10} textAnchor="end">
                {v}
              </text>
            </g>
          ))}

          {/* X axis labels */}
          {[0, ...months].map((m) => (
            <text
              key={m}
              x={toX(m)} y={H - 4}
              fill="#6b7280" fontSize={10} textAnchor="middle"
            >
              {m === 0 ? 'Now' : `Mo ${m}`}
            </text>
          ))}

          {/* Optimistic area fill */}
          <path
            d={[
              `M ${currentPt.x} ${currentPt.y}`,
              ...optimisticPts.map((p) => `L ${p.x} ${p.y}`),
              ...baselinePts.slice().reverse().map((p) => `L ${p.x} ${p.y}`),
              `L ${currentPt.x} ${currentPt.y}`,
            ].join(' ')}
            fill="#10b98112"
          />

          {/* Lines */}
          <LinePath points={[currentPt, ...baselinePts]} color="#6b7280" dashed />
          <LinePath points={[currentPt, ...optimisticPts]} color="#10b981" />

          {/* Dots */}
          <Dot {...currentPt} color={scoreColor(current_score)} />
          {baselinePts.map((p, i) => <Dot key={i} {...p} color="#6b7280" />)}
          {optimisticPts.map((p, i) => <Dot key={i} {...p} color="#10b981" />)}
        </svg>

        {/* Legend */}
        <div className="flex items-center gap-6 mt-2 px-2">
          <div className="flex items-center gap-2">
            <svg width={24} height={4}><line x1={0} y1={2} x2={24} y2={2} stroke="#6b7280" strokeWidth={2} strokeDasharray="4 3" /></svg>
            <span className="text-xs text-gray-500">Baseline (no change)</span>
          </div>
          <div className="flex items-center gap-2">
            <svg width={24} height={4}><line x1={0} y1={2} x2={24} y2={2} stroke="#10b981" strokeWidth={2} /></svg>
            <span className="text-xs text-gray-400">Optimistic (follow tips)</span>
          </div>
        </div>
      </div>

      {/* Max gain banner */}
      {max_gain > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <span className="text-2xl font-bold text-emerald-400">+{max_gain}</span>
          <span className="text-sm text-emerald-300">points possible in 3 months if you follow the plan below</span>
        </div>
      )}

      {/* Action plan */}
      {action_plan.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Top actions</p>
          <div className="space-y-2">
            {action_plan.map((item, i) => (
              <div
                key={item.feature}
                className="flex items-center gap-4 p-4 rounded-xl bg-gray-800/50 border border-gray-700/60"
              >
                <div className="w-7 h-7 rounded-full bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-xs font-bold text-blue-400 shrink-0">
                  {i + 1}
                </div>
                <p className="text-sm text-gray-200 flex-1">{item.label}</p>
                <span className="text-sm font-semibold text-emerald-400 shrink-0">+{item.gain} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
