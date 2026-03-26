"""
90-day score trajectory and action plan engine.

project_trajectory(current_features, months=3) -> dict
  Loads credit_model.joblib, scores the user today, then projects
  their credit score over the next three months under two scenarios:
    - baseline:   natural feature drift, no behaviour change
    - optimistic: user follows all six improvement tips

  Also returns a ranked action plan: top-3 single-feature improvements
  by score gain.

optimize_to_target(current_features, target_date, today=None) -> dict
  Reverse-engineers a personalised plan to reach Low Risk (750+) by
  the user-specified target date.
"""
import math
import calendar
from datetime import date, timedelta
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

FEATURE_COLS = [
    "avg_txn_freq", "txn_freq_trend", "consistency_score", "recency_score",
    "category_diversity", "avg_amount", "amount_volatility", "fail_ratio",
    "utility_streak", "total_volume", "recharge_count",
]

IMPROVEMENT_TIPS = {
    "fail_ratio":         "Avoid failed UPI payments for 30 days",
    "consistency_score":  "Pay on the same dates each month",
    "utility_streak":     "Pay one utility bill this month",
    "category_diversity": "Spend across 2 more merchant categories",
    "avg_txn_freq":       "Make 5 more transactions this month",
    "recency_score":      "Keep your UPI account active this month",
}

_ACTION_DELTAS = {
    "fail_ratio":         -0.08,
    "consistency_score":  +0.06,
    "utility_streak":     +0.17,
    "category_diversity": +2,
    "avg_txn_freq":       +5,
    "recency_score":      +0.17,
}

_MODEL_PATH = Path(__file__).parent / "credit_model.joblib"

# ---------------------------------------------------------------------------
# Tier / milestone data
# ---------------------------------------------------------------------------

_TIER_THRESHOLDS = [
    (750, "Low Risk",         "#1D9E75"),
    (650, "Medium-Low Risk",  "#378ADD"),
    (550, "Medium Risk",      "#BA7517"),
    (450, "Medium-High Risk", "#E24B4A"),
    (300, "High Risk",        "#E24B4A"),
]

_MILESTONES = [
    (450, "Micro-loans unlocked (up to \u20b925,000)"),
    (550, "Medium Risk tier reached"),
    (600, "Standard loan unlocked (up to \u20b91,00,000)"),
    (650, "Interest rate drops below 24%"),
    (700, "Credit limit crosses \u20b925,000"),
    (750, "Premium loans unlocked (up to \u20b92,50,000)"),
    (800, "Interest rate drops to 16%"),
    (850, "Best rate tier \u2014 12% p.a."),
]

_FEATURE_META = {
    "fail_ratio": {
        "label": "Failed Payment Rate",
        "description": "Reduce failed UPI payments by keeping sufficient balance before initiating payments",
        "direction": "down",
        "effort_months": 1,
    },
    "consistency_score": {
        "label": "Payment Consistency",
        "description": "Pay recurring bills on the same dates each month to build a predictable pattern",
        "direction": "up",
        "effort_months": 2,
    },
    "utility_streak": {
        "label": "Utility Payment Streak",
        "description": "Pay at least one utility bill (electricity, water, internet) every single month",
        "direction": "up",
        "effort_months": 3,
    },
    "category_diversity": {
        "label": "Spending Diversity",
        "description": "Spread spending across groceries, transport, food delivery, and entertainment",
        "direction": "up",
        "effort_months": 1,
    },
    "avg_txn_freq": {
        "label": "Transaction Frequency",
        "description": "Make at least 20 UPI transactions per month across different merchants",
        "direction": "up",
        "effort_months": 1,
    },
    "recency_score": {
        "label": "Account Activity",
        "description": "Ensure your UPI account shows activity every month without any break",
        "direction": "up",
        "effort_months": 1,
    },
}

_MONTHLY_ACTION_POOLS = {
    "fail_ratio": [
        "Maintain sufficient balance before initiating UPI payments",
        "Verify recipient UPI ID before each transaction",
        "Set auto-debit for recurring bills to prevent failures",
    ],
    "consistency_score": [
        "Schedule all recurring payments on the same date each month",
        "Set calendar reminders for monthly payment dates",
    ],
    "utility_streak": [
        "Pay your electricity or internet bill this month",
        "Set up auto-pay for at least one utility bill",
    ],
    "category_diversity": [
        "Try paying for groceries via UPI this month",
        "Use UPI for at least one transport or fuel payment",
    ],
    "avg_txn_freq": [
        "Make at least 5 more UPI transactions this month",
        "Use UPI for daily small purchases instead of cash",
    ],
    "recency_score": [
        "Make at least one UPI transaction every week",
        "Keep your UPI account active with regular small payments",
    ],
}

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _load_model():
    return joblib.load(_MODEL_PATH)


def _to_series(features: dict) -> pd.Series:
    return pd.Series({col: features[col] for col in FEATURE_COLS})


def _score_features(model, features: pd.Series) -> int:
    X = pd.DataFrame([features], columns=FEATURE_COLS)
    prob = float(model.predict(X)[0])
    return int(np.clip(900 - prob * 600, 300, 900))


def _apply_baseline(features: pd.Series, month: int) -> pd.Series:
    f = features.copy()
    f["recency_score"]  = min(f["recency_score"]  + 0.03 * month, 1.0)
    f["utility_streak"] = min(f["utility_streak"] + 0.02 * month, 1.0)
    f["txn_freq_trend"] = f["txn_freq_trend"] * (0.9 ** month)
    return f


def _apply_optimistic(features: pd.Series, month: int) -> pd.Series:
    f = features.copy()
    progress = month / 3

    f["fail_ratio"]         = max(f["fail_ratio"]         - 0.06 * progress, 0.01)
    f["consistency_score"]  = min(f["consistency_score"]  + 0.05 * progress, 0.25)
    f["utility_streak"]     = min(f["utility_streak"]     + 0.15 * progress, 1.0)
    f["category_diversity"] = min(f["category_diversity"] + round(1.5 * progress), 10)
    f["avg_txn_freq"]       = min(f["avg_txn_freq"]       + 3    * progress, 35)
    f["recency_score"]      = min(f["recency_score"]      + 0.05 * progress, 1.0)
    return f


_FEATURE_OPTIMA = {
    "fail_ratio":         0.01,
    "consistency_score":  0.25,
    "utility_streak":     1.0,
    "category_diversity": 10.0,
    "avg_txn_freq":       35.0,
    "recency_score":      1.0,
}

# Maximum realistic improvement per calendar month (per feature)
_MONTHLY_CAPS = {
    "fail_ratio":         0.02,   # reduce by at most 2pp/month
    "consistency_score":  0.02,   # improve by at most 0.02/month
    "utility_streak":     0.10,   # improve by at most 10pp/month
    "category_diversity": 1.0,    # add at most 1 category/month
    "avg_txn_freq":       4.0,    # add at most 4 txns/month
    "recency_score":      0.17,   # effectively 1 month = full cycle
}

_FEATURE_DOWN = {"fail_ratio"}   # lower is better


def _apply_optimistic_n(features: pd.Series, month: int, total_months: int) -> pd.Series:
    """
    Accumulate improvements at a realistic monthly rate (capped by _MONTHLY_CAPS),
    stopping at each feature's optimum.  Longer plans get proportionally more total
    improvement; no single month's jump is unrealistically large.
    """
    f = features.copy()
    for feat, cap in _MONTHLY_CAPS.items():
        optimum = _FEATURE_OPTIMA[feat]
        current = float(f[feat])
        if feat in _FEATURE_DOWN:
            f[feat] = max(optimum, current - cap * month)
        else:
            f[feat] = min(optimum, current + cap * month)
    return f


def _build_action_plan(model, features: pd.Series, current_score: int) -> list:
    plan = []
    for feature, delta in _ACTION_DELTAS.items():
        f = features.copy()
        f[feature] = max(f[feature] + delta, 0.0)
        gain = _score_features(model, f) - current_score
        if gain > 0:
            plan.append({
                "feature": feature,
                "label":   IMPROVEMENT_TIPS[feature],
                "gain":    gain,
            })
    plan.sort(key=lambda x: x["gain"], reverse=True)
    return plan[:3]


def _get_tier(score: int):
    for threshold, tier, color in _TIER_THRESHOLDS:
        if score >= threshold:
            return tier, color
    return "High Risk", "#E24B4A"


def _fmt_feature(feature: str, value: float) -> str:
    if feature in ("fail_ratio", "utility_streak", "recency_score"):
        return f"{round(value * 100, 1)}%"
    if feature == "consistency_score":
        return f"{round(value, 3)}"
    if feature == "category_diversity":
        return f"{int(round(value))} categories"
    if feature == "avg_txn_freq":
        return f"{round(value, 1)} txns/mo"
    return str(round(value, 2))


def _add_months(d: date, months: int) -> date:
    month = d.month - 1 + months
    year  = d.year + month // 12
    month = month % 12 + 1
    day   = min(d.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def project_trajectory(current_features: dict, months: int = 3) -> dict:
    model = _load_model()
    base  = _to_series(current_features)

    current_score = _score_features(model, base)

    baseline_scores  = [_score_features(model, _apply_baseline(base,  m)) for m in range(1, months + 1)]
    optimistic_scores = [_score_features(model, _apply_optimistic(base, m)) for m in range(1, months + 1)]

    action_plan = _build_action_plan(model, base, current_score)
    max_gain    = optimistic_scores[-1] - current_score

    return {
        "current_score":     current_score,
        "baseline_scores":   baseline_scores,
        "optimistic_scores": optimistic_scores,
        "months":            list(range(1, months + 1)),
        "action_plan":       action_plan,
        "max_gain":          max_gain,
    }


# ---------------------------------------------------------------------------
# Public API — optimize to target
# ---------------------------------------------------------------------------

def optimize_to_target(current_features: dict, target_date: str,
                       today: str = None) -> dict:
    """
    Reverse-engineer a personalised plan to reach Low Risk (750+)
    by target_date.
    """
    model    = _load_model()
    base     = _to_series(current_features)

    today_d  = date.fromisoformat(today) if today else date.today()
    target_d = date.fromisoformat(target_date)

    # ---- Time periods -------------------------------------------------------
    days_available   = (target_d - today_d).days
    year_diff        = target_d.year  - today_d.year
    month_diff       = target_d.month - today_d.month
    months_available = max(1, year_diff * 12 + month_diff)

    # ---- Score current features ---------------------------------------------
    current_score = _score_features(model, base)

    # ---- Trajectories -------------------------------------------------------
    baseline_scores   = [_score_features(model, _apply_baseline(base, m))
                         for m in range(1, months_available + 1)]
    optimistic_scores = [_score_features(model, _apply_optimistic_n(base, m, months_available))
                         for m in range(1, months_available + 1)]

    baseline_score  = baseline_scores[-1]
    optimistic_score = optimistic_scores[-1]

    # ---- Feasibility --------------------------------------------------------
    if current_score >= 750:
        feasibility = 1.0
    else:
        gap      = max(1, 750 - current_score)
        achieved = optimistic_score - current_score
        feasibility = min(1.0, max(0.0, achieved / gap))

    feasibility_pct = int(round(feasibility * 100))
    is_feasible     = feasibility >= 0.75
    gap_to_low_risk = max(0, 750 - current_score)
    points_needed_monthly = (
        max(0, math.ceil(gap_to_low_risk / months_available))
        if gap_to_low_risk > 0 else 0
    )

    # ---- Realistic date (rate from 3-month optimistic) ----------------------
    realistic_date   = None
    realistic_months = None
    if current_score < 750:
        opt_3m_features   = _apply_optimistic_n(base, 3, max(months_available, 3))
        opt_3m_score      = _score_features(model, opt_3m_features)
        points_per_month  = max(1, (opt_3m_score - current_score) / 3)
        realistic_months  = max(1, math.ceil((750 - current_score) / points_per_month))
        realistic_date    = _add_months(today_d, realistic_months).isoformat()

    # ---- Full recommendations -----------------------------------------------
    raw_plan = []
    for feature, delta in _ACTION_DELTAS.items():
        f = base.copy()
        new_val = float(max(0.0, f[feature] + delta))
        f[feature] = new_val
        gain = _score_features(model, f) - current_score
        if gain > 0:
            meta = _FEATURE_META.get(feature, {})
            current_val = float(base[feature])
            raw_plan.append({
                "feature":         feature,
                "label":           meta.get("label", feature),
                "description":     meta.get("description",
                                            IMPROVEMENT_TIPS.get(feature, "")),
                "gain":            gain,
                "current_value":   current_val,
                "target_value":    new_val,
                "current_display": _fmt_feature(feature, current_val),
                "target_display":  _fmt_feature(feature, new_val),
                "direction":       meta.get("direction", "up"),
                "effort_months":   meta.get("effort_months", 1),
            })

    raw_plan.sort(key=lambda x: x["gain"], reverse=True)

    recommendations = []
    for i, item in enumerate(raw_plan):
        rank = i + 1
        if rank <= 2:
            due_months = 1
            urgency    = "now"
        elif rank == 3:
            due_months = 2
            urgency    = "soon"
        else:
            due_months = min(rank, months_available)
            urgency    = "later"
        due_d = _add_months(today_d, due_months)
        recommendations.append({
            **item,
            "rank":        rank,
            "due_date":    due_d.isoformat(),
            "due_display": due_d.strftime("%d %b %Y"),
            "urgency":     urgency,
        })

    # ---- Month-by-month timeline --------------------------------------------
    n_timeline = min(months_available + 1, 13)   # 0 … min(N, 12)
    timeline   = []
    low_risk_crossed = False

    top_feats = [r["feature"] for r in recommendations[:3]] if recommendations else []

    for m in range(n_timeline):
        entry_date = _add_months(today_d, m)
        if m == 0:
            proj_score = current_score
        elif m <= months_available:
            proj_score = optimistic_scores[m - 1]
        else:
            proj_score = optimistic_scores[-1]

        tier, tier_color = _get_tier(proj_score)
        is_target = (m == months_available)

        is_low_risk_crossing = False
        if (not low_risk_crossed and proj_score >= 750 and current_score < 750):
            is_low_risk_crossing = True
            low_risk_crossed = True

        # Two actions for this month
        if top_feats and m > 0:
            pool_a = _MONTHLY_ACTION_POOLS.get(top_feats[0], ["Continue improving your financial habits"])
            pool_b = _MONTHLY_ACTION_POOLS.get(
                top_feats[(m % len(top_feats))],
                ["Track your progress regularly"],
            )
            acts = [
                pool_a[(m - 1) % len(pool_a)],
                pool_b[-1] if len(pool_b) > 1 else pool_a[0],
            ]
        else:
            acts = [
                "Review your UPI transaction pattern",
                "Check for any failed payments",
            ]

        timeline.append({
            "month_number":          m,
            "date":                  entry_date.isoformat(),
            "date_display":          entry_date.strftime("%d %b %Y"),
            "projected_score":       proj_score,
            "tier":                  tier,
            "tier_color":            tier_color,
            "is_target_month":       is_target,
            "is_low_risk_crossing":  is_low_risk_crossing,
            "actions":               acts,
        })

    # ---- Milestones ---------------------------------------------------------
    milestones = []
    crossed    = set()
    for m_idx, opt_score in enumerate(optimistic_scores):
        for threshold, label in _MILESTONES:
            if threshold not in crossed and opt_score >= threshold and current_score < threshold:
                crossed.add(threshold)
                entry_date = _add_months(today_d, m_idx + 1)
                milestones.append({
                    "month":   m_idx + 1,
                    "score":   threshold,
                    "label":   label,
                    "date":    entry_date.isoformat(),
                    "display": entry_date.strftime("%d %b %Y"),
                })

    return {
        "current_score":        current_score,
        "target_date":          target_date,
        "today":                today_d.isoformat(),
        "months_available":     months_available,
        "days_available":       days_available,
        "optimistic_score":     optimistic_score,
        "baseline_score":       baseline_score,
        "feasibility":          round(feasibility, 3),
        "feasibility_pct":      feasibility_pct,
        "is_feasible":          is_feasible,
        "realistic_date":       realistic_date,
        "realistic_months":     realistic_months,
        "gap_to_low_risk":      gap_to_low_risk,
        "points_needed_monthly": points_needed_monthly,
        "recommendations":      recommendations,
        "timeline":             timeline,
        "milestones":           milestones,
        "baseline_scores":      baseline_scores,
        "optimistic_scores":    optimistic_scores,
        "months_list":          list(range(1, months_available + 1)),
    }


# ---------------------------------------------------------------------------
# Verification
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    personas = {
        "Priya (low risk)": dict(
            avg_txn_freq=28, txn_freq_trend=3,  consistency_score=0.18,
            recency_score=1.0, category_diversity=8, avg_amount=950,
            amount_volatility=200, fail_ratio=0.02, utility_streak=1.0,
            total_volume=45000, recharge_count=6,
        ),
        "Ravi (medium risk)": dict(
            avg_txn_freq=12, txn_freq_trend=-1, consistency_score=0.09,
            recency_score=0.83, category_diversity=4, avg_amount=420,
            amount_volatility=380, fail_ratio=0.09, utility_streak=0.67,
            total_volume=18000, recharge_count=3,
        ),
        "Anand (high risk)": dict(
            avg_txn_freq=5,  txn_freq_trend=-3, consistency_score=0.04,
            recency_score=0.5,  category_diversity=2, avg_amount=180,
            amount_volatility=210, fail_ratio=0.28, utility_streak=0.17,
            total_volume=4000,  recharge_count=1,
        ),
    }

    for name, features in personas.items():
        result = project_trajectory(features)
        print(f"\n{'='*55}")
        print(f"  {name}")
        print(f"{'='*55}")
        print(f"  Current score    : {result['current_score']}")
        print(f"  Baseline  (m1-3) : {result['baseline_scores']}")
        print(f"  Optimistic(m1-3) : {result['optimistic_scores']}")
        print(f"  Max gain         : +{result['max_gain']} pts")
        print(f"  Action plan:")
        for i, action in enumerate(result["action_plan"], 1):
            print(f"    {i}. [{action['feature']}] +{action['gain']} pts — {action['label']}")

    # ---- optimize_to_target tests -------------------------------------------
    import datetime
    today_str = datetime.date.today().isoformat()

    def add_m(n):
        return _add_months(datetime.date.today(), n).isoformat()

    test_cases = [
        (
            "Test 1 — High Risk, 3-month target",
            dict(avg_txn_freq=5, fail_ratio=0.28, consistency_score=0.04,
                 recency_score=0.5, category_diversity=2, avg_amount=180,
                 amount_volatility=210, utility_streak=0.17, total_volume=4000,
                 recharge_count=1, txn_freq_trend=-3),
            add_m(3),
            {"feasibility_lt": 0.50, "min_recs": 4, "no_low_risk_crossing": True},
        ),
        (
            "Test 2 — Medium Risk, 6-month target",
            dict(avg_txn_freq=12, fail_ratio=0.09, consistency_score=0.09,
                 recency_score=0.83, category_diversity=4, avg_amount=420,
                 amount_volatility=380, utility_streak=0.67, total_volume=18000,
                 recharge_count=3, txn_freq_trend=-1),
            add_m(6),
            {"feasibility_gte": 0.60, "min_recs": 3, "low_risk_month_range": (4, 6)},
        ),
        (
            "Test 3 — Near Low Risk, 2-month target",
            dict(avg_txn_freq=20, fail_ratio=0.05, consistency_score=0.13,
                 recency_score=0.95, category_diversity=6, avg_amount=650,
                 amount_volatility=280, utility_streak=0.83, total_volume=28000,
                 recharge_count=5, txn_freq_trend=1),
            add_m(2),
            {"feasibility_gte": 0.85, "low_risk_month_range": (1, 3)},
        ),
    ]

    print("\n" + "="*60)
    print("  optimize_to_target TESTS")
    print("="*60)
    all_pass = True
    for label, features, tdate, checks in test_cases:
        r = optimize_to_target(features, tdate)
        passes = []

        if "feasibility_lt" in checks:
            ok = r["feasibility"] < checks["feasibility_lt"]
            passes.append(("feasibility<{:.0%}".format(checks["feasibility_lt"]),
                            ok, f"{r['feasibility']:.3f}"))
        if "feasibility_gte" in checks:
            ok = r["feasibility"] >= checks["feasibility_gte"]
            passes.append(("feasibility>={:.0%}".format(checks["feasibility_gte"]),
                            ok, f"{r['feasibility']:.3f}"))
        if "min_recs" in checks:
            ok = len(r["recommendations"]) >= checks["min_recs"]
            passes.append((f">={checks['min_recs']} recs",
                            ok, str(len(r["recommendations"]))))
        if "no_low_risk_crossing" in checks:
            crossing = any(e["is_low_risk_crossing"] for e in r["timeline"])
            ok = not crossing
            passes.append(("no LR crossing", ok, "crossing="+str(crossing)))
        if "low_risk_month_range" in checks:
            lo, hi = checks["low_risk_month_range"]
            crossing_months = [e["month_number"] for e in r["timeline"]
                               if e["is_low_risk_crossing"]]
            ok = bool(crossing_months) and lo <= crossing_months[0] <= hi
            passes.append((f"LR crossing m{lo}-m{hi}", ok,
                            str(crossing_months or "none")))
        if "top_rec_gain_lt" in checks:
            top_gain = r["recommendations"][0]["gain"] if r["recommendations"] else 999
            ok = top_gain < checks["top_rec_gain_lt"]
            passes.append((f"top gain<{checks['top_rec_gain_lt']}",
                            ok, str(top_gain)))

        status = "PASS" if all(p[1] for p in passes) else "FAIL"
        if status == "FAIL":
            all_pass = False
        print(f"\n  [{status}] {label}")
        print(f"    score={r['current_score']}  feasibility={r['feasibility_pct']}%"
              f"  opt={r['optimistic_score']}  recs={len(r['recommendations'])}"
              f"  milestones={len(r['milestones'])}")
        for chk_name, chk_ok, chk_val in passes:
            icon = "OK" if chk_ok else "XX"
            print(f"    {icon} {chk_name}: {chk_val}")
        if r.get("realistic_date"):
            print(f"    realistic date: {r['realistic_date']} ({r['realistic_months']} mo)")
        lr_entries = [e for e in r["timeline"] if e["is_low_risk_crossing"]]
        if lr_entries:
            e = lr_entries[0]
            print(f"    Low Risk crossed month {e['month_number']}: score {e['projected_score']}")

    print("\n" + ("ALL TESTS PASSED" if all_pass else "SOME TESTS FAILED"))
