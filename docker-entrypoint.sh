#!/bin/sh
set -eu

# Render's persistent disk is mounted at /var/data. Seed the public site once;
# this keeps demo assets available while uploaded images survive redeploys.
if [ ! -f "$WEB_ROOT/.travel-seeded" ]; then
  mkdir -p "$WEB_ROOT" "$DB_DIR"
  cp -R /opt/travel/frontend/. "$WEB_ROOT/"
  touch "$WEB_ROOT/.travel-seeded"
fi

exec java -Dserver.port="${PORT:-8080}" -jar /app/backend/app.jar
