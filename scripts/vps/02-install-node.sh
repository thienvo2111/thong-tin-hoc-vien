#!/usr/bin/env bash
# Cai Node.js (qua NodeSource, khong dung nvm de PM2/systemd goi duoc thang node) + PM2.
# Chay: sudo bash 02-install-node.sh
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./00-config.sh

if [ "$(id -u)" -ne 0 ]; then
  echo "Can chay bang sudo/root: sudo bash 02-install-node.sh" >&2
  exit 1
fi

if command -v node >/dev/null 2>&1; then
  echo "==> Node da co: $(node -v), bo qua cai dat"
else
  echo "==> Cai Node.js ${NODE_VERSION}.x tu NodeSource"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash -
  apt-get install -y nodejs
fi

echo "==> Phien ban:"
node -v
npm -v

echo "==> Cai PM2 global"
npm install -g pm2

echo "==> Cau hinh PM2 tu khoi dong cung he thong cho user ${APP_USER}"
env PATH="$PATH" pm2 startup systemd -u "${APP_USER}" --hp "/home/${APP_USER}" | tail -n 1 > /tmp/pm2-startup-cmd.sh
if [ -s /tmp/pm2-startup-cmd.sh ]; then
  bash /tmp/pm2-startup-cmd.sh || echo "Chay thu cong lenh pm2 startup neu buoc nay loi"
fi

echo "==> Xong buoc 02"
