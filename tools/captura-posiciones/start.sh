#!/usr/bin/env bash
# Lanza la captura en segundo plano (nohup) y guarda el PID.
set -euo pipefail
cd "$(dirname "$0")"
DIR="${CAPTURA_DIR:-$HOME/.cache/transportate/capturas}"
PID_FILE="$DIR/captura.pid"
mkdir -p "$DIR"

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "Ya está corriendo (PID $(cat "$PID_FILE"))."
  exit 0
fi
if [ ! -d node_modules/gtfs-realtime-bindings ]; then
  echo "Faltan dependencias: corré 'npm install --no-package-lock' en tools/captura-posiciones." >&2
  exit 1
fi

nohup node captura.mjs --dir="$DIR" >>"$DIR/captura.out" 2>&1 &
PID=$!
echo "$PID" >"$PID_FILE"

# En macOS evita que el equipo se duerma por inactividad mientras la captura vive
# (no evita la suspensión al cerrar la tapa).
if command -v caffeinate >/dev/null 2>&1; then
  nohup caffeinate -i -w "$PID" >/dev/null 2>&1 &
fi

echo "Captura iniciada (PID $PID). Salida en $DIR"
