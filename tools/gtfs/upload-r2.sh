#!/usr/bin/env bash
# Sube tools/gtfs/out/* al bucket R2 del proxy (binding STATIC → transportate-static).
#
#   transportate-static/<version>/<archivo>     inmutable (Cache-Control 1 año)
#   transportate-static/<version>/manifest.json
#   transportate-static/latest/manifest.json    puntero a la última versión (Cache-Control 5 min)
#
# Requisitos: `npm run build` hecho y sesión de Cloudflare (`npx wrangler@4.156.1 login`, o
# CLOUDFLARE_API_TOKEN con permiso "R2 Edit"). No corre solo: se ejecuta a mano.
#
# Uso:  ./upload-r2.sh                  sube a transportate-static
#       BUCKET=transportate-static-preview ./upload-r2.sh
#       DRY_RUN=1 ./upload-r2.sh        muestra los comandos sin ejecutarlos
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$HERE/out"
BUCKET="${BUCKET:-transportate-static}"
WRANGLER="${WRANGLER:-npx --yes wrangler@4.156.1}"

if [[ ! -f "$OUT/manifest.json" ]]; then
  echo "Falta $OUT/manifest.json: corré 'npm run build' primero." >&2
  exit 1
fi

VERSION="$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).version)' "$OUT/manifest.json")"
FILES="$(node -e 'process.stdout.write(Object.keys(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).archivos).join("\n"))' "$OUT/manifest.json")"

put() { # put <archivo local> <key> <content-type> <cache-control>
  local cmd=($WRANGLER r2 object put "$BUCKET/$2" --remote --file "$1" --content-type "$3" --cache-control "$4")
  if [[ -n "${DRY_RUN:-}" ]]; then echo "${cmd[*]}"; else "${cmd[@]}"; fi
}

content_type() {
  case "$1" in
    *.geojson) echo "application/geo+json; charset=utf-8" ;;
    *) echo "application/json; charset=utf-8" ;;
  esac
}

IMMUTABLE="public, max-age=31536000, immutable"
echo "Subiendo versión $VERSION a r2://$BUCKET"
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  put "$OUT/$f" "$VERSION/$f" "$(content_type "$f")" "$IMMUTABLE"
done <<< "$FILES"
put "$OUT/manifest.json" "$VERSION/manifest.json" "application/json; charset=utf-8" "$IMMUTABLE"
# El puntero va al final: si algo falla antes, latest sigue apuntando a una versión completa.
put "$OUT/manifest.json" "latest/manifest.json" "application/json; charset=utf-8" "public, max-age=300"
echo "Listo: latest → $VERSION"
