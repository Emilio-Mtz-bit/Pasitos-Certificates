import pytest


@pytest.fixture
def participant_id(client):
    resp = client.post("/participants/", json={
        "nombre_completo": "María López Hernández",
        "curp": "LOHM900115MJCRRL05",
    })
    return resp.json()["id"]


def test_crear_inscripcion(client, participant_id):
    response = client.post("/enrollments/", json={
        "participant_id": participant_id,
        "course_id": "course-test-1",
        "fecha_inicio": "2025-03-01",
        "fecha_termino": "2025-03-28",
        "calificacion": 9.5,
    })
    assert response.status_code == 200
    data = response.json()
    assert data["estado"] == "borrador"
    assert data["resultado"] == "en_proceso"


def test_submit_cambia_estado_a_pendiente(client, participant_id):
    enr = client.post("/enrollments/", json={
        "participant_id": participant_id,
        "course_id": "course-test-1",
        "fecha_inicio": "2025-03-01",
        "fecha_termino": "2025-03-28",
        "calificacion": 9.5,
    }).json()
    response = client.patch(f"/enrollments/{enr['id']}/submit")
    assert response.status_code == 200
    assert response.json()["estado"] == "pendiente"


def test_listar_pendientes(client, participant_id):
    enr = client.post("/enrollments/", json={
        "participant_id": participant_id,
        "course_id": "course-test-1",
        "fecha_inicio": "2025-03-01",
        "fecha_termino": "2025-03-28",
        "calificacion": 9.5,
    }).json()
    client.patch(f"/enrollments/{enr['id']}/submit")
    response = client.get("/enrollments/?estado=pendiente")
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_reject_cambia_estado_a_borrador(client, participant_id):
    enr = client.post("/enrollments/", json={
        "participant_id": participant_id,
        "course_id": "course-test-1",
        "fecha_inicio": "2025-03-01",
        "fecha_termino": "2025-03-28",
        "calificacion": 9.5,
    }).json()
    client.patch(f"/enrollments/{enr['id']}/submit")
    response = client.patch(f"/enrollments/{enr['id']}/reject")
    assert response.status_code == 200
    assert response.json()["estado"] == "borrador"


def test_emit_genera_certificado(client, participant_id):
    enr = client.post("/enrollments/", json={
        "participant_id": participant_id,
        "course_id": "course-test-1",
        "fecha_inicio": "2025-03-01",
        "fecha_termino": "2025-03-28",
        "calificacion": 9.5,
    }).json()
    client.patch(f"/enrollments/{enr['id']}/submit")
    response = client.patch(f"/enrollments/{enr['id']}/emit")
    assert response.status_code == 200
    data = response.json()
    assert data["no_certificado"].startswith("PAC-")
    assert data["folio_verificacion"].startswith("VER-")
    assert len(data["cert_hash"]) == 64
