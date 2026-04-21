#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="/opt/opencoco"
RELEASE_DIR="$APP_ROOT/releases/$(date +%Y%m%d%H%M%S)"
REPO_DIR="$APP_ROOT/repo"

mkdir -p "$APP_ROOT/releases"

if [ ! -d "$REPO_DIR/.git" ]; then
  echo "Repository clone missing at $REPO_DIR"
  exit 1
fi

cd "$REPO_DIR"
git fetch origin main
git checkout main
git pull --ff-only origin main

mkdir -p "$RELEASE_DIR"
git archive main | tar -x -C "$RELEASE_DIR"

cd "$RELEASE_DIR"
npm ci
npm run build

ln -sfn "$RELEASE_DIR" "$APP_ROOT/current"
pm2 startOrReload "$APP_ROOT/current/ecosystem.config.cjs"
bash "$APP_ROOT/current/scripts/healthcheck.sh"
