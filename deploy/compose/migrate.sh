#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_DIR="$SCRIPT_DIR/migrations"

MYSQL_CONTAINER="${AIBIZ_MYSQL_CONTAINER:-mysql}"
MYSQL_DATABASE="${AIBIZ_MYSQL_DATABASE:-plm}"
MYSQL_USER="${AIBIZ_MYSQL_USER:-plm}"
MYSQL_PASSWORD="${AIBIZ_MYSQL_PASSWORD:-plm@2024}"

if [ ! -d "$MIGRATION_DIR" ]; then
  printf 'migration directory not found: %s\n' "$MIGRATION_DIR" >&2
  exit 1
fi

if ! docker inspect "$MYSQL_CONTAINER" >/dev/null 2>&1; then
  printf 'mysql container not found: %s\n' "$MYSQL_CONTAINER" >&2
  exit 1
fi

shopt -s nullglob
migrations=("$MIGRATION_DIR"/*.sql)
shopt -u nullglob

if [ "${#migrations[@]}" -eq 0 ]; then
  printf 'no migration files found in: %s\n' "$MIGRATION_DIR" >&2
  exit 1
fi

for migration in "${migrations[@]}"; do
  printf 'Applying %s\n' "$(basename "$migration")"
  docker exec -i "$MYSQL_CONTAINER" \
    mysql --batch --default-character-set=utf8mb4 \
    --user="$MYSQL_USER" --password="$MYSQL_PASSWORD" "$MYSQL_DATABASE" \
    <"$migration"
done

printf 'PLM database migrations applied: %s\n' "$MIGRATION_DIR"
