#!/usr/bin/env bash
# Cap nhat he thong, cai goi nen, cau hinh firewall + dong bo gio.
# Chay: sudo bash 01-system-setup.sh
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./00-config.sh

if [ "$(id -u)" -ne 0 ]; then
  echo "Can chay bang sudo/root: sudo bash 01-system-setup.sh" >&2
  exit 1
fi

echo "==> Cap nhat apt"
apt-get update -y
apt-get upgrade -y

echo "==> Cai goi nen thiet yeu"
apt-get install -y \
  curl wget git unzip build-essential \
  ufw \
  ca-certificates gnupg lsb-release

echo "==> Cau hinh timezone Asia/Ho_Chi_Minh"
timedatectl set-timezone Asia/Ho_Chi_Minh || true

# Dong ho lech -> moi moc thoi gian (dang nhap, nhat ky, khoa tam) sai.
# Da gap 2026-10-04: VPS cham ~1 gio. Mang HCMUE chan NTP (UDP 123) nen
# systemd-timesyncd khong nhan duoc goi nao -> dong bo qua header Date HTTP
# bang htpdate. Tat timesyncd de 2 dich vu khong gianh chinh gio.
echo "==> Dong bo gio qua HTTP (htpdate)"
timedatectl set-ntp false || true
NEEDRESTART_MODE=l apt-get install -y htpdate
htpdate -s www.google.com www.cloudflare.com || true
systemctl enable --now htpdate
date

echo "==> Cau hinh UFW (chi mo port THUC TE tren VPS: 22, 80 - NAT ben ngoai"
echo "    tu forward 2463/2464 vao day, xem ghi chu trong 00-config.sh)"
ufw allow OpenSSH
ufw allow "${HTTP_PORT}/tcp"
ufw --force enable
ufw status verbose

# KHONG dung fail2ban: SSH tu ngoai vao qua NAT HCMUE nen moi ket noi mang chung
# 1 IP nguon (10.20.2.215) -> fail2ban khong phan biet duoc ke do mat khau va
# se chan luon admin. Chong do mat khau bang 10-ssh-hardening.sh (chi SSH key).

echo "==> Xong buoc 01. User van hanh: ${APP_USER}"
