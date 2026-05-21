from app.services.hash_service import build_cert_string, calcular_hash


def test_build_cert_string_format():
    result = build_cert_string(
        "PAC-2025-0001", "VER-0001", "LOHM900115MJCRRL05",
        "María López Hernández", "Puericultura", "2025-03-28", 9.5
    )
    assert result == "PAC-2025-0001|VER-0001|LOHM900115MJCRRL05|MARÍA LÓPEZ HERNÁNDEZ|Puericultura|2025-03-28|9.5"


def test_curp_normalizado_a_mayusculas():
    r1 = build_cert_string("A", "B", "lohm900115mjcrrl05", "nombre", "curso", "2025-01-01", 9.0)
    r2 = build_cert_string("A", "B", "LOHM900115MJCRRL05", "nombre", "curso", "2025-01-01", 9.0)
    assert r1 == r2


def test_nombre_normalizado_a_mayusculas():
    r1 = build_cert_string("A", "B", "CURP", "maría lópez", "curso", "2025-01-01", 9.0)
    r2 = build_cert_string("A", "B", "CURP", "MARÍA LÓPEZ", "curso", "2025-01-01", 9.0)
    assert r1 == r2


def test_calificacion_un_decimal():
    r = build_cert_string("A", "B", "C", "D", "E", "2025-01-01", 9.0)
    assert r.endswith("|9.0")

    r2 = build_cert_string("A", "B", "C", "D", "E", "2025-01-01", 9.5)
    assert r2.endswith("|9.5")


def test_hash_es_determinista():
    h1 = calcular_hash("PAC-2025-0001", "VER-0001", "CURP18CHARS000000", "Nombre", "Curso", "2025-01-01", 9.5)
    h2 = calcular_hash("PAC-2025-0001", "VER-0001", "CURP18CHARS000000", "Nombre", "Curso", "2025-01-01", 9.5)
    assert h1 == h2
    assert len(h1) == 64


def test_hash_cambia_con_datos_distintos():
    h1 = calcular_hash("PAC-2025-0001", "VER-0001", "CURP18CHARS000000", "Nombre", "Curso", "2025-01-01", 9.5)
    h2 = calcular_hash("PAC-2025-0001", "VER-0001", "CURP18CHARS000000", "Nombre", "Curso", "2025-01-01", 8.0)
    assert h1 != h2
