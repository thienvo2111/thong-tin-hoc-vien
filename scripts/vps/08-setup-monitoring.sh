#!/usr/bin/env bash
# Healthcheck nhe: kiem tra Postgres/Nginx/PM2 moi 5 phut qua cron, tu restart
# service he thong bi down (postgresql/nginx), gui canh bao qua ALERT_WEBHOOK_URL
# neu co dat (ntfy.sh topic hoac Slack incoming webhook dang nhan POST JSON/text).
# Chay: sudo bash 08-setup-monitoring.sh
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./00-config.sh

if [ "$(id -u)" -ne 0 ]; then
  echo "Can chay bang sudo/root (de restart service he thong khi down): sudo bash 08-setup-monitoring.sh" >&2
  exit 1
fi

HEALTHCHECK_SCRIPT="/usr/local/bin/hocvien-healthcheck.sh"
LOG_FILE="/var/log/hocvien-healthcheck.log"

echo "==> Ghi script healthcheck ${HEALTHCHECK_SCRIPT}"
cat > "${HEALTHCHECK_SCRIPT}" <<EOF
#!/usr/bin/env bash
# Tu dong sinh boi 08-setup-monitoring.sh - dung sua tay, sua roi chay lai script goc.
set -uo pipefail

LOG_FILE="${LOG_FILE}"
ALERT_WEBHOOK_URL="${ALERT_WEBHOOK_URL}"
APP_USER="${APP_USER}"
PM2_APP_NAME="${PM2_APP_NAME}"
DOMAIN="${DOMAIN}"

log() { echo "\$(date '+%F %T') \$1" >> "\${LOG_FILE}"; }

alert() {
  log "CANH BAO: \$1"
  if [ -n "\${ALERT_WEBHOOK_URL}" ]; then
    curl -fsS -m 10 -X POST -H "Title: Boi duong NLS VPS (\${DOMAIN})" \
      -d "\$1" "\${ALERT_WEBHOOK_URL}" >/dev/null 2>&1 || \
      log "LOI gui alert webhook"
  fi
}

# --- PostgreSQL ---
if ! systemctl is-active --quiet postgresql; then
  alert "postgresql dang DOWN, dang thu restart"
  systemctl restart postgresql && log "postgresql da restart OK" || alert "restart postgresql THAT BAI"
fi

# --- Nginx ---
if ! systemctl is-active --quiet nginx; then
  alert "nginx dang DOWN, dang thu restart"
  systemctl restart nginx && log "nginx da restart OK" || alert "restart nginx THAT BAI"
fi

# --- PM2 backend (chay duoi user thuong, khong phai systemd) ---
PM2_STATUS="\$(sudo -u "\${APP_USER}" pm2 jlist 2>/dev/null | grep -o "\"name\":\"\${PM2_APP_NAME}\"[^}]*\"status\":\"[a-z]*\"" | grep -o '"status":"[a-z]*"' | cut -d'"' -f4)"
if [ "\${PM2_STATUS}" != "online" ]; then
  alert "PM2 app \${PM2_APP_NAME} khong online (trang thai: \${PM2_STATUS:-khong_ro}), dang thu restart"
  sudo -u "\${APP_USER}" pm2 restart "\${PM2_APP_NAME}" && log "PM2 \${PM2_APP_NAME} da restart OK" || \
    alert "restart PM2 \${PM2_APP_NAME} THAT BAI"
fi

# --- Disk (canh bao khi > 85%) ---
DISK_PCT="\$(df / --output=pcent | tail -1 | tr -dc '0-9')"
if [ "\${DISK_PCT:-0}" -ge 85 ]; then
  alert "Disk / da dung \${DISK_PCT}%, can don dep"
fi
EOF
chmod +x "${HEALTHCHECK_SCRIPT}"
touch "${LOG_FILE}"
chmod 644 "${LOG_FILE}"

echo "==> Them cron moi 5 phut (root crontab, idempotent)"
# "|| true" sau grep: xem giai thich chi tiet trong 07-setup-backup.sh (grep
# tren crontab rong tra ve exit 1, cong voi set -e trong subshell se lam
# echo dong cron moi khong bao gio chay, crontab bi ghi de thanh rong).
( crontab -l 2>/dev/null | grep -vF "${HEALTHCHECK_SCRIPT}" || true; \
  echo "*/5 * * * * ${HEALTHCHECK_SCRIPT}" ) | crontab -
crontab -l | grep "${HEALTHCHECK_SCRIPT}"

echo "==> Test chay thu 1 lan"
"${HEALTHCHECK_SCRIPT}"
tail -5 "${LOG_FILE}" || true

if [ -z "${ALERT_WEBHOOK_URL}" ]; then
  echo
  echo "LUU Y: ALERT_WEBHOOK_URL dang trong - chi ghi log ${LOG_FILE}, khong gui thong bao ra ngoai."
  echo "Cach nhanh nhat: dang ky topic mien phi tai https://ntfy.sh (vd. ntfy.sh/hocvien-<ten-rieng>),"
  echo "cai app ntfy tren dien thoai subscribe topic do, roi dat trong 00-config.sh:"
  echo '  export ALERT_WEBHOOK_URL="https://ntfy.sh/hocvien-<ten-rieng>"'
  echo "va chay lai buoc 08."
fi

echo "==> Xong buoc 08. Log: ${LOG_FILE}"
