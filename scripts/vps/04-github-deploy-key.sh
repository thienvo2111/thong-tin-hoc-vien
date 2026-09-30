#!/usr/bin/env bash
# Tao SSH deploy key rieng cho repo private, in public key de add vao
# GitHub > Settings > Deploy keys (read-only du de clone/pull).
# Chay bang chinh APP_USER (KHONG sudo): bash 04-github-deploy-key.sh
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./00-config.sh

if [ "$(id -u)" -eq 0 ]; then
  echo "Chay bang user thuong (${APP_USER}), khong dung sudo/root." >&2
  exit 1
fi

KEY_PATH="$HOME/.ssh/hocvien_deploy_key"
mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"

if [ -f "$KEY_PATH" ]; then
  echo "==> Da co key tai ${KEY_PATH}, bo qua tao moi"
else
  echo "==> Tao SSH keypair (ed25519, khong passphrase - dung cho deploy tu dong)"
  ssh-keygen -t ed25519 -f "$KEY_PATH" -N "" -C "deploy@${DOMAIN}"
fi

SSH_CONFIG="$HOME/.ssh/config"
if ! grep -q "Host github-hocvien" "$SSH_CONFIG" 2>/dev/null; then
  echo "==> Them alias github-hocvien vao ${SSH_CONFIG}"
  cat >> "$SSH_CONFIG" <<EOF

Host github-hocvien
  HostName github.com
  User git
  IdentityFile ${KEY_PATH}
  IdentitiesOnly yes
EOF
  chmod 600 "$SSH_CONFIG"
fi

echo
echo "============================================================"
echo " 1. Copy public key duoi day"
echo " 2. Vao GitHub repo -> Settings -> Deploy keys -> Add deploy key"
echo "    (KHONG can tick 'Allow write access' vi chi can pull)"
echo "============================================================"
cat "${KEY_PATH}.pub"
echo "============================================================"
echo
echo "==> Sau khi add xong tren GitHub, test bang:"
echo "    ssh -T git@github-hocvien"
echo "==> Va sua GIT_REPO trong 00-config.sh thanh dang dung alias, vi du:"
echo "    export GIT_REPO=\"github-hocvien:${GIT_REPO#*:}\""
