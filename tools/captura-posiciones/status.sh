#!/usr/bin/env bash
# Estado de la captura: PID vivo, snapshots por día (según el log) y tamaño de los archivos.
set -uo pipefail
DIR="${CAPTURA_DIR:-$HOME/.cache/transportate/capturas}"
PID_FILE="$DIR/captura.pid"
LOG="$DIR/captura.log"

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  PID="$(cat "$PID_FILE")"
  echo "PID:      $PID (vivo, hace $(ps -o etime= -p "$PID" | tr -d ' '))"
else
  echo "PID:      NO está corriendo"
fi
echo "Carpeta:  $DIR"

if [ -f "$LOG" ]; then
  echo
  echo "Snapshots por día (según captura.log, fecha UTC del log):"
  printf '  %-12s %10s %10s %8s %8s\n' día posiciones-ok posic-fail viajes-ok viajes-fail
  for d in $(cut -c1-10 "$LOG" | grep -E '^[0-9]{4}-' | sort -u); do
    vok=$(grep -c "^$d.* vehiclePositions ok" "$LOG")
    vfail=$(grep -c "^$d.* vehiclePositions fail" "$LOG")
    tok=$(grep -c "^$d.* tripUpdates ok" "$LOG")
    tfail=$(grep -c "^$d.* tripUpdates fail" "$LOG")
    printf '  %-12s %10s %10s %8s %8s\n' "$d" "$vok" "$vfail" "$tok" "$tfail"
  done
  echo
  echo "Último snapshot de cada feed:"
  grep ' vehiclePositions ok' "$LOG" | tail -1 | sed 's/^/  /'
  grep ' tripUpdates ok' "$LOG" | tail -1 | sed 's/^/  /'
fi

echo
echo "Archivos:"
ls -lh "$DIR"/*.csv.gz 2>/dev/null | awk '{print "  " $5 "\t" $9}' | sed "s#$DIR/##"
du -sh "$DIR" 2>/dev/null | awk '{print "  total: " $1}'
