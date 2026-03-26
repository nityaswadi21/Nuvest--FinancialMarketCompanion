from fastapi import APIRouter
from pydantic import BaseModel
from ml.model import load_model
from ml.features import extract_features
from ml.explainer import get_shap_factors

router = APIRouter()
model = load_model()

class UserInput(BaseModel):
    upi_transactions_per_month: int
    bill_payment_on_time_pct: float
    rent_payments_regular: int
    monthly_income_estimate: float
    mobile_recharge_frequency: int
    employment_type: int

@router.post("/predict")
def predict(user: UserInput):
    features = extract_features(user.dict())
    score = float(model.predict([features])[0])
    score = round(min(max(score, 300), 850), 1)

    if score >= 650:
        risk_tier = "Low"
    elif score >= 450:
        risk_tier = "Medium"
    else:
        risk_tier = "High"

    shap_factors = get_shap_factors(model, features)

    return {
        "score": score,
        "risk_tier": risk_tier,
        "shap_factors": shap_factors
    }