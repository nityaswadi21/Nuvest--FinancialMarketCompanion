# CreditAI — Hackathon Project Context

## Theme
**AI for Financial Inclusion & Smart Investing**  
Integration with platforms like Zerodha / Upstox

---

## Primary Problem: Credit Scoring for Thin-File Users (#5)

Build a credit scoring model for individuals with little or no formal credit history using alternative data sources.

**Goal:** Produce an explainable credit score (0–850) + risk tier (Low / Medium / High) with SHAP-based reasoning so users understand *why* they scored what they did.

---

## Roadmap (Build Order)

### Phase 1 — Credit Scoring Core
- Define and ingest alternative data sources (UPI history, bill payments, rent, mobile usage)
- Train ML model (baseline: Logistic Regression → XGBoost/LightGBM)
- Add SHAP explainability layer
- Expose via FastAPI `/predict` endpoint

### Phase 2 — Website & Demo Flow
- Landing page with problem + solution pitch
- User input form (alternative data inputs)
- Animated score result page with risk tier badge + SHAP explanations
- Dashboard shell with hooks for Phase 3 features

### Phase 3 — Layer In Remaining Features
- **Problem 4:** SIP / ETF Recommendation Engine — use risk score to recommend funds, dynamic rebalancing
- **Problem 3:** AI-Based Tax Optimizer & Harvesting Advisor — connect portfolio data, suggest tax-loss harvesting

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React + Tailwind CSS |
| Backend | FastAPI (Python) |
| ML | scikit-learn / XGBoost + SHAP |
| Data | Synthetic dataset (or GMSC / open RBI data) |
| Broker Integration | Zerodha Kite API / Upstox API (mocked initially) |
| Frontend Hosting | Vercel |
| Backend Hosting | Render or HuggingFace Spaces |

---

## Project Structure

```
/
├── frontend/                  # React + Tailwind
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Landing.jsx        # Hero, problem statement
│   │   │   ├── Demo.jsx           # Input form + score reveal
│   │   │   └── Dashboard.jsx      # Full user dashboard
│   │   ├── components/
│   │   │   ├── ScoreCard.jsx      # Animated score display
│   │   │   ├── RiskBadge.jsx      # Low/Med/High badge
│   │   │   ├── ShapChart.jsx      # SHAP factor breakdown
│   │   │   └── RecommendationPanel.jsx  # SIP/ETF suggestions (Phase 3)
│   │   └── App.jsx
│   └── package.json
│
├── backend/                   # FastAPI
│   ├── main.py                # API entry point
│   ├── routers/
│   │   ├── score.py           # POST /predict — returns score + SHAP
│   │   ├── recommendations.py # GET /recommend — SIP/ETF logic (Phase 3)
│   │   └── tax.py             # POST /tax-optimize (Phase 3)
│   ├── ml/
│   │   ├── model.py           # Model training + inference
│   │   ├── features.py        # Feature engineering
│   │   └── explainer.py       # SHAP wrapper
│   ├── data/
│   │   └── synthetic_data.csv # Generated training data
│   └── requirements.txt
│
└── CLAUDE.md
```

---

## Key API Endpoints

### `POST /predict`
**Input:**
```json
{
  "upi_transactions_per_month": 45,
  "bill_payment_on_time_pct": 0.92,
  "rent_payments_regular": true,
  "monthly_income_estimate": 35000,
  "mobile_recharge_frequency": "monthly",
  "employment_type": "salaried"
}
```
**Output:**
```json
{
  "score": 712,
  "risk_tier": "Low",
  "shap_factors": [
    { "feature": "bill_payment_on_time_pct", "impact": "+85", "direction": "positive" },
    { "feature": "upi_transactions_per_month", "impact": "+62", "direction": "positive" },
    { "feature": "employment_type", "impact": "-20", "direction": "negative" }
  ]
}
```

### `GET /recommend` (Phase 3)
Returns SIP/ETF recommendations based on risk tier from credit score.

### `POST /tax-optimize` (Phase 3)
Accepts portfolio holdings, returns tax-loss harvesting suggestions.

---

## Alternative Data Sources Used
- UPI / digital payment transaction frequency
- Utility & mobile bill payment regularity
- Rent payment consistency
- Income estimation signals
- Employment type
- Mobile recharge patterns

---

## ML Model Notes
- **Baseline:** Logistic Regression
- **Primary:** XGBoost or LightGBM
- **Explainability:** SHAP (TreeExplainer for XGBoost)
- **Score range:** 0–850 (normalized output)
- **Risk tiers:** Low (650+), Medium (450–649), High (<450)
- **Training data:** Synthetic dataset generated to mimic thin-file user profiles

---

## Broker Integration (Zerodha / Upstox)
- Use **Kite Connect API** (Zerodha) or **Upstox API v2**
- For hackathon: mock API responses to simulate portfolio data
- Real integration hooks should be stubbed and ready to connect

---

## Hackathon Priorities
1. Working `/predict` endpoint with SHAP output
2. Polished demo flow: form → animated score → explanation
3. Dashboard with placeholder panels for SIP + Tax features
4. Clean landing page that sells the problem + solution
5. Everything hosted and accessible via a public URL before demo

---

## Demo Script (for judges)
1. Open landing page — explain the thin-file problem
2. Fill the input form with a sample user profile
3. Show the score reveal + risk badge
4. Walk through the SHAP explanation ("here's *why* this person scored 712")
5. Point to the dashboard — "this is where SIP recommendations and tax optimization will live"

---

## Notes for Claude Code
- Prioritize demo-ability over model accuracy
- Keep the frontend visually impressive — judges respond to polish
- All ML logic lives in `/backend/ml/` — keep it modular
- Synthetic data generation script should be in `/backend/data/`
- Use mock data for Zerodha/Upstox in Phase 1 and 2
- SHAP values must always be returned with the score — it's a core feature, not optional
