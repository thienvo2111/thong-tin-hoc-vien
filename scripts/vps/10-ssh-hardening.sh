#!/usr/bin/env bash
# Sieu quan trong - CO THE KHOA BAN KHOI VPS NEU LAM SAI. Doc ky truoc khi chay.
#
# Lam 3 viec:
#   1. Tat dang nhap SSH bang mat khau (chi cho phep SSH key)  -> luon lam
#   2. Tat dang nhap SSH truc tiep bang root                    -> luon lam
#   3. (Tuy chon, mac dinh TAT) Doi port SSH sang SSH_PORT neu ban tu dat
#      khac 22 trong 00-config.sh - LUU Y: VPS nay dung NAT tu ben ngoai
#      (EXTERNAL_SSH_PORT=2463 -> internal 22), nen KHONG can va KHONG NEN
#      doi SSH_PORT o day, de nguyen mac dinh 22.
#
# AN TOAN BAT BUOC:
#   - Script se TU CHOI chay neu APP_USER chua co ~/.ssh/authorized_keys (tranh tu khoa minh ra ngoai).
#   - Sau khi script chay xong, KHONG DUOC DONG terminal dang mo nay.
#     Mo THEM 1 terminal/tab MOI, thu SSH lai (dung port moi neu co doi) truoc.
#     Neu SSH lai duoc bang key -> moi dong terminal cu. Neu khong -> dung terminal cu de rollback
#     (khoi phuc /etc/ssh/sshd_config.bak-* va `sudo systemctl restart ssh`).
#
# Chay: sudo bash 10-ssh-hardening.sh
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./00-config.sh

if [ "$(id -u)" -ne 0 ]; then
  echo "Can chay bang sudo/root: sudo bash 10-ssh-hardening.sh" >&2
  exit 1
fi

AUTH_KEYS="/home/${APP_USER}/.ssh/authorized_keys"
if [ ! -s "${AUTH_KEYS}" ]; then
  echo "TU CHOI CHAY: ${AUTH_KEYS} khong ton tai hoac rong." >&2
  echo "Phai co it nhat 1 SSH public key trong file do TRUOC khi tat dang nhap bang mat khau," >&2
  echo "neu khong ban se tu khoa minh ra khoi VPS." >&2
  echo "Kiem tra: cat ${AUTH_KEYS}" >&2
  exit 1
fi

SSHD_CONFIG="/etc/ssh/sshd_config"
BACKUP="/etc/ssh/sshd_config.bak-$(date +%Y%m%d_%H%M%S)"
echo "==> Backup ${SSHD_CONFIG} -> ${BACKUP}"
cp "${SSHD_CONFIG}" "${BACKUP}"

set_sshd_option() {
  local key="$1" value="$2"
  if grep -qE "^[#[:space:]]*${key}[[:space:]]" "${SSHD_CONFIG}"; then
    sed -i -E "s|^[#[:space:]]*${key}[[:space:]].*|${key} ${value}|" "${SSHD_CONFIG}"
  else
    echo "${key} ${value}" >> "${SSHD_CONFIG}"
  fi
}

echo "==> Tat dang nhap bang mat khau (chi con SSH key)"
set_sshd_option "PasswordAuthentication" "no"
set_sshd_option "KbdInteractiveAuthentication" "no"
set_sshd_option "PubkeyAuthentication" "yes"

echo "==> Tat dang nhap SSH truc tiep bang root"
set_sshd_option "PermitRootLogin" "no"

if [ "${SSH_PORT}" != "22" ]; then
  echo "==> Doi port SSH sang ${SSH_PORT}"
  echo "==> Mo port moi tren UFW TRUOC (giu nguyen port 22 de fallback, tu xoa sau khi xac nhan)"
  ufw allow "${SSH_PORT}/tcp"
  set_sshd_option "Port" "${SSH_PORT}"
fi

echo "==> Kiem tra cu phap sshd_config"
if ! sshd -t; then
  echo "LOI cu phap sshd_config, KHONG ap dung. File goc van con nguyen, backup tai ${BACKUP}." >&2
  cp "${BACKUP}" "${SSHD_CONFIG}"
  exit 1
fi

echo "==> Reload sshd (khong ngat session hien tai)"
systemctl reload ssh || systemctl reload sshd

echo
echo "============================================================"
echo " XONG. QUAN TRONG - LAM NGAY BAY GIO:"
echo " 1. MO THEM 1 terminal/tab MOI (dung dong terminal nay)."
echo " 2. Thu ket noi qua NAT ben ngoai (giong cach dang dung hang ngay):"
echo "      ssh -p ${EXTERNAL_SSH_PORT:-2463} ${APP_USER}@<IP-GATEWAY-BEN-NGOAI>"
if [ "${SSH_PORT}" != "22" ]; then
  echo "    (hoac neu vua doi SSH_PORT noi bo: ssh -p ${SSH_PORT} ${APP_USER}@<IP-VPS-NOI-BO>)"
fi
echo " 3. Neu vao duoc bang SSH key -> moi dong terminal nay."
echo " 4. Neu KHONG vao duoc -> o terminal nay chay lenh rollback:"
echo "      sudo cp ${BACKUP} ${SSHD_CONFIG}"
echo "      sudo systemctl restart ssh"
if [ "${SSH_PORT}" != "22" ]; then
  echo " 5. Sau khi xac nhan on dinh vai ngay, co the dong port 22 cu: sudo ufw delete allow 22/tcp"
fi
echo "============================================================"
