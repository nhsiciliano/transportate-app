#!/usr/bin/env bash
# Detiene la captura (SIGTERM) y limpia el PID.
set -euo pipefail
DIR="${CAPTURA_DIR:-$HOME/.cache/transportate/capturas}"
PID_FILE="$DIR/captura.pid"

if [ ! -f "$PID_FILE" ]; then
  echo "No hay PID guardado: la captura no está corriendo."
  exit 0
fi
PID="$(cat "$PID_FILE")"
if kill -0 "$PID" 2>/dev/null; then
  kill "$PID"
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    kill -0 "$PID" 2>/dev/null || break
    sleep 0.5
  done
  echo "Captura detenida (PID $PID)."
else
  echo "El PID $PID ya no existe."
fi
rm -f "$PID_FILE"
