from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from .database import engine, Base
from .routers import courses, participants, enrollments, verify, certificates

Base.metadata.create_all(bind=engine)

with engine.connect() as _conn:
    _cols = [r[1] for r in _conn.execute(text("PRAGMA table_info(certificates)"))]
    if "pdf_path" not in _cols:
        _conn.execute(text("ALTER TABLE certificates ADD COLUMN pdf_path TEXT"))
        _conn.commit()

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
app.include_router(enrollments.router)
app.include_router(verify.router)
app.include_router(certificates.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "pasitos-certificates-demo"}
