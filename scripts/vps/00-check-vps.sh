#!/usr/bin/env bash
# Kiem tra nhanh cau hinh VPS truoc khi quyet dinh cach deploy (PM2 native vs Docker).
# Chay: bash 00-check-vps.sh
set -euo pipefail

echo "===== OS ====="
if [ -f /etc/os-release ]; then . /etc/os-release; echo "$PRETTY_NAME"; fi
uname -a

echo
echo "===== CPU ====="
nproc --all
grep "model name" /proc/cpuinfo | head -1

echo
echo "===== RAM ====="
free -h

echo
echo "===== Disk ====="
df -h /

echo
echo "===== Swap ====="
swapon --show || echo "Khong co swap"

echo
echo "===== Ports dang nghe ====="
(ss -tulpn 2>/dev/null || netstat -tulpn 2>/dev/null) | grep LISTEN || true

echo
echo "===== Phan mem da co san ====="
for c in docker docker-compose nginx node npm psql git nvm certbot pm2; do
  if command -v "$c" >/dev/null 2>&1; then
    printf "%-14s %s\n" "$c" "$($c --version 2>&1 | head -1)"
  else
    printf "%-14s khong co\n" "$c"
  fi
done

echo
echo "===== User hien tai / sudo ====="
whoami
id
sudo -n true 2>/dev/null && echo "sudo: khong can mat khau" || echo "sudo: can mat khau hoac khong co quyen"
