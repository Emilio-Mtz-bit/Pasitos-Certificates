import pytest
import gnupg
from app.services.gpg_service import get_gpg, firmar_hash, verificar_firma


@pytest.fixture(scope="module")
def test_fingerprint():
    gpg = get_gpg()
    existing = [k for k in gpg.list_keys(True)
                if any("testpasitos@demo.com" in uid for uid in k.get("uids", []))]
    if existing:
        yield existing[0]["fingerprint"]
        return
    input_data = gpg.gen_key_input(
        key_type="RSA", key_length=1024,
        name_real="Test Pasitos GPG", name_email="testpasitos@demo.com",
        expire_date=0, no_protection=True,
    )
    key = gpg.gen_key(input_data)
    fingerprint = key.fingerprint
    yield fingerprint
    # GnuPG >= 2.1 requires expect_passphrase=False for unprotected keys
    gpg.delete_keys(fingerprint, secret=True, expect_passphrase=False)
    gpg.delete_keys(fingerprint)


def test_firmar_produce_firma_pgp(test_fingerprint):
    firma = firmar_hash("a" * 64, test_fingerprint)
    assert "BEGIN PGP SIGNATURE" in firma


def test_verificar_firma_valida(test_fingerprint):
    test_hash = "b" * 64
    firma = firmar_hash(test_hash, test_fingerprint)
    assert verificar_firma(test_hash, firma) is True


def test_verificar_falla_con_hash_distinto(test_fingerprint):
    firma = firmar_hash("a" * 64, test_fingerprint)
    assert verificar_firma("b" * 64, firma) is False
