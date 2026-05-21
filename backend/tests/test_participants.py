def test_crear_participante(client):
    response = client.post("/participants/", json={
        "nombre_completo": "María López Hernández",
        "curp": "LOHM900115MJCRRL05",
    })
    assert response.status_code == 200
    data = response.json()
    assert data["curp"] == "LOHM900115MJCRRL05"
    assert data["nombre_completo"] == "María López Hernández"
    assert "id" in data


def test_buscar_por_curp(client):
    client.post("/participants/", json={"nombre_completo": "María López", "curp": "LOHM900115MJCRRL05"})
    response = client.get("/participants/?q=LOHM900115MJCRRL05")
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_buscar_por_nombre(client):
    client.post("/participants/", json={"nombre_completo": "María López", "curp": "LOHM900115MJCRRL05"})
    response = client.get("/participants/?q=María")
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_curp_duplicada_retorna_400(client):
    client.post("/participants/", json={"nombre_completo": "María López", "curp": "LOHM900115MJCRRL05"})
    response = client.post("/participants/", json={"nombre_completo": "Otra Persona", "curp": "LOHM900115MJCRRL05"})
    assert response.status_code == 400


def test_buscar_sin_resultados(client):
    response = client.get("/participants/?q=XXXXXX")
    assert response.status_code == 200
    assert response.json() == []
