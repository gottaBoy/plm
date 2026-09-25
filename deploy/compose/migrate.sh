#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_DIR="$SCRIPT_DIR/migrations"

MYSQL_CONTAINER="${AIBIZ_MYSQL_CONTAINER:-mysql}"
PLM_DATABASE="${AIBIZ_MYSQL_PLM_DATABASE:-plm}"
IBIZAPI_DATABASE="${AIBIZ_MYSQL_IBIZAPI_DATABASE:-ibizapi}"
PLATFORM_DATABASE="${AIBIZ_MYSQL_PLATFORM_DATABASE:-a_lab01_3f9ebc219}"
MYSQL_USER="${AIBIZ_MYSQL_USER:-plm}"
MYSQL_PASSWORD="${AIBIZ_MYSQL_PASSWORD:-plm@2024}"
MYSQL_ROOT_USER="${AIBIZ_MYSQL_ROOT_USER:-root}"
MYSQL_ROOT_PASSWORD="${AIBIZ_MYSQL_ROOT_PASSWORD:-Mysql@2022}"

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
  migration_name=$(basename "$migration")
  target_database=$(sed -n 's/^-- Target database: \([a-zA-Z0-9_]*\).*/\1/p' "$migration" | head -n 1)
  case "$target_database" in
    plm) database=$PLM_DATABASE ;;
    ibizapi) database=$IBIZAPI_DATABASE ;;
    a_lab01_3f9ebc219) database=$PLATFORM_DATABASE ;;
    *)
      printf 'migration %s has no supported target database header\n' "$migration_name" >&2
      exit 1
      ;;
  esac

  printf 'Applying %s to %s\n' "$migration_name" "$database"
  docker exec -i "$MYSQL_CONTAINER" \
    mysql --batch --default-character-set=utf8mb4 \
      --user="$MYSQL_ROOT_USER" --password="$MYSQL_ROOT_PASSWORD" "$database" \
      <"$migration"
done

printf 'PLM database migrations applied: %s\n' "$MIGRATION_DIR"
