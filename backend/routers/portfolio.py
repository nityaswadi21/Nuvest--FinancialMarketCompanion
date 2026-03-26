import os
import json
import time
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

router = APIRouter(prefix="/portfolio", tags=["portfolio"])

KITE_API_KEY  = os.getenv("KITE_API_KEY", "")
KITE_API_SECRET = os.getenv("KITE_API_SECRET", "")
GROQ_API_KEY  = os.getenv("GROQ_API_KEY", "")

# session.json lives in backend/ (parent of routers/)
SESSION_FILE = Path(__file__).resolve().parent.parent / "session.json"

# ---------------------------------------------------------------------------
# Mock data — 6 realistic Indian equity holdings (NSE, CNC product)
# ---------------------------------------------------------------------------
MOCK_HOLDINGS = [
    {
        "tradingsymbol": "INFY", "exchange": "NSE", "isin": "INE009A01021",
        "quantity": 15, "average_price": 1420.50, "last_price": 1567.80,
        "pnl": 2209.50, "day_change": 12.30, "day_change_percentage": 0.79, "product": "CNC",
    },
    {
        "tradingsymbol": "TCS", "exchange": "NSE", "isin": "INE467B01029",
        "quantity": 8, "average_price": 3210.00, "last_price": 3485.60,
        "pnl": 2204.80, "day_change": 23.60, "day_change_percentage": 0.68, "product": "CNC",
    },
    {
        "tradingsymbol": "RELIANCE", "exchange": "NSE", "isin": "INE002A01018",
        "quantity": 12, "average_price": 2780.00, "last_price": 2612.50,
        "pnl": -2010.00, "day_change": -17.50, "day_change_percentage": -0.66, "product": "CNC",
    },
    {
        "tradingsymbol": "HDFCBANK", "exchange": "NSE", "isin": "INE040A01034",
        "quantity": 20, "average_price": 1540.00, "last_price": 1698.30,
        "pnl": 3166.00, "day_change": 6.30, "day_change_percentage": 0.37, "product": "CNC",
    },
    {
        "tradingsymbol": "BAJFINANCE", "exchange": "NSE", "isin": "INE296A01024",
        "quantity": 5, "average_price": 6200.00, "last_price": 7145.00,
        "pnl": 4725.00, "day_change": 55.00, "day_change_percentage": 0.78, "product": "CNC",
    },
    {
        "tradingsymbol": "WIPRO", "exchange": "NSE", "isin": "INE075A01022",
        "quantity": 30, "average_price": 480.00, "last_price": 445.20,
        "pnl": -1044.00, "day_change": -3.80, "day_change_percentage": -0.84, "product": "CNC",
    },
]


# ---------------------------------------------------------------------------
# Session helpers
# ---------------------------------------------------------------------------
def _load_session() -> Optional[dict]:
    try:
        if SESSION_FILE.exists():
            return json.loads(SESSION_FILE.read_text())
    except Exception:
        pass
    return None


def _save_session(data: dict):
    SESSION_FILE.write_text(json.dumps(data, indent=2))


def _clear_session():
    if SESSION_FILE.exists():
        SESSION_FILE.unlink()


def _get_kite():
    """Return an authenticated KiteConnect instance, or None if unavailable."""
    if not KITE_API_KEY:
        return None
    session = _load_session()
    if not session or "access_token" not in session:
        return None
    try:
        from kiteconnect import KiteConnect
        kite = KiteConnect(api_key=KITE_API_KEY)
        kite.set_access_token(session["access_token"])
        return kite
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Overview calculator
# ---------------------------------------------------------------------------
def _compute_overview(holdings: list[dict]) -> dict:
    total_invested = sum(h["quantity"] * h["average_price"] for h in holdings)
    current_value  = sum(h["quantity"] * h["last_price"]    for h in holdings)
    total_pnl      = current_value - total_invested
    total_pnl_pct  = (total_pnl / total_invested * 100) if total_invested else 0
    day_change     = sum(h["quantity"] * h["day_change"]    for h in holdings)
    prev_value     = current_value - day_change
    day_change_pct = (day_change / prev_value * 100) if prev_value else 0

    by_pnl = sorted(holdings, key=lambda h: h["pnl"])
    return {
        "total_invested": round(total_invested, 2),
        "current_value":  round(current_value,  2),
        "total_pnl":      round(total_pnl,      2),
        "total_pnl_pct":  round(total_pnl_pct,  2),
        "day_change":     round(day_change,      2),
        "day_change_pct": round(day_change_pct,  2),
        "xirr":           round(total_pnl_pct * 1.4, 2),
        "top_gainer":     by_pnl[-1]["tradingsymbol"] if by_pnl else None,
        "top_loser":      by_pnl[0]["tradingsymbol"]  if by_pnl else None,
        "holdings_count": len(holdings),
    }


# ---------------------------------------------------------------------------
# GET /portfolio/status
# ---------------------------------------------------------------------------
@router.get("/status")
def get_status():
    session = _load_session()
    if session and KITE_API_KEY and "access_token" in session:
        return {"connected": True,  "mode": "live", "user_name": session.get("user_name", "")}
    return     {"connected": False, "mode": "mock", "user_name": ""}


# ---------------------------------------------------------------------------
# GET /portfolio/login  — returns Kite OAuth URL
# ---------------------------------------------------------------------------
@router.get("/login")
def get_login():
    if not KITE_API_KEY:
        raise HTTPException(400, "KITE_API_KEY not set in backend/.env")
    try:
        from kiteconnect import KiteConnect
        kite = KiteConnect(api_key=KITE_API_KEY)
        return {"login_url": kite.login_url()}
    except ImportError:
        raise HTTPException(500, "kiteconnect not installed. Run: pip install kiteconnect")


# ---------------------------------------------------------------------------
# GET /portfolio/callback?request_token=xxx  — exchange token, save session
# ---------------------------------------------------------------------------
@router.get("/callback")
def kite_callback(request_token: str = Query(...)):
    if not KITE_API_KEY or not KITE_API_SECRET:
        raise HTTPException(400, "KITE_API_KEY and KITE_API_SECRET must be set in backend/.env")
    try:
        from kiteconnect import KiteConnect
        kite = KiteConnect(api_key=KITE_API_KEY)
        data = kite.generate_session(request_token, api_secret=KITE_API_SECRET)
        _save_session({
            "access_token": data["access_token"],
            "user_name":    data.get("user_name", ""),
            "user_id":      data.get("user_id",   ""),
            "timestamp":    time.time(),
        })
        return {"status": "connected", "user_name": data.get("user_name", "")}
    except Exception as e:
        raise HTTPException(400, str(e))


# ---------------------------------------------------------------------------
# DELETE /portfolio/logout
# ---------------------------------------------------------------------------
@router.delete("/logout")
def logout():
    _clear_session()
    return {"status": "disconnected"}


# ---------------------------------------------------------------------------
# GET /portfolio/holdings
# ---------------------------------------------------------------------------
@router.get("/holdings")
def get_holdings(mock: Optional[bool] = Query(None)):
    if mock is not True:
        kite = _get_kite()
        if kite:
            try:
                raw = kite.holdings()
                holdings = []
                for h in raw:
                    qty = h.get("quantity", 0)
                    if qty <= 0:
                        continue
                    holdings.append({
                        "tradingsymbol":         h["tradingsymbol"],
                        "exchange":              h.get("exchange", "NSE"),
                        "isin":                  h.get("isin", ""),
                        "quantity":              qty,
                        "average_price":         round(float(h.get("average_price", 0)), 2),
                        "last_price":            round(float(h.get("last_price", 0)), 2),
                        "pnl":                   round(float(h.get("pnl", 0)), 2),
                        "day_change":            round(float(h.get("day_change", 0)), 2),
                        "day_change_percentage": round(float(h.get("day_change_percentage", 0)), 2),
                        "product":               h.get("product", "CNC"),
                    })
                return {"source": "live", "holdings": holdings}
            except Exception:
                pass  # fall through to mock
    return {"source": "mock", "holdings": MOCK_HOLDINGS}


# ---------------------------------------------------------------------------
# GET /portfolio/overview
# ---------------------------------------------------------------------------
@router.get("/overview")
def get_overview(mock: Optional[bool] = Query(None)):
    resp = get_holdings(mock=mock)
    return {"source": resp["source"], "overview": _compute_overview(resp["holdings"])}


# ---------------------------------------------------------------------------
# POST /portfolio/analyze  — Claude AI analysis
# ---------------------------------------------------------------------------
class AnalyzeRequest(BaseModel):
    mock: Optional[bool] = None


@router.post("/analyze")
def analyze_portfolio(body: AnalyzeRequest = AnalyzeRequest()):
    if not GROQ_API_KEY:
        raise HTTPException(400, "GROQ_API_KEY is not set. Add it to backend/.env.")

    resp     = get_holdings(mock=body.mock)
    holdings = resp["holdings"]
    overview = _compute_overview(holdings)

    summary = []
    for h in holdings:
        inv     = h["quantity"] * h["average_price"]
        cur     = h["quantity"] * h["last_price"]
        pnl_pct = ((cur - inv) / inv * 100) if inv else 0
        summary.append({
            "symbol":         h["tradingsymbol"],
            "exchange":       h["exchange"],
            "quantity":       h["quantity"],
            "avg_buy_price":  round(h["average_price"], 2),
            "current_price":  round(h["last_price"], 2),
            "pnl_inr":        round(h["pnl"], 2),
            "pnl_pct":        round(pnl_pct, 2),
            "day_change_pct": round(h["day_change_percentage"], 2),
        })

    prompt = f"""You are an expert Indian equity portfolio analyst.

Portfolio summary:
- Total invested: ₹{overview['total_invested']:,.0f}
- Current value: ₹{overview['current_value']:,.0f}
- Overall P&L: ₹{overview['total_pnl']:,.0f} ({overview['total_pnl_pct']:.1f}%)
- Today's change: ₹{overview['day_change']:,.0f} ({overview['day_change_pct']:.2f}%)

Individual holdings:
{json.dumps(summary, indent=2)}

Provide your analysis as ONLY valid JSON (no markdown, no explanation outside the JSON) in this exact structure:
{{
  "stock_recommendations": [
    {{
      "symbol": "SYMBOL",
      "recommendation": "Buy|Hold|Sell",
      "reason": "concise one-line reason based on P&L, momentum, and valuation"
    }}
  ],
  "portfolio_health": "2–3 sentence overall health summary covering diversification, risk, and performance",
  "suggestions": [
    "specific actionable suggestion 1",
    "specific actionable suggestion 2",
    "specific actionable suggestion 3"
  ]
}}"""

    try:
        client   = OpenAI(api_key=GROQ_API_KEY, base_url="https://api.groq.com/openai/v1")
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        analysis = json.loads(raw.strip())
    except json.JSONDecodeError as e:
        raise HTTPException(502, f"Groq returned non-JSON: {e}")
    except Exception as e:
        raise HTTPException(502, f"Groq API error: {e}")

    rec_map = {r["symbol"]: r for r in analysis.get("stock_recommendations", [])}
    for h in holdings:
        sym               = h["tradingsymbol"]
        h["recommendation"] = rec_map.get(sym, {}).get("recommendation", "Hold")
        h["rec_reason"]     = rec_map.get(sym, {}).get("reason", "")

    return {
        "source":   resp["source"],
        "holdings": holdings,
        "overview": overview,
        "analysis": {
            "portfolio_health": analysis.get("portfolio_health", ""),
            "suggestions":      analysis.get("suggestions", []),
        },
    }


# ---------------------------------------------------------------------------
# POST /portfolio/chat  — streaming chat with portfolio context
# ---------------------------------------------------------------------------
class ChatRequest(BaseModel):
    message: str
    holdings: list = []
    overview: Optional[dict] = None
    health_score: Optional[int] = None


@router.post("/chat")
def chat(body: ChatRequest):
    if not GROQ_API_KEY:
        raise HTTPException(400, "GROQ_API_KEY is not set. Add it to backend/.env.")

    holdings_text = "\n".join([
        f"  - {h.get('tradingsymbol','?')} ({h.get('exchange','NSE')}): "
        f"{h.get('quantity', 0)} shares, avg ₹{h.get('average_price', 0):.2f}, "
        f"current ₹{h.get('last_price', 0):.2f}, P&L ₹{h.get('pnl', 0):.2f}"
        for h in (body.holdings or [])
    ]) or "  (no holdings data)"

    ov = body.overview or {}
    system_prompt = f"""You are an expert Indian equity portfolio analyst for the Nuvest app.

User's current portfolio:
{holdings_text}

Portfolio summary:
- Total invested: ₹{ov.get('total_invested', 0):,.0f}
- Current value:  ₹{ov.get('current_value', 0):,.0f}
- Total P&L:      ₹{ov.get('total_pnl', 0):,.0f} ({ov.get('total_pnl_pct', 0):.1f}%)
- Today's change: {ov.get('day_change_pct', 0):.2f}%
- Health score:   {body.health_score or 0}/100
- Top gainer:     {ov.get('top_gainer', 'N/A')}
- Top loser:      {ov.get('top_loser', 'N/A')}
- Holdings count: {ov.get('holdings_count', 0)}

Answer the user's question about their specific portfolio. Be concise, specific, and actionable. Reference actual symbols and numbers where relevant."""

    def generate():
        try:
            client = OpenAI(api_key=GROQ_API_KEY, base_url="https://api.groq.com/openai/v1")
            stream = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                max_tokens=400,
                stream=True,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user",   "content": body.message},
                ],
            )
            for chunk in stream:
                delta = chunk.choices[0].delta.content or ""
                if delta:
                    yield f"data: {json.dumps({'text': delta})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'text': f'Error: {e}'})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
