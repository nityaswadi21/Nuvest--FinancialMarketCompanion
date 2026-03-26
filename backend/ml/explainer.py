import shap
import numpy as np
from ml.features import FEATURE_COLUMNS

def get_shap_factors(model, input_features: list):
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(np.array([input_features]))

    factors = []
    for i, col in enumerate(FEATURE_COLUMNS):
        factors.append({
            "feature": col,
            "impact": round(float(shap_values[0][i]), 2),
            "direction": "positive" if shap_values[0][i] >= 0 else "negative"
        })

    return sorted(factors, key=lambda x: abs(x["impact"]), reverse=True)