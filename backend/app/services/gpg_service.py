import os
import tempfile
import gnupg


def get_gpg() -> gnupg.GPG:
    try:
        g = gnupg.GPG()
        g.list_keys()
        return g
    except Exception:
        pass

    for gpg_path in [
        r"C:\Program Files\GnuPG\bin\gpg.exe",
        r"C:\Program Files (x86)\GnuPG\bin\gpg.exe",
    ]:
        if os.path.exists(gpg_path):
            return gnupg.GPG(gpgbinary=gpg_path)

    raise RuntimeError(
        "GPG no encontrado. Instala Gpg4win desde https://www.gpg4win.org/"
    )


def firmar_hash(cert_hash: str, fingerprint: str) -> str:
    gpg = get_gpg()
    signed = gpg.sign(cert_hash, keyid=fingerprint, detach=True)
    if not signed:
        raise RuntimeError(f"La firma GPG falló. ¿El fingerprint '{fingerprint}' está en el keyring?")
    return str(signed)


def verificar_firma(cert_hash: str, firma_armored: str) -> bool:
    gpg = get_gpg()
    with tempfile.NamedTemporaryFile(mode="w", suffix=".asc", delete=False) as f:
        f.write(firma_armored)
        sig_path = f.name
    try:
        verified = gpg.verify_data(sig_path, cert_hash.encode("utf-8"))
        return bool(verified.valid)
    finally:
        os.unlink(sig_path)
