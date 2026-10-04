#!/usr/bin/env bash
# Clone repo (lan dau) hoac pull (lan sau), build backend + frontend, chay
# migration, seed tai khoan quan_tri (chi lan dau, idempotent), khoi dong/reload PM2.
# Chay bang APP_USER (KHONG sudo): bash 06-deploy.sh
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
SCRIPT_DIR="$(pwd)"
source ./00-config.sh

if [ "$(id -u)" -eq 0 ]; then
  echo "Chay bang user thuong (${APP_USER}), khong dung sudo/root." >&2
  exit 1
fi

mkdir -p "$(dirname "${APP_DIR}")"

if [ -d "${APP_DIR}/.git" ]; then
  echo "==> Repo da co, git pull"
  git -C "${APP_DIR}" fetch origin "${GIT_BRANCH}"
  git -C "${APP_DIR}" checkout "${GIT_BRANCH}"
  git -C "${APP_DIR}" pull origin "${GIT_BRANCH}"
else
  echo "==> Clone repo lan dau"
  git clone --branch "${GIT_BRANCH}" "${GIT_REPO}" "${APP_DIR}"
fi

# ---------- Backend ----------
echo "==> Backend: cai dependencies"
cd "${APP_DIR}/backend"
npm ci

if [ ! -f .env ]; then
  echo "==> Tao backend/.env lan dau tu .env.example (SUA JWT_SECRET/VLE_SECRET_KEY/SMTP that sau khi xem qua)"
  cp .env.example .env
  JWT_SECRET_VAL="$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9')"
  VLE_SECRET_VAL="$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9')"
  sed -i "s#^DATABASE_URL=.*#DATABASE_URL=\"postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}?schema=public\"#" .env
  sed -i "s#^PORT=.*#PORT=${BACKEND_PORT}#" .env
  sed -i "s#^CORS_ORIGIN=.*#CORS_ORIGIN=https://${DOMAIN}#" .env
  # Link trong email (kich hoat tai khoan, dat lai mat khau, xac minh email) —
  # .env.example de http://localhost:5173.
  sed -i "s#^FRONTEND_URL=.*#FRONTEND_URL=https://${DOMAIN}#" .env
  sed -i "s#^JWT_SECRET=.*#JWT_SECRET=${JWT_SECRET_VAL}#" .env
  sed -i "s#^VLE_SECRET_KEY=.*#VLE_SECRET_KEY=${VLE_SECRET_VAL}#" .env
  echo "    -> Nho dien SMTP_HOST/SMTP_USER/SMTP_PASS/SMTP_FROM that trong ${APP_DIR}/backend/.env truoc khi dung that"
else
  echo "==> backend/.env da ton tai, giu nguyen"
fi

echo "==> Backend: generate Prisma Client (bat buoc sau moi npm ci - schema.prisma"
echo "    sinh ra type cho @prisma/client, khong co buoc nay 'nest build' se loi"
echo "    'Module @prisma/client has no exported member ...')"
npx prisma generate

echo "==> Backend: build"
npm run build

echo "==> Kiem tra Nginx da proxy du moi prefix controller backend"
# Nginx chi chuyen ve backend cac prefix liet ke trong 05-install-nginx.sh; prefix
# thieu se bi tra index.html (SPA) va API hong am tham. Chi canh bao, khong dung deploy.
NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}"
if [ -r "${NGINX_CONF}" ]; then
  THIEU=""
  for p in $(grep -rhoE "@Controller\('[^'/]+" src --include=*.controller.ts | sed "s/@Controller('//" | sort -u); do
    grep -qE "[(|]${p}[|)]" "${NGINX_CONF}" || THIEU="${THIEU} ${p}"
  done
  if [ -n "${THIEU}" ]; then
    echo "    !! CANH BAO: Nginx CHUA proxy cac prefix:${THIEU}"
    echo "    !! Chay lai: sudo bash ${SCRIPT_DIR}/05-install-nginx.sh"
  else
    echo "    OK"
  fi
fi

echo "==> Backend: sao luu Postgres truoc khi migrate (phong migration loi/sai)"
BACKUP_SCRIPT="/home/${APP_USER}/bin/backup-postgres.sh"
if [ -x "${BACKUP_SCRIPT}" ]; then
  "${BACKUP_SCRIPT}"
else
  echo "    (chua co script backup - chay 'bash 07-setup-backup.sh' 1 lan de co backup tu dong o day)"
fi

echo "==> Backend: chay migration"
npx prisma migrate deploy

if [ "${SEED_ON_DEPLOY:-1}" = "1" ]; then
  echo "==> Backend: seed tai khoan quan_tri (idempotent, bo qua neu da co)"
  npx prisma db seed || true
fi

echo "==> Backend: khoi dong/reload qua PM2"
cd "${APP_DIR}/backend"
# backend/tsconfig.json khong dat rootDir, tsc tu suy goc la backend/ (vi co
# ca prisma.config.ts o ngoai src/) nen entry point luon ra dist/src/main.js,
# KHONG PHAI dist/main.js nhu mac dinh cac project Nest khac.
if pm2 describe "${PM2_APP_NAME}" >/dev/null 2>&1; then
  pm2 reload "${PM2_APP_NAME}" --update-env
else
  pm2 start dist/src/main.js --name "${PM2_APP_NAME}" --cwd "${APP_DIR}/backend"
fi
pm2 save

# ---------- Frontend ----------
echo "==> Frontend: cai dependencies"
cd "${APP_DIR}/frontend"
npm ci

if [ ! -f .env ]; then
  echo "==> Tao frontend/.env lan dau tu .env.example"
  cp .env.example .env
  sed -i "s#^VITE_API_BASE_URL=.*#VITE_API_BASE_URL=https://${DOMAIN}#" .env
  sed -i "s#^VITE_SITE_URL=.*#VITE_SITE_URL=https://${DOMAIN}#" .env
else
  echo "==> frontend/.env da ton tai, giu nguyen"
fi

echo "==> Frontend: build"
npm run build

echo "==> Copy build vao ${WEB_ROOT} (Nginx serve tu day, KHONG phai thang"
echo "    trong /home/${APP_USER} - www-data khong traverse vao home dir duoc,"
echo "    xem giai thich trong 00-config.sh)"
if [ ! -d "${WEB_ROOT}" ]; then
  echo "LOI: ${WEB_ROOT} chua ton tai. Chay 05-install-nginx.sh (sudo) truoc buoc nay." >&2
  exit 1
fi
rm -rf "${WEB_ROOT:?}"/*
cp -r dist/. "${WEB_ROOT}/"

echo "==> Reload Nginx de nhan dist moi"
sudo -n nginx -t && sudo -n systemctl reload nginx 2>/dev/null || \
  echo "    (khong tu reload duoc nginx - can quyen sudo, chay: sudo systemctl reload nginx)"

echo "==> Xong. Backend qua PM2 (${PM2_APP_NAME}), frontend tai ${APP_DIR}/frontend/dist"
echo "==> Kiem tra: pm2 logs ${PM2_APP_NAME}  |  pm2 status"
