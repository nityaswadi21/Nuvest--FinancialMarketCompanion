from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import score

app = FastAPI(title="Credit Scoring API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(score.router)

@app.get("/")
def root():
    return {"message": "Credit Scoring API is running"}
