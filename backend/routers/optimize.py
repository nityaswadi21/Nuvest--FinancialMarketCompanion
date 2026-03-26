"""
Optimize-to-target and quick-score endpoints.

POST /score
  Accepts the 11 UPI-feature dict, returns score + tier.

POST /optimize?target_date=YYYY-MM-DD
  Accepts the 11 UPI-feature dict + a target date query param.
  Validates the date is 1–24 months in the future, then returns the
  full optimize_to_target() payload.

GET /optimize/suggest?current_score=<int>
  Returns a suggested target date based on the user's current score tier.
"""

import calendar
from datetime import date
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel

from model.trajectory import optimize_to_target, _load_model, _to_series, _score_features, _get_tier

router = APIRouter()


# ---------------------------------------------------------------------------
# Shared input model (same 11 features as /trajectory)
# ---------------------------------------------------------------------------

class FeatureInput(BaseModel):
    avg_txn_freq:       float
    txn_freq_trend:     float
    consistency_score:  float
    recency_score:      float
    category_diversity: float
    avg_amount:         float
    amount_volatility:  float
    fail_ratio:         float
    utility_streak:     float
    total_volume:       float
    recharge_count:     float


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _add_months(d: date, months: int) -> date:
    month = d.month - 1 + months
    year  = d.year + month // 12
    month = month % 12 + 1
    day   = min(d.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


# ---------------------------------------------------------------------------
# POST /score
# ---------------------------------------------------------------------------

@router.post("/score")
def score_features(body: FeatureInput):
    """Score the 11 UPI features and return risk tier + top action plan."""
    model   = _load_model()
    series  = _to_series(body.model_dump())
    score   = _score_features(model, series)
    tier, tier_color = _get_tier(score)

    # Build a short action plan (top 3)
    from model.trajectory import _ACTION_DELTAS, IMPROVEMENT_TIPS, _FEATURE_META, _fmt_feature

    tips = []
    for feature, delta in _ACTION_DELTAS.items():
        f = series.copy()
        f[feature] = max(0.0, f[feature] + delta)
        gain = _score_features(model, f) - score
        if gain > 0:
            meta = _FEATURE_META.get(feature, {})
            tips.append({
                "feature":     feature,
                "label":       meta.get("label", feature),
                "description": meta.get("description", IMPROVEMENT_TIPS.get(feature, "")),
                "gain":        gain,
                "direction":   meta.get("direction", "up"),
                "current_display": _fmt_feature(feature, float(series[feature])),
                "target_display":  _fmt_feature(feature, float(max(0.0, series[feature] + delta))),
            })

    tips.sort(key=lambda x: x["gain"], reverse=True)

    # Rename gain→impact so ShapChart can consume directly
    shap_factors = [
        {**t, "impact": t["gain"]}
        for t in tips[:6]
    ]

    return {
        "score":        score,
        "risk_tier":    tier,
        "tier_color":   tier_color,
        "shap_factors": shap_factors,
    }


# ---------------------------------------------------------------------------
# POST /optimize
# ---------------------------------------------------------------------------

@router.post("/optimize")
def get_optimize(
    body: FeatureInput,
    target_date: str = Query(..., description="ISO date YYYY-MM-DD, 1–24 months ahead"),
):
    today = date.today()

    # Validate date format
    try:
        tdate = date.fromisoformat(target_date)
    except ValueError:
        raise HTTPException(status_code=400,
                            detail="target_date must be ISO format YYYY-MM-DD")

    # Validate range
    min_date = _add_months(today, 1)
    max_date = _add_months(today, 24)

    if tdate < min_date:
        raise HTTPException(
            status_code=400,
            detail=f"target_date must be at least 1 month in the future (earliest: {min_date})",
        )
    if tdate > max_date:
        raise HTTPException(
            status_code=400,
            detail=f"target_date must not be more than 24 months in the future (latest: {max_date})",
        )

    return optimize_to_target(body.model_dump(), target_date)


# ---------------------------------------------------------------------------
# GET /optimize/suggest
# ---------------------------------------------------------------------------

@router.get("/optimize/suggest")
def suggest_date(current_score: int = Query(..., description="Current credit score")):
    today = date.today()

    if current_score >= 750:
        return {
            "suggested_date":   today.isoformat(),
            "suggested_months": 0,
            "message":          "You are already in the Low Risk tier — no target needed!",
        }

    # Pick the midpoint of the suggested range for each tier
    if current_score >= 650:
        months = 2      # 1–3 months range
    elif current_score >= 550:
        months = 5      # 3–6 months range
    elif current_score >= 450:
        months = 8      # 6–9 months range
    else:
        months = 11     # 9–12 months range

    suggested = _add_months(today, months)
    return {
        "suggested_date":   suggested.isoformat(),
        "suggested_months": months,
        "message": (
            f"Based on your score of {current_score}, we suggest targeting "
            f"{suggested.strftime('%d %b %Y')} — {months} months away"
        ),
    }
