import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app.services.gpg_service import get_gpg
from app.database import engine, SessionLocal, Base
from app import models


def get_or_create_demo_gpg_key():
    gpg = get_gpg()
    existing = [k for k in gpg.list_keys(True)
                if any("demo@pasitosac.org" in uid for uid in k.get("uids", []))]
    if existing:
        fingerprint = existing[0]["fingerprint"]
        print(f"Llave GPG demo ya existe: {fingerprint}")
    else:
        print("Generando par de llaves GPG (puede tardar unos segundos)...")
        input_data = gpg.gen_key_input(
            key_type="RSA", key_length=2048,
            name_real="Pasitos Education Demo",
            name_email="demo@pasitosac.org",
            expire_date=0,
            no_protection=True,
        )
        key = gpg.gen_key(input_data)
        if not key.fingerprint:
            raise RuntimeError("Error al generar llave GPG")
        fingerprint = key.fingerprint
        print(f"Llave GPG generada: {fingerprint}")

    public_key = gpg.export_keys(fingerprint)
    return fingerprint, public_key


def write_env(fingerprint: str):
    env_path = Path(__file__).parent / ".env"
    content = f"DATABASE_URL=sqlite:///./pasitos.db\nGPG_KEY_FINGERPRINT={fingerprint}\n"
    env_path.write_text(content, encoding="utf-8")
    print(f".env actualizado con GPG_KEY_FINGERPRINT={fingerprint}")


def seed_database(fingerprint: str, public_key: str):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        existing_key = db.query(models.GpgKey).filter(models.GpgKey.key_id == fingerprint).first()
        if not existing_key:
            gpg_key = models.GpgKey(
                key_id=fingerprint,
                descripcion="Pasitos Demo 2026",
                public_key_armored=public_key,
                activa=True,
            )
            db.add(gpg_key)
            print("Llave GPG guardada en BD")

        cursos = [
            ("C-001", "Puericultura", models.TipoCurso.capacitacion_tecnica,
             models.ModalidadCurso.presencial_online, 80, 7.0,
             "Formación integral en cuidado, nutrición, desarrollo y salud del niño de 0 a 6 años."),
            ("C-002", "Asistente Educativo", models.TipoCurso.capacitacion_tecnica,
             models.ModalidadCurso.presencial_online, 80, 7.0,
             "Formación para personal de apoyo educativo en estancias infantiles y guarderías."),
            ("C-003", "Primeros Auxilios Pediátricos", models.TipoCurso.taller_practico,
             models.ModalidadCurso.presencial_online, 50, 7.0,
             "Atención de emergencias médicas en niños: RCP, atragantamiento, fiebre, convulsiones."),
        ]
        for codigo, nombre, tipo, modalidad, horas, cal_min, desc in cursos:
            if not db.query(models.Course).filter(models.Course.codigo == codigo).first():
                db.add(models.Course(
                    codigo=codigo, nombre=nombre, tipo=tipo,
                    modalidad=modalidad, duracion_horas=horas,
                    calificacion_min=cal_min, descripcion=desc,
                ))
                print(f"  Curso {codigo} — {nombre} agregado")

        db.commit()
        print("\nBase de datos lista!")
    finally:
        db.close()


if __name__ == "__main__":
    fingerprint, public_key = get_or_create_demo_gpg_key()
    write_env(fingerprint)
    seed_database(fingerprint, public_key)
    print("\nSetup completo. Ejecuta: uvicorn app.main:app --reload")
