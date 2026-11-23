#!/usr/bin/env bash
set -euo pipefail

base=$(cd -- "$(dirname -- "$0")" && pwd)
case "${1:-}" in
  --github)
    revision=${SSH_ORIGINAL_COMMAND:-}
    source_ref=refs/heads/main
    ;;
  --initial)
    revision=${2:-}
    source_ref=${3:-}
    [[ $source_ref == refs/heads/* ]] && git check-ref-format "$source_ref" || exit 2
    ;;
  *)
    echo 'Usage: deploy-vps.sh --initial <commit> <refs/heads/branch>' >&2
    exit 2
    ;;
esac
[[ $revision =~ ^[0-9a-f]{40}$ ]] || { echo 'Expected a full commit SHA.' >&2; exit 2; }

exec 9>"$base/deploy.lock"
flock 9
git --git-dir="$base/source.git" fetch --no-tags origin "$source_ref"
head=$(git --git-dir="$base/source.git" rev-parse FETCH_HEAD)
if [[ $head != "$revision" ]]; then
  if [[ $1 == --github ]]; then
    echo "Skipping $revision because $source_ref now points to $head."
    exit 0
  fi
  echo "Expected $source_ref to point to $revision, found $head." >&2
  exit 1
fi

export WEB_PORT=38600
# Host address the web port binds to; override in deploy.env for the shared ingress.
export WEB_BIND=127.0.0.1
if [[ -f $base/deploy.env ]]; then
  # shellcheck source=/dev/null
  source "$base/deploy.env"
fi
export SOURCE_DIR
SOURCE_DIR=$(mktemp -d "$base/source.XXXXXXXX")
trap 'rm -rf -- "$SOURCE_DIR"' EXIT
git --git-dir="$base/source.git" archive "$revision" | tar -x -C "$SOURCE_DIR"

export RELEASE_SHA=$revision
compose=(docker compose --project-directory "$base" -f "$base/compose.vps.yml")
current=$(cat "$base/current" 2>/dev/null || true)
previous=$(cat "$base/previous" 2>/dev/null || true)

smoke_test() {
  curl -fsS --max-time 15 "http://$WEB_BIND:$WEB_PORT/restaurants" >/dev/null &&
    curl -fsS --max-time 15 "http://$WEB_BIND:$WEB_PORT/api/model" | python3 -c \
      'import json, sys; assert json.load(sys.stdin)["model_status"] == "live"'
}

if [[ $current == "$revision" ]] && smoke_test; then
  echo "$revision is already serving live predictions."
  exit 0
fi

test -s "$base/model/model.joblib"
test -s "$base/model/metrics.json"

# Build separately so the shared VPS only runs one image build at a time.
"${compose[@]}" build api
"${compose[@]}" build web
"${compose[@]}" run --rm --no-deps api python -c \
  'from app.main import app; assert app.state.predictor.status == "live", app.state.predictor.detail'

if "${compose[@]}" up -d --no-build --wait --wait-timeout 120 && smoke_test; then
  if [[ $current != "$revision" ]]; then
    printf '%s\n' "$current" >"$base/previous.tmp"
    mv -- "$base/previous.tmp" "$base/previous"
    printf '%s\n' "$revision" >"$base/current.tmp"
    mv -- "$base/current.tmp" "$base/current"

    if [[ $previous =~ ^[0-9a-f]{40}$ && $previous != "$current" && $previous != "$revision" ]]; then
      docker image rm "smart-food-delivery-api:$previous" "smart-food-delivery-web:$previous" || true
    fi
  fi
  echo "Deployed $revision with the trained model."
  exit 0
fi

"${compose[@]}" logs --tail 35
if [[ $current =~ ^[0-9a-f]{40}$ ]]; then
  echo "Restoring $current." >&2
  export RELEASE_SHA=$current
  "${compose[@]}" up -d --no-build --wait --wait-timeout 120
else
  "${compose[@]}" down
fi
exit 1
