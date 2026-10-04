#!/usr/bin/env bash
# Bien cau hinh dung chung cho toan bo script trong thu muc nay.
# App: "Boi duong nang luc so" (ten hien thi cong khai). Repo/schema Postgres
# van giu ten ky thuat goc (thong-tin-hoc-vien / thong_tin_hoc_vien) vi do
# la ten that cua repo GitHub va schema Prisma - doi se pha migration/clone.
# SUA CAC GIA TRI DUOI DAY TRUOC KHI CHAY BAT KY SCRIPT 01-06 NAO.
set -euo pipefail

# --- Bat buoc sua ---
export DOMAIN="boiduongnls.hcmue.edu.vn"                                   # domain cong khai (TLS terminate o reverse proxy trung tam, khong phai tren VPS nay)
export GIT_REPO="github-hocvien:thienvo2111/thong-tin-hoc-vien.git"  # SSH URL cua repo private (ten repo GitHub that su, xem `git remote -v`)
export GIT_BRANCH="main"

# VPS nay nam sau NAT/firewall trung tam cua HCMUE: tu ben ngoai truy cap
# qua port 2463 (SSH) / 2464 (HTTP), nhung NAT do FORWARD vao dung port
# chuan noi bo (22 / 80) - da xac minh thuc nghiem (echo $SSH_CONNECTION
# cho server port =22; test python http.server 80 nhan duoc request khi
# curl vao :2464 tu ben ngoai). Vi vay sshd/Nginx TREN VPS NAY van phai
# nghe dung 22/80 nhu binh thuong - KHONG doi Port/listen sang 2463/2464,
# lam vay se pha NAT va tu khoa minh ra ngoai. 2463/2464 chi de ghi nho khi
# ket noi tu ben ngoai (vd. lenh ssh -p 2463 ...), khong dung trong script.
export SSH_PORT="22"      # port sshd THUC TE tren VPS - giu 22, dung doi
export HTTP_PORT="80"     # port Nginx THUC TE tren VPS - giu 80, dung doi
export EXTERNAL_SSH_PORT="2463"   # chi de nho: tu ben ngoai SSH bang "ssh -p 2463 ..."
export EXTERNAL_HTTP_PORT="2464"  # chi de nho: domain cong khai di qua NAT nay truoc khi toi port 80

# --- Co the giu mac dinh ---
export APP_USER="${SUDO_USER:-$USER}"          # user chay pm2 (khong dung root)
export APP_DIR="/home/${APP_USER}/apps/boi-duong-nls"   # source code + backend build (git clone/npm build vao day)
# Nginx KHONG duoc tro thang vao ${APP_DIR}/frontend/dist: /home/<user> mac
# dinh Ubuntu la 750 (rwxr-x---), khong co "x" cho others, nen www-data
# khong "traverse" vao duoc du thu muc con ben trong dung quyen - se ra loi
# 500 "Permission denied" khi stat(). WEB_ROOT o ngoai /home, chuan Ubuntu,
# tranh phai noi long quyen home dir cua user.
export WEB_ROOT="/var/www/boiduongnls"
export NODE_VERSION="20"                        # khop engines NestJS 10 / Vite hien tai
export DB_NAME="thong_tin_hoc_vien"             # ten schema Prisma that su - KHONG doi (xem ghi chu tren)
export DB_USER="hocvien_app"

# Sinh 1 lan duy nhat va luu lai, tranh moi lan source file nay ra mat khau khac.
# Cac script trong bo nay chay xen ke luc co sudo (root) luc khong (APP_USER) -
# neu file duoc tao/doc boi root truoc, phai chown lai ve APP_USER ngay, neu
# khong lan chay khong-sudo sau se "Permission denied" va (do bash khong bat
# loi command substitution trong gan bien du co set -e) am tham gan
# DB_PASSWORD="" thay vi bao loi ro rang.
DB_PASSWORD_FILE="/home/${APP_USER}/.hocvien_db_password"
if [ -f "$DB_PASSWORD_FILE" ]; then
  if [ ! -r "$DB_PASSWORD_FILE" ]; then
    if [ "$(id -u)" -eq 0 ]; then
      chown "${APP_USER}:${APP_USER}" "$DB_PASSWORD_FILE"
      chmod 600 "$DB_PASSWORD_FILE"
    else
      echo "LOI: khong doc duoc ${DB_PASSWORD_FILE} (sai quyen so huu)." >&2
      echo "Chay: sudo chown ${APP_USER}:${APP_USER} ${DB_PASSWORD_FILE} && sudo chmod 600 ${DB_PASSWORD_FILE}" >&2
      exit 1
    fi
  fi
  export DB_PASSWORD="$(cat "$DB_PASSWORD_FILE")"
else
  export DB_PASSWORD="$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 32)"
  echo "$DB_PASSWORD" > "$DB_PASSWORD_FILE"
  chmod 600 "$DB_PASSWORD_FILE"
  [ "$(id -u)" -eq 0 ] && chown "${APP_USER}:${APP_USER}" "$DB_PASSWORD_FILE"
fi

export BACKEND_PORT="3000"
# HSTS: trinh duyet da vao bang HTTPS 1 lan se tu chuyen moi lan sau sang
# HTTPS (khong con roi vao http:// -> 503 cua cong HAProxy HCMUE). Bat dau
# 86400 (1 ngay); chay on dinh ~1 tuan thi nang len 31536000 (1 nam) roi chay
# lai 05-install-nginx.sh. KHONG them includeSubDomains (subdomain khac cua
# hcmue.edu.vn co the chi co HTTP). Dat "0" de tat HSTS.
export HSTS_MAX_AGE="86400"
export PM2_APP_NAME="boiduongnls-backend"

# --- Backup ---
export BACKUP_DIR="/home/${APP_USER}/backups/postgres"
export BACKUP_RETENTION_DAYS="14"
# Tuy chon: bat sync backup ra remote qua rclone (vd. "gdrive:boiduongnls-backups").
# Can tu chay `rclone config` truoc. De trong = chi giu backup local tren VPS.
export RCLONE_REMOTE=""

# --- Giam sat / alert ---
# Tuy chon: webhook nhan canh bao khi Nginx/Postgres/PM2 down (vd. topic ntfy.sh,
# Slack incoming webhook). De trong = chi ghi log, khong gui thong bao ra ngoai.
export ALERT_WEBHOOK_URL=""
