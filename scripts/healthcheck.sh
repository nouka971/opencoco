#!/usr/bin/env bash
set -euo pipefail

STATUS_FILE="${OPENCOCO_HEARTBEAT_FILE:-/opt/opencoco/current/runtime/bot-status.json}"

if [ ! -f "$STATUS_FILE" ]; then
  echo "Missing bot status file: $STATUS_FILE"
  exit 1
fi

if ! grep -q '"name": "opencoco"' "$STATUS_FILE"; then
  echo "Healthcheck failed: invalid status payload"
  exit 1
fi

echo "Healthcheck passed"
