import pandas as pd
import numpy as np
import pickle
from xgboost import XGBRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error
from ml.features import FEATURE_COLUMNS

def train():
    df = pd.read_csv("data/synthetic_data.csv")
    X = df[FEATURE_COLUMNS]
    y = df["score"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = XGBRegressor(n_estimators=100, max_depth=4, learning_rate=0.1)
    model.fit(X_train, y_train)

    preds = model.predict(X_test)
    print(f"MAE: {mean_absolute_error(y_test, preds):.2f}")

    with open("ml/model.pkl", "wb") as f:
        pickle.dump(model, f)
    print("Model saved to ml/model.pkl")

def load_model():
    with open("ml/model.pkl", "rb") as f:
        return pickle.load(f)

if __name__ == "__main__":
    train()