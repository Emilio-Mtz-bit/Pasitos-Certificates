#!/usr/bin/env bash
# Arranque del demo: genera llave GPG + siembra BD, luego levanta backend y frontend.
set -e

cd /app/backend

# Genera el par de llaves GPG (si no existe), escribe .env y siembra cursos.
echo "==> Inicializando GPG + base de datos (demo_seed.py)"
python demo_seed.py

# Backend FastAPI en segundo plano
echo "==> Iniciando backend FastAPI en :8000"
uvicorn app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Si el backend muere, tumba el contenedor
trap 'kill -TERM "$BACKEND_PID" 2>/dev/null' EXIT

# Frontend Vite en primer plano (mantiene vivo el contenedor)
echo "==> Iniciando frontend Vite en :5173"
cd /app/frontend
exec npm run dev -- --host 0.0.0.0 --port 5173
