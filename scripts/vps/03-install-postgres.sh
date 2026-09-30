#!/usr/bin/env bash
# Cai PostgreSQL 16 (goi Ubuntu 22.04 co san la PG14, nen dung repo PGDG de len PG16
# khop dung ban docker-compose.yml goc), tao DB + user rieng cho app, bat extension can thiet.
# Chay: sudo bash 03-install-postgres.sh
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./00-config.sh

if [ "$(id -u)" -ne 0 ]; then
  echo "Can chay bang sudo/root: sudo bash 03-install-postgres.sh" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "==> Them repo PGDG (PostgreSQL 16)"
  install -d /usr/share/postgresql-common/pgdg
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
  echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] \
http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list
  apt-get update -y
  apt-get install -y postgresql-16 postgresql-contrib-16
else
  echo "==> psql da co: $(psql --version), bo qua cai dat"
fi

systemctl enable --now postgresql

echo "==> Tao database + user rieng cho app (idempotent)"
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';
  ELSE
    ALTER ROLE ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';
  END IF;
END
\$\$;

SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec
SQL

echo "==> Bat extension pgcrypto + pg_trgm (yeu cau boi migration init)"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" <<SQL
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
SQL

echo "==> DATABASE_URL de dan vao backend/.env:"
echo "postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}?schema=public"
echo "(mat khau cung duoc luu tai /home/${APP_USER}/.hocvien_db_password)"

echo "==> Xong buoc 03"
