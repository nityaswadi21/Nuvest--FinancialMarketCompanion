"""
One-time script to generate synthetic training data and save credit_model.joblib.
Run from the backend/ directory:  python -m model._bootstrap

Uses XGBRegressor trained directly on probability targets (no binary labels),
so the model outputs calibrated default probabilities.

Anchors ensure the three demo personas hit their expected scores:
  Priya  -> prob ~0.20 -> score ~780
  Ravi   -> prob ~0.50 -> score  600
  Anand  -> prob ~0.80 -> score ~420
"""
import os
import numpy as np
import pandas as pd
from xgboost import XGBRegressor
import joblib

FEATURE_COLS = [
    "avg_txn_freq", "txn_freq_trend", "consistency_score", "recency_score",
    "category_diversity", "avg_amount", "amount_volatility", "fail_ratio",
    "utility_streak", "total_volume", "recharge_count",
]

# Demo persona feature vectors (same order as FEATURE_COLS)
_PRIYA = [28, 3,   0.18, 1.0,  8, 950,  200, 0.02, 1.0,  45000, 6]
_RAVI  = [12, -1,  0.09, 0.83, 4, 420,  380, 0.09, 0.67, 18000, 3]
_ANAND = [5,  -3,  0.04, 0.5,  2, 180,  210, 0.28, 0.17, 4000,  1]

# Target default probabilities -> scores 780, 600, 420
_PRIYA_PROB = 0.200
_RAVI_PROB  = 0.500
_ANAND_PROB = 0.800


def _sigmoid(x):
    return 1.0 / (1.0 + np.exp(-x))


def _risk_logit(fail_ratio, consistency_score, utility_streak,
                avg_txn_freq, recency_score, category_diversity):
    # General background formula.  Intercept calibrated to Ravi -> logit 0.
    return (
        1.6  * fail_ratio
        - 1.2 * consistency_score
        - 0.8 * utility_streak
        - 0.04 * avg_txn_freq
        - 0.6  * recency_score
        - 0.08 * (category_diversity - 1) / 9
        + 1.505
    )


def _generate_background(n=4000, seed=42):
    rng = np.random.default_rng(seed)
    fail_ratio         = rng.beta(2, 10, n).clip(0, 0.50)
    consistency_score  = rng.beta(2, 8,  n) * 0.25
    utility_streak     = rng.beta(3, 3,  n)
    avg_txn_freq       = rng.gamma(3, 6, n).clip(1, 40)
    recency_score      = rng.beta(4, 2,  n)
    category_diversity = rng.integers(1, 11, n).astype(float)
    avg_amount         = np.exp(rng.normal(6.0, 0.8, n)).clip(50, 3000)
    amount_volatility  = np.exp(rng.normal(5.0, 0.8, n)).clip(30, 800)
    txn_freq_trend     = rng.normal(0, 3, n).clip(-10, 10)
    total_volume       = avg_txn_freq * avg_amount * rng.uniform(0.7, 1.3, n)
    recharge_count     = rng.poisson(4, n).clip(0, 12).astype(float)

    logit = _risk_logit(fail_ratio, consistency_score, utility_streak,
                        avg_txn_freq, recency_score, category_diversity)
    prob  = _sigmoid(logit + rng.normal(0, 0.05, n)).clip(0.01, 0.99)

    X = pd.DataFrame({
        "avg_txn_freq":       avg_txn_freq,
        "txn_freq_trend":     txn_freq_trend,
        "consistency_score":  consistency_score,
        "recency_score":      recency_score,
        "category_diversity": category_diversity,
        "avg_amount":         avg_amount,
        "amount_volatility":  amount_volatility,
        "fail_ratio":         fail_ratio,
        "utility_streak":     utility_streak,
        "total_volume":       total_volume,
        "recharge_count":     recharge_count,
    })[FEATURE_COLS]
    return X, prob


def _perturb(base_vals, n, seed, scale=0.06):
    """Generate n samples near base_vals with small Gaussian perturbations."""
    rng = np.random.default_rng(seed)
    arr = np.array(base_vals, dtype=float)
    noise = rng.normal(0, scale, (n, len(arr)))
    samples = arr + arr * noise
    samples = samples.clip(0)
    return pd.DataFrame(samples, columns=FEATURE_COLS)


def _build_anchors(n_per_persona=80):
    """Build persona-neighbourhood samples with correct probability targets."""
    rows, probs = [], []
    for base, prob, seed in [
        (_PRIYA, _PRIYA_PROB, 1),
        (_RAVI,  _RAVI_PROB,  2),
        (_ANAND, _ANAND_PROB, 3),
    ]:
        rng = np.random.default_rng(seed)
        X_near = _perturb(base, n_per_persona, seed)
        # Use a gentle logit perturbation so probability stays near target
        logit_anchor = np.log(prob / (1 - prob))
        p = _sigmoid(logit_anchor + rng.normal(0, 0.15, n_per_persona))
        rows.append(X_near)
        probs.append(p.clip(0.01, 0.99))
    return pd.concat(rows).reset_index(drop=True), np.concatenate(probs)


def train_and_save():
    X_bg, y_bg = _generate_background()
    X_an, y_an = _build_anchors(n_per_persona=120)

    X = pd.concat([X_bg, X_an]).reset_index(drop=True)
    y = np.concatenate([y_bg, y_an])
    # Anchor neighbourhood rows get 30x weight so model fits them accurately
    weights = np.concatenate([
        np.ones(len(X_bg)),
        np.full(len(X_an), 30.0),
    ])

    model = XGBRegressor(
        objective="reg:logistic",
        n_estimators=400,
        max_depth=5,
        learning_rate=0.04,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_weight=3,
        random_state=42,
    )
    model.fit(X, y, sample_weight=weights)

    preds = model.predict(X_bg)
    rmse_bg = np.sqrt(((preds - y_bg) ** 2).mean())
    print(f"Background RMSE: {rmse_bg:.4f}")

    # Quick sanity check on the three personas
    for name, vals, tgt in [
        ("Priya", _PRIYA, _PRIYA_PROB),
        ("Ravi",  _RAVI,  _RAVI_PROB),
        ("Anand", _ANAND, _ANAND_PROB),
    ]:
        p = float(model.predict(pd.DataFrame([vals], columns=FEATURE_COLS))[0])
        score = int(max(300, min(900, round(900 - p * 600))))
        print(f"  {name:6s}: prob={p:.3f} (target {tgt:.2f})  score={score}")

    out_path = os.path.join(os.path.dirname(__file__), "credit_model.joblib")
    joblib.dump(model, out_path)
    print(f"Saved: {out_path}")
    return model


if __name__ == "__main__":
    train_and_save()
