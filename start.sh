#!/usr/bin/env bash
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
require_env="$PROJECT_DIR/.env"
[[ -f "$require_env" ]] || { echo "Missing required file: $require_env" >&2; exit 1; }
set -a
. "$require_env"
set +a
BACKEND_PORT="${BACKEND_PORT:?BACKEND_PORT is required}"
FRONTEND_PORT="${FRONTEND_PORT:?FRONTEND_PORT is required}"
CHILD_PIDS=()
require_file(){ [ -f "$1" ] || { echo "Missing required file: $1" >&2; exit 1; }; }
require_dir(){ [ -d "$1" ] || { echo "Missing dependencies: $1 (install explicitly before startup)" >&2; exit 1; }; }
port_free(){ if command -v lsof >/dev/null 2>&1 && lsof -ti ":$1" >/dev/null 2>&1; then echo "Port $1 is already in use; refusing to terminate another process." >&2; exit 1; fi; }
cleanup(){ for pid in "${CHILD_PIDS[@]:-}"; do [ -n "$pid" ] && kill "$pid" 2>/dev/null || true; done; }
trap cleanup INT TERM EXIT
require_file "$PROJECT_DIR/.env"
require_dir "$PROJECT_DIR/backend/node_modules"
[[ "$BACKEND_PORT" != "$FRONTEND_PORT" ]] || { echo "Backend and frontend ports must differ." >&2; exit 1; }
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${JWT_SECRET:?JWT_SECRET is required}"
: "${OPENROUTER_API_KEY:?OPENROUTER_API_KEY is required}"
: "${OPENROUTER_MODEL:?OPENROUTER_MODEL is required}"
[[ "${OPENROUTER_BASE_URL:-}" == "https://openrouter.ai/api/v1" ]] || { echo "OPENROUTER_BASE_URL must be https://openrouter.ai/api/v1." >&2; exit 1; }
[[ "${ALLOW_SCHEMA_MIGRATION:-}" == true ]] || { echo "ALLOW_SCHEMA_MIGRATION=true is required." >&2; exit 1; }
port_free "$BACKEND_PORT"
require_dir "$PROJECT_DIR/frontend/node_modules"
port_free "$FRONTEND_PORT"
(cd "$PROJECT_DIR/backend" && node scripts/prepare-runtime.js)
(cd "$PROJECT_DIR/backend" && BACKEND_PORT="$BACKEND_PORT" PORT="$BACKEND_PORT" npm start) & CHILD_PIDS+=("$!")
(cd "$PROJECT_DIR/frontend" && VITE_BACKEND_PORT="$BACKEND_PORT" npm run dev -- --host 127.0.0.1 --port "$FRONTEND_PORT" --strictPort) & CHILD_PIDS+=("$!")
echo "Governed commerce services started without installing, seeding, migrating, or reclaiming ports."
wait "${CHILD_PIDS[@]}"
