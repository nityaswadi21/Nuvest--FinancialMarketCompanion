from fastapi import APIRouter
from pydantic import BaseModel
from model.trajectory import project_trajectory

router = APIRouter()


class TrajectoryInput(BaseModel):
    avg_txn_freq: float
    txn_freq_trend: float
    consistency_score: float
    recency_score: float
    category_diversity: float
    avg_amount: float
    amount_volatility: float
    fail_ratio: float
    utility_streak: float
    total_volume: float
    recharge_count: float


@router.post("/trajectory")
def get_trajectory(body: TrajectoryInput):
    return project_trajectory(body.model_dump())
