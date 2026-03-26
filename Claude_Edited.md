# CLAUDE.md — ThinFile Credit Scoring

## Project overview

AI-powered credit scoring engine for thin-file users (no formal credit history) using alternative UPI transaction data. Built for a 24-hour hackathon. Outputs an explainable credit score (300–900) with plain-English SHAP-driven explanations and improvement tips.

---

## Tech stack

| Layer | Tool |
|---|---|
| Language | Python 3.10+ |
| ML model | XGBoost |
| Explainability | SHAP (TreeExplainer) |
| Fairness | fairlearn |
| API | FastAPI + Uvicorn |
| UI | Streamlit + Plotly |
| Serialization | joblib |
| Data | pandas, numpy |
| Synthetic data | Faker |

---

## Project structure

```
thinfile-credit/
├── CLAUDE.md                  # This file
├── data/
│   ├── upi_transactions.csv   # Generated synthetic UPI data
│   └── user_labels.csv        # Default labels per user
├── models/
│   ├── credit_model.joblib    # Trained XGBoost model
│   └── shap_explainer.joblib  # SHAP TreeExplainer
├── notebooks/
│   └── exploration.ipynb      # EDA and feature validation
├── src/
│   ├── generate_data.py       # Phase 1: synthetic data generation
│   ├── feature_engineering.py # Phase 2: feature computation
│   ├── train.py               # Phase 3: model training + SHAP + fairness
│   ├── score.py               # Scoring + explanation utility functions
│   └── main.py                # Phase 4: FastAPI app
├── app.py                     # Phase 5: Streamlit demo UI
├── requirements.txt
└── README.md
```

---

## Setup

```bash
# Clone and enter project
git clone https://github.com/yourname/thinfile-credit
cd thinfile-credit

# Create virtual environment
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate

# Install all dependencies
pip install -r requirements.txt
```

### requirements.txt
```
pandas
numpy
scikit-learn
xgboost
shap
fastapi
uvicorn
streamlit
joblib
faker
plotly
fairlearn
requests
pydantic
```

---

## Running the project (in order)

### Step 1 — Generate synthetic data
```bash
python src/generate_data.py
# Output: data/upi_transactions.csv, data/user_labels.csv
```

### Step 2 — Engineer features
```bash
python src/feature_engineering.py
# Output: data/user_features.csv
```

### Step 3 — Train model
```bash
python src/train.py
# Output: models/credit_model.joblib, models/shap_explainer.joblib
# Prints: AUC-ROC score, fairness metrics
```

### Step 4 — Start API server
```bash
uvicorn src.main:app --reload --port 8000
# Swagger UI: http://localhost:8000/docs
```

### Step 5 — Start demo UI (in a new terminal)
```bash
streamlit run app.py
# Opens: http://localhost:8501
```

---

## API reference

### `GET /health`
Returns model status.
```json
{ "status": "ok", "model": "XGBoost-ThinFile-v1" }
```

### `POST /score`
Accepts user financial behaviour features, returns credit score + explanation.

**Request body:**
```json
{
  "avg_txn_freq": 18,
  "txn_freq_trend": 2,
  "consistency_score": 0.14,
  "recency_score": 1.0,
  "category_diversity": 7,
  "avg_amount": 750,
  "amount_volatility": 220,
  "fail_ratio": 0.03,
  "utility_streak": 0.83,
  "total_volume": 32000,
  "recharge_count": 5
}
```

**Response:**
```json
{
  "score": 724,
  "risk_tier": "Medium-Low Risk",
  "default_probability": 0.0293,
  "explanation": "Your score is boosted by strong payment consistency and utility payment streak. It is held back by spending volatility.",
  "top_factors": [
    { "feature": "fail_ratio", "label": "Failed payment rate", "shap_value": -0.42, "abs_impact": 0.42, "impact": "positive" },
    { "feature": "consistency_score", "label": "Payment consistency", "shap_value": -0.31, "abs_impact": 0.31, "impact": "positive" },
    { "feature": "amount_volatility", "label": "Spending volatility", "shap_value": 0.18, "abs_impact": 0.18, "impact": "negative" }
  ],
  "improvement_tips": [
    "Ensure sufficient balance before initiating UPI payments.",
    "Try to make payments on similar dates each month."
  ]
}
```

### `GET /demo/{persona}`
Returns pre-computed score for a demo persona. Personas: `priya`, `ravi`, `anand`.

```bash
curl http://localhost:8000/demo/priya
```

---

## Feature reference

All features are computed per user from 6 months of UPI transaction history.

| Feature | Description | Good direction |
|---|---|---|
| `avg_txn_freq` | Average monthly transaction count | High |
| `txn_freq_trend` | Last month txns minus first month txns | High (growing) |
| `consistency_score` | 1 / (std dev of payment days + 1) | High |
| `recency_score` | Most recent active month / 6 | High |
| `category_diversity` | Unique merchant categories | High |
| `avg_amount` | Mean transaction amount (successful only) | High |
| `amount_volatility` | Std dev of transaction amounts | Low |
| `fail_ratio` | Failed transactions / total transactions | Low |
| `utility_streak` | Months with utility payment / 6 | High |
| `total_volume` | Sum of all successful transaction amounts | High |
| `recharge_count` | Count of mobile recharge transactions | High |

---

## Score interpretation

| Score range | Risk tier | Recommended action |
|---|---|---|
| 750 – 900 | Low Risk | Pre-approve up to ₹50,000 |
| 650 – 749 | Medium-Low Risk | Approve with standard terms |
| 550 – 649 | Medium Risk | Approve with reduced limit |
| 450 – 549 | Medium-High Risk | Manual review recommended |
| 300 – 449 | High Risk | Decline or require collateral |

---

## Demo personas

Use these during the presentation. Load them via the `/demo/{persona}` API endpoint or the persona buttons in the Streamlit UI.

| Persona | Score (approx.) | Risk tier | Key story |
|---|---|---|---|
| Priya | ~780 | Low Risk | Regular payments, high diversity, consistent utility payments |
| Ravi | ~600 | Medium Risk | Declining activity, moderate fail rate |
| Anand | ~400 | High Risk | Very low activity, high fail rate, no utility payments |

**Demo order:** Always show Priya first (builds confidence in the model), then Anand (shows full range), then Ravi (the nuanced middle case that sparks the best questions).

---

## Fairness

Fairness is evaluated using the `fairlearn` library at training time.

- Metric: **Demographic Parity Difference** (target < 0.1)
- Metric: **Equalized Odds Difference** (target < 0.1)

Results are printed at the end of `src/train.py`. Quote these numbers if judges ask about bias.

Key talking point: alternative data is *less* biased than bureau data, which systematically excludes the informal economy by design.

---

## Common judge questions & answers

**"What stops this from being biased?"**
We run demographic parity and equalized odds checks using fairlearn. Our features are purely behavioral — no gender, geography, or demographic inputs are used. Alternative data is structurally more inclusive than bureau data.

**"What about data privacy?"**
The model uses aggregated behavioral features, never raw transaction data. A user's transactions are summarised into 11 numeric signals before any model inference. Raw data never leaves the user's device in a production implementation.

**"How do you handle users with less than 6 months of data?"**
Currently the model requires 3+ months minimum. Cold-start handling using 30-day windows is on the roadmap. For very new users we recommend a provisional score with a confidence band.

**"How does this scale?"**
The FastAPI endpoint is stateless — it loads a serialized model and runs inference in < 50ms. Horizontal scaling via any container orchestrator (Kubernetes, ECS) is straightforward. The model itself retrains monthly on new labeled data.

**"How do you get ground truth labels in production?"**
In production, labels come from loan repayment outcomes from NBFC partners. For the hackathon, labels are derived heuristically from risk profiles with added noise to prevent data leakage.

---

## Hackathon timeline

| Phase | Hours | Deliverable |
|---|---|---|
| Setup & data generation | 0 – 2 | `upi_transactions.csv`, `user_labels.csv` |
| Feature engineering | 2 – 5 | `user_features.csv` |
| Model training & explainability | 5 – 10 | `credit_model.joblib`, `shap_explainer.joblib` |
| API layer | 10 – 14 | FastAPI running at localhost:8000 |
| Demo UI | 14 – 18 | Streamlit app running at localhost:8501 |
| Polish & rehearsal | 18 – 22 | Pitch practiced, personas pre-loaded |
| Buffer & sleep | 22 – 24 | GitHub pushed, README done, rest |

---

## Pitch structure (2 minutes)

1. **Problem** (20s) — "400 million Indians use UPI daily but are invisible to CIBIL. Banks can't lend to them — not because they're risky, but because there's no data."
2. **Gap** (15s) — "Existing credit models require bureau history. 40% of India's adult population has none."
3. **Solution** (20s) — "ThinFile reads UPI behavioural signals — consistency, diversity, failure rate — and produces an explainable credit score in under 50ms."
4. **Demo** (60s) — Show Priya (high score), then Anand (low score). Point out the plain-English explanation and SHAP chart.
5. **Impact** (5s) — "Any NBFC can plug into our API today and start lending to this segment responsibly."

---

## Simplified Input Form (6 user-facing inputs)

The React demo page (`frontend/src/pages/Demo.jsx`) collects 6 plain-language inputs and derives all 11 model features automatically in `deriveFeatures()` before the API call. No persona presets or example buttons exist in the UI — users enter their own real data.

### Input → Feature mapping

| # | Input | Type | Maps to |
|---|---|---|---|
| 1 | UPI transactions/month | number (0–60) | `avg_txn_freq` (direct) |
| 2 | Bill payment on-time % | slider (0–100) | `consistency_score = val/400`, `utility_streak = val/100`, `fail_ratio = 1 - val/100` |
| 3 | Rent payment regularity | segmented 2-way | `recency_score` (0.5 or 1.0), `txn_freq_trend` (-1 or +2) |
| 4 | Monthly income (₹) | number | `avg_amount`, `amount_volatility`, `total_volume` (bracket lookup) |
| 5 | Mobile recharge frequency | segmented 3-way | `recharge_count` (1, 5, or 10) |
| 6 | Employment type | segmented 3-way | `category_diversity` (2, 5, or 7) |

### Income bracket lookup

| Income range | avg_amount | amount_volatility | total_volume |
|---|---|---|---|
| < ₹10,000 | 180 | 120 | 3,500 |
| ₹10,000–25,000 | 420 | 280 | 9,000 |
| ₹25,000–50,000 | 750 | 380 | 22,000 |
| ₹50,000–1,00,000 | 1,400 | 600 | 45,000 |
| > ₹1,00,000 | 2,800 | 900 | 95,000 |

### Default state on page load

- INPUT 1 (UPI transactions): 10
- INPUT 2 (bills on-time %): 50
- INPUT 3 (rent regularity): no option pre-selected
- INPUT 4 (monthly income): blank
- INPUT 5 (recharge): no option pre-selected
- INPUT 6 (employment): no option pre-selected

"Calculate my score" button is disabled until inputs 1, 3, 4 (> 0), 5, and 6 are all filled.

Backend receives all 11 features unchanged via `POST /score` and `POST /optimize`. Derivation is frontend-only.

---

## Notes for AI coding assistants

- All data generation is synthetic. Do not attempt to fetch or use real UPI transaction data.
- The `risk_profile` column in `upi_transactions.csv` is used only for label generation. It must never be included as a model feature — doing so would be data leakage.
- SHAP values from `TreeExplainer` on XGBoost return a single array (not a list of two arrays). Use `shap_values[0]` for the first sample, not `shap_values[1]`.
- The score mapping is intentional: `score = 900 - (default_prob * 600)`. Do not change this formula without updating the score interpretation table.
- Streamlit's `st.rerun()` is required after loading a demo persona to refresh the right-hand column. Do not use `st.experimental_rerun()` — it is deprecated.
- FastAPI and Streamlit must run as two separate processes on different ports (8000 and 8501). Do not attempt to serve both from the same process.
