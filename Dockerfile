# Pasitos-Certificates — imagen única para el demo completo
# Incluye backend (FastAPI + GPG real) y frontend (Vite) en un solo contenedor.
FROM python:3.13-slim

# --- Dependencias del sistema -------------------------------------------------
#  gnupg  -> binario `gpg` requerido por python-gnupg (firma/verificación real)
#  nodejs -> servidor de desarrollo Vite del frontend
#  curl/ca-certificates -> instalar Node desde NodeSource
RUN apt-get update \
    && apt-get install -y --no-install-recommends gnupg curl ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# --- Dependencias de Python (capa cacheable) ----------------------------------
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# --- Dependencias de Node (capa cacheable) ------------------------------------
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm install

# --- Código de la aplicación --------------------------------------------------
COPY backend ./backend
COPY frontend ./frontend
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh \
    && mkdir -p backend/storage/certificates

# --- Configuración de entorno -------------------------------------------------
# DATABASE_URL y GPG_KEY_FINGERPRINT los (re)genera demo_seed.py en el arranque.
# PUBLIC_VERIFY_URL alimenta el QR/enlace del PDF de certificado.
ENV PUBLIC_VERIFY_URL=http://localhost:5173 \
    GNUPGHOME=/root/.gnupg \
    PYTHONUNBUFFERED=1

# Backend FastAPI / Frontend Vite
EXPOSE 8000 5173

ENTRYPOINT ["./docker-entrypoint.sh"]
