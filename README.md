# Nuvest 🌿
### AI-powered wealth, built for every Indian investor.

Nuvest is a full-stack AI fintech platform that combines alternative-data credit scoring with live portfolio analysis, an AI trading advisor, and a conversational portfolio chatbot — all built for Indian retail investors.

**Live Demo:** [credit-scoring-detection.vercel.app](https://credit-scoring-detection.vercel.app)  
**API:** [nuvest-api.onrender.com](https://nuvest-api.onrender.com)

---

## The Problem

190 million Indians lack formal credit history. Traditional credit scoring excludes gig workers, students, and first-time earners entirely. At the same time, retail investors have no accessible AI tools to understand and optimize their portfolios.

Nuvest solves both.

---

## Features

### 1. Credit Scoring for Thin-File Users
- Scores users using **alternative data** — UPI transaction frequency, bill payment regularity, rent consistency, income, employment type
- Powered by an **XGBoost model** trained on synthetic thin-file user profiles
- **SHAP explainability** — every score comes with a breakdown of exactly which factors helped or hurt
- Score range: 300–850 with risk tiers (Low / Medium / High)

### 2. Live Portfolio Analysis (Zerodha Kite Connect)
- Connects to real Zerodha accounts via **Kite Connect OAuth**
- Displays live holdings with P&L, LTP, sparkline charts, and day change
- **AI-powered Buy/Hold/Sell recommendations** per stock using Grok (xAI)
- Portfolio health score with circular progress ring
- Overall AI assessment with actionable rebalancing suggestions

### 3. Portfolio Chatbot
- Conversational AI advisor powered by **Grok (xAI)**
- Context-aware — the chatbot knows your exact holdings, P&L, and portfolio health
- Ask anything: "Should I sell HINDCOPPER?", "Am I over-exposed to BSE stocks?", "What's my biggest risk?"
- Suggested starter questions for quick access

### 4. AI Trader Personality
- Create a custom AI advisor persona with:
  - Investment Style (General Trader, Day Trader, Momentum Trader, Value Investor)
  - Risk Tolerance (Conservative, Adaptable, Aggressive)
  - Investment Time (Short-term, Medium-term, Long-term)
  - Analysis Weights (Technical, Fundamental, Balanced)
- The persona modifies all AI analysis and chat responses to match your investment philosophy
- Unique SVG avatars generated per personality type
- Persona persists across sessions

### 5. Dashboard
- Unified view of credit score, risk tier, SIP capacity, and tax saving opportunities
- Quick links to all features
- Coming soon: SIP/ETF Recommendations, Tax Optimizer, full AI Trader Personality

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Tailwind CSS + Vite |
| Backend | FastAPI (Python) |
| ML Model | XGBoost + SHAP (scikit-learn) |
| AI Provider | Grok by xAI (OpenAI-compatible API) |
| Broker Integration | Zerodha Kite Connect API |
| Charts | Recharts |
| Frontend Hosting | Vercel |
| Backend Hosting | Render |

---

## Project Structure

```
Nuvest/
├── frontend/                  # React + Tailwind
│   └── src/
│       ├── pages/
│       │   ├── Landing.jsx        # Hero, problem statement, scroll reveal
│       │   ├── CreditScore.jsx    # Alternative data form + score result
│       │   ├── Dashboard.jsx      # Unified feature dashboard
│       │   ├── Portfolio.jsx      # Live portfolio with AI analysis
│       │   └── AIPersona.jsx      # AI trader personality builder
│       ├── components/
│       │   ├── ScoreCard.jsx
│       │   ├── ShapChart.jsx
│       │   └── RecommendationPanel.jsx
│       └── api.js                 # Centralized API base URL config
│
├── backend/                   # FastAPI
│   ├── main.py                # App entry point + CORS
│   ├── routers/
│   │   ├── score.py           # POST /predict
│   │   ├── portfolio.py       # Kite Connect + AI analysis + chat
│   │   ├── trajectory.py
│   │   └── optimize.py
│   ├── ml/
│   │   ├── model.py           # XGBoost training + inference
│   │   ├── features.py        # Feature definitions
│   │   ├── explainer.py       # SHAP wrapper
│   │   └── persona.py         # AI persona prompt builder
│   ├── data/
│   │   ├── generate_data.py   # Synthetic dataset generator
│   │   └── synthetic_data.csv
│   └── requirements.txt
│
└── CLAUDE.md                  # Project context for Claude Code
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/predict` | Credit score + SHAP factors |
| `GET` | `/portfolio/status` | Check Kite connection status |
| `GET` | `/portfolio/login` | Get Kite OAuth login URL |
| `GET` | `/portfolio/callback` | Exchange request token for access token |
| `GET` | `/portfolio/holdings` | Fetch live holdings from Kite |
| `GET` | `/portfolio/overview` | Portfolio summary (value, P&L, top gainer/loser) |
| `POST` | `/portfolio/analyze` | AI analysis with Buy/Hold/Sell per stock |
| `POST` | `/portfolio/chat` | Portfolio chatbot (persona-aware) |
| `POST` | `/portfolio/persona` | Save AI trader persona |

---

## Local Development

### Prerequisites
- Python 3.10+
- Node.js 18+
- Zerodha Kite Connect account
- xAI Grok API key

### Backend Setup
```bash
cd backend
pip install -r requirements.txt

# Generate synthetic training data
python data/generate_data.py

# Train the ML model
python -m ml.model

# Start the API server
uvicorn main:app --reload
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Environment Variables

Create `backend/.env`:
```
KITE_API_KEY=your_kite_api_key
KITE_API_SECRET=your_kite_api_secret
KITE_REDIRECT_URL=http://localhost:3000
GROQ_API_KEY=your_grok_api_key
```

Create `frontend/.env.local`:
```
VITE_API_URL=http://localhost:8000
```

---

## Deployment

### Backend (Render)
- **Service type:** Web Service
- **Root directory:** `backend`
- **Build command:** `pip install -r requirements.txt`
- **Start command:** `uvicorn main:app --host 0.0.0.0 --port 8000`
- Add all environment variables in Render dashboard

### Frontend (Vercel)
- **Root directory:** `frontend`
- **Framework:** Vite
- **Environment variable:** `VITE_API_URL=https://your-render-url.onrender.com`

---

## ML Model Details

- **Algorithm:** XGBoost Regressor
- **Features:** UPI transaction frequency, bill payment on-time %, rent regularity, monthly income, mobile recharge frequency, employment type
- **Training data:** 1000 synthetic thin-file user profiles
- **Explainability:** SHAP TreeExplainer — returns top contributing factors per prediction
- **Score normalization:** Clipped to 300–850 range
- **Risk tiers:** Low (650+), Medium (450–649), High (<450)

---

## Hackathon Context

Built for **Theme 2: AI for Financial Inclusion & Smart Investing**, targeting:
- Problem 5: Credit Scoring for Thin-File Users *(core)*
- Problem 4: Personalized SIP/ETF Recommendation Engine *(coming soon)*
- Problem 3: AI-Based Tax Optimizer & Harvesting Advisor *(coming soon)*

---

## Roadmap

- [ ] SIP/ETF recommendation engine based on risk tier
- [ ] Tax optimizer with Section 80C and tax-loss harvesting
- [ ] Score history and trend chart
- [ ] News feed per stock via NewsData.io
- [ ] PDF financial report download
- [ ] Real-time price updates via Kite WebSocket
- [ ] Mobile responsive design
- [ ] Supabase auth for multi-user support

---

## Built With ❤️ by Nitya
