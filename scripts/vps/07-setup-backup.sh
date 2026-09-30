#!/usr/bin/env bash
# Cai dat backup Postgres dinh ky: pg_dump hang ngay (cron 02:00), giu
# BACKUP_RETENTION_DAYS ngay gan nhat, tuy chon dong bo them ra remote qua rclone.
# Chay: bash 07-setup-backup.sh (khong sudo)
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./00-config.sh

if [ "$(id -u)" -eq 0 ]; then
  echo "Chay bang user thuong (${APP_USER}), khong dung sudo/root." >&2
  exit 1
fi

mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"

BACKUP_SCRIPT="/home/${APP_USER}/bin/backup-postgres.sh"
mkdir -p "$(dirname "${BACKUP_SCRIPT}")"

echo "==> Ghi script backup ${BACKUP_SCRIPT}"
cat > "${BACKUP_SCRIPT}" <<EOF
#!/usr/bin/env bash
# Tu dong sinh boi 07-setup-backup.sh - dung sua tay, sua roi chay lai script goc.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR}"
DB_NAME="${DB_NAME}"
DB_USER="${DB_USER}"
DB_PASSWORD_FILE="/home/${APP_USER}/.hocvien_db_password"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS}"
RCLONE_REMOTE="${RCLONE_REMOTE}"

TS="\$(date +%Y%m%d_%H%M%S)"
OUT="\${BACKUP_DIR}/\${DB_NAME}_\${TS}.sql.gz"

export PGPASSWORD="\$(cat "\${DB_PASSWORD_FILE}")"
pg_dump -h 127.0.0.1 -U "\${DB_USER}" "\${DB_NAME}" | gzip -9 > "\${OUT}"
unset PGPASSWORD

echo "\$(date '+%F %T') OK \${OUT} (\$(du -h "\${OUT}" | cut -f1))" >> "\${BACKUP_DIR}/backup.log"

# Xoa backup cu hon RETENTION_DAYS ngay
find "\${BACKUP_DIR}" -name "*.sql.gz" -mtime "+\${RETENTION_DAYS}" -delete

if [ -n "\${RCLONE_REMOTE}" ] && command -v rclone >/dev/null 2>&1; then
  rclone copy "\${OUT}" "\${RCLONE_REMOTE}" --quiet || \
    echo "\$(date '+%F %T') LOI rclone sync \${OUT}" >> "\${BACKUP_DIR}/backup.log"
fi
EOF
chmod +x "${BACKUP_SCRIPT}"

echo "==> Test chay thu 1 lan"
"${BACKUP_SCRIPT}"
ls -lh "${BACKUP_DIR}"

CRON_LINE="0 2 * * * ${BACKUP_SCRIPT} >> ${BACKUP_DIR}/cron.log 2>&1"
echo "==> Them cron 02:00 hang ngay (idempotent)"
# "|| true" sau grep: crontab rong hoac khong co dong nao khop lam grep -v
# exit code 1, va do set -e ap dung ca trong subshell, se lam subshell thoat
# NGAY truoc khi chay duoc "echo" dong cron moi - ket qua la crontab -
# nhan input rong va GHI DE crontab thanh rong (am tham, khong bao loi).
( crontab -l 2>/dev/null | grep -vF "${BACKUP_SCRIPT}" || true; echo "${CRON_LINE}" ) | crontab -
crontab -l | grep "${BACKUP_SCRIPT}"

if [ -n "${RCLONE_REMOTE}" ] && ! command -v rclone >/dev/null 2>&1; then
  echo
  echo "LUU Y: RCLONE_REMOTE da dat nhung rclone chua cai. Cai bang:"
  echo "  sudo apt-get install -y rclone && rclone config"
fi

echo "==> Xong buoc 07. Backup: ${BACKUP_DIR}, log: ${BACKUP_DIR}/backup.log"
echo "==> Phuc hoi khi can: gunzip -c <file>.sql.gz | psql -h 127.0.0.1 -U ${DB_USER} ${DB_NAME}"
