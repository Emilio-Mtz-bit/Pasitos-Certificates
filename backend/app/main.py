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

with engine.connect() as _conn:
    _indexes = _conn.execute(text("PRAGMA index_list('certificates')")).fetchall()
    _needs_migration = False
    for _idx in _indexes:
        _idx_name, _is_unique = _idx[1], _idx[2]
        if _is_unique:
            _cols_info = _conn.execute(text(f"PRAGMA index_info('{_idx_name}')")).fetchall()
            if any(_c[2] == 'enrollment_id' for _c in _cols_info):
                _needs_migration = True
                break

    if _needs_migration:
        _conn.execute(text("PRAGMA foreign_keys=OFF"))
        _conn.execute(text("""
            CREATE TABLE certificates_new (
                id VARCHAR NOT NULL,
                enrollment_id VARCHAR NOT NULL,
                gpg_key_id VARCHAR NOT NULL,
                no_certificado VARCHAR(20) NOT NULL UNIQUE,
                folio_verificacion VARCHAR(20) NOT NULL UNIQUE,
                cert_hash VARCHAR(64) NOT NULL,
                firma_gpg TEXT NOT NULL,
                estado VARCHAR NOT NULL,
                fecha_emision DATE,
                created_at DATETIME DEFAULT (CURRENT_TIMESTAMP),
                pdf_path VARCHAR,
                PRIMARY KEY (id),
                FOREIGN KEY(enrollment_id) REFERENCES enrollments(id),
                FOREIGN KEY(gpg_key_id) REFERENCES gpg_keys(id)
            )
        """))
        _conn.execute(text("""
            INSERT INTO certificates_new
                (id, enrollment_id, gpg_key_id, no_certificado, folio_verificacion,
                 cert_hash, firma_gpg, estado, fecha_emision, created_at, pdf_path)
            SELECT id, enrollment_id, gpg_key_id, no_certificado, folio_verificacion,
                   cert_hash, firma_gpg, estado, fecha_emision, created_at, pdf_path
            FROM certificates
        """))
        _conn.execute(text("DROP TABLE certificates"))
        _conn.execute(text("ALTER TABLE certificates_new RENAME TO certificates"))
        _conn.execute(text("PRAGMA foreign_keys=ON"))
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
