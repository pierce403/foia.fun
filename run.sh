#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

MODE="${1:-dev}"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required but not found in PATH."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi

if [ ! -f .env.local ] && [ -f .env.example ]; then
  cp .env.example .env.local
  echo "Created .env.local from .env.example"
fi

if [ -f .env.local ] && grep -q "vercel_blob_rw_xxx" .env.local; then
  echo "Warning: .env.local still has placeholder BLOB_READ_WRITE_TOKEN. Update it before using API routes."
fi

case "$MODE" in
  dev)
    exec npm run dev
    ;;
  build)
    exec npm run build
    ;;
  start)
    exec npm run start
    ;;
  lint)
    exec npm run lint
    ;;
  *)
    echo "Usage: ./run.sh [dev|build|start|lint]"
    exit 1
    ;;
esac
