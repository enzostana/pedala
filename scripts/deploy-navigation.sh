#!/usr/bin/env bash
# Deploy the application and private navigation services using the selected data snapshot.
set -euo pipefail
cd "$(dirname "$0")/.."
state=/home/cinadmin/pedala-geodata/active.env
if [[ -f "$state" ]]; then set -a; source "$state"; set +a; fi
docker stack deploy --resolve-image never -c deploy/stack.yml -c deploy/navigation.yml pedala
