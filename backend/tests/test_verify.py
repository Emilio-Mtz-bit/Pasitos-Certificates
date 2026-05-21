import pytest


@pytest.fixture
def certificado_emitido(client):
    part = client.post("/participants/", json={
        "nombre_completo": "María López Hernández",
        "curp": "LOHM900115MJCRRL05",
    }).json()
    enr = client.post("/enrollments/", json={
        "participant_id": part["id"],
        "course_id": "course-test-1",
        "fecha_inicio": "2025-03-01",
        "fecha_termino": "2025-03-28",
        "calificacion": 9.5,
    }).json()
    client.patch(f"/enrollments/{enr['id']}/submit")
    cert = client.patch(f"/enrollments/{enr['id']}/emit").json()
    return cert


def test_verificar_folio_valido(client, certificado_emitido):
    folio = certificado_emitido["folio_verificacion"]
    response = client.get(f"/verify/{folio}")
    assert response.status_code == 200
    data = response.json()
    assert data["valido"] is True
    assert data["certificado"]["nombre"] == "María López Hernández"
    assert data["certificado"]["curso"] == "Puericultura"
    assert data["verificacion"]["firma_gpg_valida"] is True
    assert data["verificacion"]["hash_integro"] is True


def test_verificar_folio_inexistente(client):
    response = client.get("/verify/VER-9999")
    assert response.status_code == 200
    data = response.json()
    assert data["valido"] is False
    assert data["razon"] == "certificado_no_encontrado"


def test_verify_log_se_registra(client, certificado_emitido, db):
    from app import models
    folio = certificado_emitido["folio_verificacion"]
    client.get(f"/verify/{folio}")
    logs = db.query(models.VerifyLog).all()
    assert len(logs) == 1
    assert logs[0].resultado == models.ResultadoVerificacion.valido
