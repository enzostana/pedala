#!/usr/bin/env bash
# Build a fresh OpenStreetMap snapshot without changing the active services.
set -euo pipefail
snapshot_id=${1:-}
if [[ ! "$snapshot_id" =~ ^[a-z0-9][a-z0-9_-]{0,39}$ ]]; then
  printf 'Uso: %s identificador-minusculo\n' "$0" >&2
  exit 2
fi
data_root=/home/cinadmin/pedala-geodata
snapshot="$data_root/snapshots/$snapshot_id"
volume="pedala_geocoder_$snapshot_id"
nominatim="pedala-geocoder-build-$snapshot_id"
valhalla="pedala-router-build-$snapshot_id"
if [[ -e "$snapshot" ]] || docker volume inspect "$volume" >/dev/null 2>&1; then
  printf 'Snapshot ou volume já existe; escolha outro identificador.\n' >&2
  exit 2
fi
mkdir -p "$snapshot/source" "$snapshot/valhalla"
cleanup() { docker rm -f "$nominatim" "$valhalla" >/dev/null 2>&1 || true; }
trap cleanup EXIT
curl -fsSL --retry 3 -o "$snapshot/source/rio-de-janeiro.osm.pbf" 'https://download.openstreetmap.fr/extracts/south-america/brazil/southeast/rio-de-janeiro-latest.osm.pbf'
sha256sum "$snapshot/source/rio-de-janeiro.osm.pbf" > "$snapshot/source/SHA256SUMS"
date -u '+%Y-%m-%dT%H:%M:%SZ' > "$snapshot/source/downloaded-at.txt"
docker volume create "$volume" >/dev/null
start_geocoder() {
 docker run -d --name "$nominatim" --memory 6g --cpus 2 --shm-size 1g -e PBF_PATH=/data/rio-de-janeiro.osm.pbf -e THREADS=2 -e GUNICORN_WORKERS=2 -e IMPORT_WIKIPEDIA=false -e WARMUP_ON_STARTUP=false -e UPDATE_MODE=none -e POSTGRES_SHARED_BUFFERS=512MB -e POSTGRES_MAINTENANCE_WORK_MEM=512MB -v "$snapshot/source:/data:ro" -v "$volume:/var/lib/postgresql/16/main" -p 127.0.0.1::8080 'mediagis/nominatim@sha256:168c30e20fbba0c2e8199fca7a8aa2640e8cc1a62f8b05b1958897796fdb38f1' >/dev/null
}
wait_service() {
 local container=$1 port=$2 endpoint=$3 timeout=$4 host_port
 host_port=$(docker port "$container" "$port/tcp" | sed -n '1s/.*://p')
 for ((attempt=0; attempt<timeout; attempt++)); do
  if curl -fsS --max-time 5 "http://127.0.0.1:$host_port$endpoint" >/dev/null 2>&1; then printf '%s' "$host_port"; return; fi
  if [[ $(docker inspect -f '{{.State.Running}}' "$container") != true ]]; then printf 'Serviço %s parou durante preparação.\n' "$container" >&2; return 1; fi
  sleep 5
 done
 printf 'Tempo esgotado aguardando %s.\n' "$container" >&2; return 1
}
start_geocoder
geocoder_port=$(wait_service "$nominatim" 8080 '/status?format=json' 720)
curl -fsSG --data-urlencode 'q=Rua Ibituruna, Rio de Janeiro, Brasil' --data-urlencode 'format=jsonv2' "http://127.0.0.1:$geocoder_port/search" | python3 -c 'import json,sys; assert json.load(sys.stdin), "Busca sem resultados"'
docker rm -f "$nominatim" >/dev/null
cp "$snapshot/source/rio-de-janeiro.osm.pbf" "$snapshot/valhalla/rio-de-janeiro.osm.pbf"
docker run -d --name "$valhalla" --memory 6g --cpus 2 -e server_threads=2 -e build_time_zones=False -e build_elevation=False -e build_transit=False -e use_default_speeds_config=False -v "$snapshot/valhalla:/custom_files" -p 127.0.0.1::8002 'ghcr.io/valhalla/valhalla-scripted@sha256:3eaac5d4d4e8883690c119cfd22bac31abcde3fd834d3ef10e017501a597dfaf' >/dev/null
router_port=$(wait_service "$valhalla" 8002 '/status' 720)
curl -fsS --max-time 30 -H 'Content-Type: application/json' --data '{"locations":[{"lat":-22.9118129,"lon":-43.2213347},{"lat":-22.949,"lon":-43.18}],"costing":"bicycle","language":"pt-BR","units":"kilometers"}' "http://127.0.0.1:$router_port/route" | python3 -c 'import json,sys; x=json.load(sys.stdin); assert x["trip"]["legs"] and x["trip"]["summary"]["length"]>0, "Rota inválida"'
cat > "$snapshot/activate.env" <<ENV
PEDALA_GEO_DATA=$volume
PEDALA_OSM_DIR=$snapshot/source
PEDALA_VALHALLA_DIR=$snapshot/valhalla
ENV
printf 'Snapshot validado em %s; ainda não foi ativado.\n' "$snapshot"
