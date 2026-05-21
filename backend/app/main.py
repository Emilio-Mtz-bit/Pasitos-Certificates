from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import courses, participants

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Pasitos Certificates API", version="1.0.0-demo")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(courses.router)
app.include_router(participants.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "pasitos-certificates-demo"}
