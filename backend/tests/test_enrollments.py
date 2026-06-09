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


@pytest.fixture
def second_course(db):
    from app import models
    course = models.Course(
        id="course-test-2", codigo="C-002", nombre="Nutricion",
        tipo=models.TipoCurso.capacitacion_tecnica,
        modalidad=models.ModalidadCurso.presencial,
        duracion_horas=40, calificacion_min=7.0,
    )
    db.add(course)
    db.commit()
    return "course-test-2"


def test_filtrar_por_course_id(client, participant_id, second_course):
    # Inscripción en curso 1
    client.post("/enrollments/", json={
        "participant_id": participant_id,
        "course_id": "course-test-1",
        "fecha_inicio": "2025-03-01",
        "fecha_termino": "2025-03-28",
        "calificacion": 9.0,
    })
    # Inscripción en curso 2
    client.post("/enrollments/", json={
        "participant_id": participant_id,
        "course_id": second_course,
        "fecha_inicio": "2025-04-01",
        "fecha_termino": "2025-04-30",
        "calificacion": 8.0,
    })
    response = client.get("/enrollments/?course_id=course-test-1")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["course_id"] == "course-test-1"


def test_enrollment_out_incluye_observaciones(client, participant_id):
    enr = client.post("/enrollments/", json={
        "participant_id": participant_id,
        "course_id": "course-test-1",
        "fecha_inicio": "2025-03-01",
        "fecha_termino": "2025-03-28",
        "calificacion": 9.5,
    }).json()
    assert "observaciones" in enr
