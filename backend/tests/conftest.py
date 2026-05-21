import os
import pytest
import gnupg
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base, get_db
from app.main import app
from app import models

TEST_DB_URL = "sqlite:///./test_pasitos.db"
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def gpg_test_key():
    from app.services.gpg_service import get_gpg
    gpg = get_gpg()
    existing = [k for k in gpg.list_keys(True)
                if any("testpasitos@demo.com" in uid for uid in k.get("uids", []))]
    if existing:
        fingerprint = existing[0]["fingerprint"]
    else:
        input_data = gpg.gen_key_input(
            key_type="RSA", key_length=1024,
            name_real="Test Pasitos", name_email="testpasitos@demo.com",
            expire_date=0, no_protection=True,
        )
        key = gpg.gen_key(input_data)
        fingerprint = key.fingerprint

    os.environ["GPG_KEY_FINGERPRINT"] = fingerprint
    public_key = gpg.export_keys(fingerprint)
    yield {"fingerprint": fingerprint, "public_key": public_key}


@pytest.fixture(autouse=True)
def reset_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db(gpg_test_key):
    session = TestingSessionLocal()
    gpg_key = models.GpgKey(
        id="gpg-test-1",
        key_id=gpg_test_key["fingerprint"],
        descripcion="Test key",
        public_key_armored=gpg_test_key["public_key"],
    )
    course = models.Course(
        id="course-test-1", codigo="C-001", nombre="Puericultura",
        tipo=models.TipoCurso.capacitacion_tecnica,
        modalidad=models.ModalidadCurso.presencial_online,
        duracion_horas=80, calificacion_min=7.0,
    )
    session.add_all([gpg_key, course])
    session.commit()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
