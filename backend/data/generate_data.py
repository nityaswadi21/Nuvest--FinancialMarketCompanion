import pandas as pd
import numpy as np

np.random.seed(42)
n = 1000

df = pd.DataFrame({
    "upi_transactions_per_month": np.random.randint(0, 100, n),
    "bill_payment_on_time_pct": np.round(np.random.uniform(0, 1, n), 2),
    "rent_payments_regular": np.random.randint(0, 2, n),
    "monthly_income_estimate": np.random.randint(5000, 100000, n),
    "mobile_recharge_frequency": np.random.choice([0, 1, 2], n),  # 0=rare, 1=monthly, 2=frequent
    "employment_type": np.random.choice([0, 1, 2], n),  # 0=unemployed, 1=self, 2=salaried
})

# Generate synthetic score
df["score"] = (
    df["upi_transactions_per_month"] * 2 +
    df["bill_payment_on_time_pct"] * 300 +
    df["rent_payments_regular"] * 100 +
    df["monthly_income_estimate"] / 500 +
    df["mobile_recharge_frequency"] * 30 +
    df["employment_type"] * 50 +
    np.random.normal(0, 20, n)
).clip(300, 850)

df["risk_tier"] = pd.cut(df["score"], bins=[0, 450, 649, 850],
                          labels=["High", "Medium", "Low"])

df.to_csv("data/synthetic_data.csv", index=False)
print("Dataset generated: data/synthetic_data.csv")