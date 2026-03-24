#!/bin/bash
# Quick restart script for the registry container with frontend rebuild
#
# Usage:
#   ./scripts/restart-registry.sh          # Fast: build frontend locally, hot-swap into container
#   ./scripts/restart-registry.sh --full   # Full: rebuild entire Docker image (slow, use if deps changed)
#   ./scripts/restart-registry.sh --no-build  # Just restart containers, no build

set -e

COMPOSE_FILE="docker-compose.podman.yml"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTAINER="mcp-gateway-registry_registry_1"

cd "$PROJECT_DIR"

if [ "$1" = "--full" ]; then
    echo "[1/4] Building frontend..."
    cd frontend && npm run build 2>&1 | tail -3
    cd "$PROJECT_DIR"

    echo "[2/4] Rebuilding registry container (--no-cache)..."
    podman stop "$CONTAINER" mcp-gateway-registry_auth-server_1 2>/dev/null || true
    podman rm "$CONTAINER" mcp-gateway-registry_auth-server_1 2>/dev/null || true
    podman-compose -f "$COMPOSE_FILE" build --no-cache registry 2>&1 | tail -3

    echo "[3/4] Starting registry + auth-server..."
    podman-compose -f "$COMPOSE_FILE" up -d registry auth-server 2>&1

    echo "[4/4] Waiting for registry to start..."
    sleep 12

elif [ "$1" = "--no-build" ]; then
    echo "[1/2] Restarting registry + auth-server..."
    podman stop "$CONTAINER" mcp-gateway-registry_auth-server_1 2>/dev/null || true
    podman rm "$CONTAINER" mcp-gateway-registry_auth-server_1 2>/dev/null || true
    podman-compose -f "$COMPOSE_FILE" up -d registry auth-server 2>&1

    echo "[2/2] Waiting for registry to start..."
    sleep 12

else
    # Default: fast hot-swap (build locally, copy into running container)
    echo "[1/3] Building frontend locally..."
    cd frontend && npm run build 2>&1 | tail -3
    cd "$PROJECT_DIR"

    echo "[2/3] Hot-swapping frontend into running container..."
    if ! podman ps --format "{{.Names}}" | grep -q "$CONTAINER"; then
        echo "  Container not running. Starting it first..."
        podman-compose -f "$COMPOSE_FILE" up -d registry auth-server 2>&1
        sleep 12
    fi

    # Remove old build and copy new one
    podman exec "$CONTAINER" rm -rf /app/frontend/build 2>/dev/null || true
    podman cp frontend/build/. "$CONTAINER":/app/frontend/build/

    echo "[3/3] Reloading nginx..."
    podman exec "$CONTAINER" nginx -s reload 2>/dev/null || true
    sleep 2
fi

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/registry/ 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
    echo "Registry is live at http://localhost:8080/registry/"
else
    echo "Registry returned HTTP $HTTP_CODE - may still be starting. Check: podman logs $CONTAINER"
fi
