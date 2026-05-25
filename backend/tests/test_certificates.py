import pytest
from app import models
from decimal import Decimal
from datetime import date


def _crear_certificado(db, client):
    """Helper: crea participante, inscripción y emite certificado. Retorna (cert_dict, participant)."""
    participant = models.Participant(
        nombre_completo="Ana Perez Lopez",
        curp="PELA900101MDFPRN01",
    )
    db.add(participant)
    db.commit()

    enr_res = client.post("/enrollments/", json={
        "participant_id": participant.id,
        "course_id": "course-test-1",
        "fecha_inicio": "2026-01-01",
        "fecha_termino": "2026-01-31",
        "calificacion": 9.0,
    })
    enr_id = enr_res.json()["id"]
    client.patch(f"/enrollments/{enr_id}/submit")
    cert_res = client.patch(f"/enrollments/{enr_id}/emit")
    return cert_res.json(), participant


def test_buscar_por_curp(client, db):
    cert, participant = _crear_certificado(db, client)
    res = client.get(f"/certificates/?curp={participant.curp}")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["folio_verificacion"] == cert["folio_verificacion"]
    assert data[0]["nombre"] == "Ana Perez Lopez"
    assert data[0]["curp"] == "PELA900101MDFPRN01"
    assert data[0]["estado"] == "activo"


def test_buscar_por_folio(client, db):
    cert, _ = _crear_certificado(db, client)
    res = client.get(f"/certificates/?folio={cert['folio_verificacion']}")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["no_certificado"] == cert["no_certificado"]


def test_buscar_sin_parametros_retorna_400(client, db):
    res = client.get("/certificates/")
    assert res.status_code == 400


def test_buscar_curp_sin_resultados(client, db):
    res = client.get("/certificates/?curp=XXXX000000XXXXXXXX")
    assert res.status_code == 200
    assert res.json() == []


def test_revocar_certificado(client, db):
    cert, _ = _crear_certificado(db, client)
    res = client.patch(f"/certificates/{cert['id']}/revoke")
    assert res.status_code == 200
    assert res.json()["estado"] == "revocado"


def test_revocar_dos_veces_retorna_400(client, db):
    cert, _ = _crear_certificado(db, client)
    client.patch(f"/certificates/{cert['id']}/revoke")
    res = client.patch(f"/certificates/{cert['id']}/revoke")
    assert res.status_code == 400


def test_revocar_inexistente_retorna_404(client, db):
    res = client.patch("/certificates/no-existe/revoke")
    assert res.status_code == 404
