#!/usr/bin/env bash
# Cai module pm2-logrotate de log PM2 khong phinh to vo han theo thoi gian.
# Chay bang APP_USER (KHONG sudo): bash 09-pm2-logrotate.sh
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./00-config.sh

if [ "$(id -u)" -eq 0 ]; then
  echo "Chay bang user thuong (${APP_USER}), khong dung sudo/root." >&2
  exit 1
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "Chua co pm2 - chay 02-install-node.sh truoc." >&2
  exit 1
fi

echo "==> Cai module pm2-logrotate"
pm2 install pm2-logrotate

echo "==> Cau hinh: xoay log khi qua 10MB, giu 14 ban, nen gzip ban cu"
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:dateFormat "YYYY-MM-DD_HH-mm-ss"
pm2 set pm2-logrotate:rotateInterval "0 0 * * *"

pm2 save

echo "==> Xong buoc 09. Kiem tra: pm2 conf pm2-logrotate"
