FEATURE_COLUMNS = [
    "upi_transactions_per_month",
    "bill_payment_on_time_pct",
    "rent_payments_regular",
    "monthly_income_estimate",
    "mobile_recharge_frequency",
    "employment_type",
]

def extract_features(data: dict):
    return [data[col] for col in FEATURE_COLUMNS]