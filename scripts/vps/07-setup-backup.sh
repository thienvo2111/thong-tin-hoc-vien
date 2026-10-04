#!/usr/bin/env bash
# Cai dat backup Postgres dinh ky: pg_dump theo BACKUP_CRON (mac dinh 4 lan/ngay),
# giu BACKUP_RETENTION_DAYS ngay tren VPS, day them ra ngoai VPS qua rclone
# (RCLONE_REMOTE - nen la remote "crypt" vi du lieu co CCCD/so dien thoai).
# Chay: bash 07-setup-backup.sh (khong sudo). Chay lai bat cu luc nao (idempotent).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./00-config.sh

if [ "$(id -u)" -eq 0 ]; then
  echo "Chay bang user thuong (${APP_USER}), khong dung sudo/root." >&2
  exit 1
fi

# --- Kiem tra remote TRUOC khi cai cron: cau hinh sai thi bao ngay, khong de cron
# chay am tham nhieu ngay roi moi phat hien khong co ban nao ra ngoai VPS.
if [ -n "${RCLONE_REMOTE}" ]; then
  if ! command -v rclone >/dev/null 2>&1; then
    echo "LOI: RCLONE_REMOTE=${RCLONE_REMOTE} nhung rclone chua cai." >&2
    echo "  Cai: sudo apt-get install -y rclone   roi lam theo README.md muc 'Sao luu ra ngoai VPS'." >&2
    exit 1
  fi
  TEN_REMOTE="${RCLONE_REMOTE%%:*}"
  if ! rclone listremotes | grep -qx "${TEN_REMOTE}:"; then
    echo "LOI: chua co remote '${TEN_REMOTE}:' trong rclone config (rclone listremotes)." >&2
    exit 1
  fi
  if ! rclone config show "${TEN_REMOTE}" | grep -q "type = crypt"; then
    echo "CANH BAO: remote '${TEN_REMOTE}' KHONG phai loai crypt - ban sao luu (co CCCD, SDT)"
    echo "          se nam dang ro tren dich vu luu tru. Nen tao remote crypt boc ngoai (xem README)."
  fi
  echo "==> Kiem tra ghi/doc remote ${RCLONE_REMOTE}"
  rclone mkdir "${RCLONE_REMOTE}"
  rclone lsf "${RCLONE_REMOTE}" >/dev/null
else
  echo "CANH BAO: RCLONE_REMOTE de trong - ban sao luu CHI nam tren VPS (mat VPS = mat het)."
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
# Dump chua CCCD/ngay sinh/SDT -> file chi chu so huu doc duoc (600).
umask 077

BACKUP_DIR="${BACKUP_DIR}"
DB_NAME="${DB_NAME}"
DB_USER="${DB_USER}"
DB_PASSWORD_FILE="/home/${APP_USER}/.hocvien_db_password"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS}"
RCLONE_REMOTE="${RCLONE_REMOTE}"
REMOTE_RETENTION_DAYS="${RCLONE_REMOTE_RETENTION_DAYS}"
ALERT_WEBHOOK_URL="${ALERT_WEBHOOK_URL}"
LOG="\${BACKUP_DIR}/backup.log"

ghi_log() { echo "\$(date '+%F %T') \$*" >> "\${LOG}"; }

# Loi o bat ky buoc nao -> ghi log + gui canh bao (neu co webhook) + thoat ma loi.
bao_loi() {
  ghi_log "LOI \$1"
  if [ -n "\${ALERT_WEBHOOK_URL}" ]; then
    curl -fsS -m 10 -d "[hocvien] Sao luu that bai tren \$(hostname): \$1" "\${ALERT_WEBHOOK_URL}" >/dev/null || true
  fi
  exit 1
}
trap 'bao_loi "lenh that bai o dong \${LINENO}"' ERR

TS="\$(date +%Y%m%d_%H%M%S)"
OUT="\${BACKUP_DIR}/\${DB_NAME}_\${TS}.sql.gz"
TAM="\${OUT}.dang-ghi"

# Ghi ra file tam, kiem tra gzip toan ven roi moi doi ten: file .sql.gz luon la ban day du.
export PGPASSWORD="\$(cat "\${DB_PASSWORD_FILE}")"
pg_dump -h 127.0.0.1 -U "\${DB_USER}" "\${DB_NAME}" | gzip -9 > "\${TAM}"
unset PGPASSWORD
gzip -t "\${TAM}" || bao_loi "file nen hong \${TAM}"
mv "\${TAM}" "\${OUT}"
ghi_log "OK \${OUT} (\$(du -h "\${OUT}" | cut -f1))"

find "\${BACKUP_DIR}" -name "*.sql.gz" -mtime "+\${RETENTION_DAYS}" -delete
find "\${BACKUP_DIR}" -name "*.dang-ghi" -mmin +120 -delete

if [ -n "\${RCLONE_REMOTE}" ]; then
  command -v rclone >/dev/null 2>&1 || bao_loi "rclone chua cai"
  rclone copy "\${OUT}" "\${RCLONE_REMOTE}" --quiet || bao_loi "day len \${RCLONE_REMOTE} that bai"
  ghi_log "OK da day len \${RCLONE_REMOTE}"
  # Xoay vong ban cu tren remote; loi o buoc nay khong nghiem trong (ban moi da len).
  rclone delete "\${RCLONE_REMOTE}" --min-age "\${REMOTE_RETENTION_DAYS}d" --include "*.sql.gz" --quiet \
    || ghi_log "CANH BAO khong xoa duoc ban cu tren remote"
fi
EOF
chmod 700 "${BACKUP_SCRIPT}"

echo "==> Test chay thu 1 lan"
"${BACKUP_SCRIPT}"
ls -lh "${BACKUP_DIR}" | tail -5
tail -3 "${BACKUP_DIR}/backup.log"
if [ -n "${RCLONE_REMOTE}" ]; then
  echo "==> 5 ban moi nhat tren remote:"
  rclone lsl "${RCLONE_REMOTE}" | sort -k2,3 | tail -5
fi

CRON_LINE="${BACKUP_CRON} ${BACKUP_SCRIPT} >> ${BACKUP_DIR}/cron.log 2>&1"
echo "==> Cai cron '${BACKUP_CRON}' (idempotent)"
# "|| true" sau grep: crontab rong hoac khong co dong nao khop lam grep -v
# exit code 1, va do set -e ap dung ca trong subshell, se lam subshell thoat
# NGAY truoc khi chay duoc "echo" dong cron moi - ket qua la crontab -
# nhan input rong va GHI DE crontab thanh rong (am tham, khong bao loi).
( crontab -l 2>/dev/null | grep -vF "${BACKUP_SCRIPT}" || true; echo "${CRON_LINE}" ) | crontab -
crontab -l | grep "${BACKUP_SCRIPT}"

echo "==> Xong buoc 07. Backup: ${BACKUP_DIR}, log: ${BACKUP_DIR}/backup.log"
echo "==> Phuc hoi tu VPS : gunzip -c <file>.sql.gz | psql -h 127.0.0.1 -U ${DB_USER} ${DB_NAME}"
if [ -n "${RCLONE_REMOTE}" ]; then
  echo "==> Phuc hoi tu remote: rclone copy ${RCLONE_REMOTE}/<file>.sql.gz /tmp/ roi lenh tren"
fi
