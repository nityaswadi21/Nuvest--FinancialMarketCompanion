from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import score, trajectory, optimize

app = FastAPI(title="Credit Scoring API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(score.router)
app.include_router(trajectory.router)
app.include_router(optimize.router)

@app.get("/")
def root():
    return {"message": "Credit Scoring API is running"}
