#!/usr/bin/env bash
# Cai Nginx, tao site config reverse-proxy backend PM2 + serve frontend build
# tinh, nghe HTTP thuan tren HTTP_PORT (80 - port THAT tren VPS). KHONG cai
# certbot/SSL o day - VPS nay nam sau NAT/firewall trung tam cua HCMUE
# (ben ngoai vao qua port 2464, NAT forward vao 80), TLS terminate ben ngoai
# (xem giai thich day du trong 00-config.sh).
# Chay: sudo bash 05-install-nginx.sh
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./00-config.sh

if [ "$(id -u)" -ne 0 ]; then
  echo "Can chay bang sudo/root: sudo bash 05-install-nginx.sh" >&2
  exit 1
fi

if [ "$DOMAIN" = "your-domain.com" ]; then
  echo "Chua sua DOMAIN trong 00-config.sh, dung lai." >&2
  exit 1
fi

echo "==> Cai Nginx"
apt-get install -y nginx

# Serve tu WEB_ROOT (vd. /var/www/boiduongnls), KHONG phai thang trong
# ${APP_DIR} (nam trong /home/<user>) - xem giai thich trong 00-config.sh
# (home dir mac dinh 750, www-data khong traverse vao duoc -> loi 500).
FRONTEND_DIST="${WEB_ROOT}"
SITE_CONF="/etc/nginx/sites-available/${DOMAIN}"

echo "==> Ghi cau hinh site ${SITE_CONF} (nghe port ${HTTP_PORT})"
cat > "$SITE_CONF" <<EOF
server {
    listen ${HTTP_PORT};
    listen [::]:${HTTP_PORT};
    server_name ${DOMAIN};

    root ${FRONTEND_DIST};
    index index.html;

    # HSTS (xem HSTS_MAX_AGE trong 00-config.sh). TLS terminate o cong HCMUE,
    # header nay di kem moi response HTTPS toi trinh duyet. "always" de ap ca
    # response loi. Location nao co add_header rieng KHONG ke thua dong nay —
    # phai lap lai trong location do (xem khoi file tinh ben duoi).
    add_header Strict-Transport-Security "max-age=${HSTS_MAX_AGE}" always;

    # Backend NestJS (khong co global prefix - xem backend/src/*.controller.ts)
    # /api la Swagger docs; cac path con lai la route API that su.
    # THEM CONTROLLER MOI -> them prefix vao day roi chay lai script nay (06-deploy.sh co canh bao neu thieu;
    # backend/src/nginx-prefix.spec.ts bat loi nay ngay khi chay test). Prefix API KHONG duoc trung route
    # trang frontend (vd. /ho-tro la trang -> API nguoi ho tro dung /ho-tro-hoc-vien).
    location ~ ^/(api|auth|hoc-vien|khoa-boi-duong|dot-xac-nhan|thong-bao|danh-muc|nguoi-dung|bao-cao|import|validate|lop|dang-ky-hoc|yeu-cau-ho-tro|cau-hinh-khao-sat|sso|ho-tro-hoc-vien|diem-hoc|giang-vien|ho-tro-giang-vien|bang-kiem|cong-giang-vien|van-hanh|thong-ke) {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        # Reverse proxy trung tam terminate TLS truoc khi forward ve day -
        # neu no gui sẵn X-Forwarded-Proto thi giu nguyen, khong ep thanh http.
        proxy_set_header X-Forwarded-Proto \$http_x_forwarded_proto;
    }

    # SPA React: moi route khong khop file tinh deu tra ve index.html
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # index.html luon phai kiem tra lai (no-cache) de nhan ban deploy moi; asset hash thi cache lau.
    # add_header o day khong ke thua cua server -> lap lai HSTS.
    location = /index.html {
        add_header Cache-Control "no-cache" always;
        add_header Strict-Transport-Security "max-age=${HSTS_MAX_AGE}" always;
    }

    location ~* \.(js|css|svg|png|jpg|jpeg|gif|ico|woff2?)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
        add_header Strict-Transport-Security "max-age=${HSTS_MAX_AGE}" always;
    }
}
EOF

ln -sf "$SITE_CONF" "/etc/nginx/sites-enabled/${DOMAIN}"
rm -f /etc/nginx/sites-enabled/default

mkdir -p "$FRONTEND_DIST"
if [ ! -f "${FRONTEND_DIST}/index.html" ]; then
  echo "<html><body>Dang trien khai...</body></html>" > "${FRONTEND_DIST}/index.html"
fi
# Script nay chay sudo/root nen WEB_ROOT vua tao bi root so huu - tra ve
# APP_USER de 06-deploy.sh (chay KHONG sudo) copy build moi vao duoc ma
# khong can quyen sudo rieng.
chown -R "${APP_USER}:${APP_USER}" "${WEB_ROOT}"
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}" 2>/dev/null || true

nginx -t
systemctl reload nginx
systemctl enable nginx

echo "==> Xong buoc 05. Site noi bo: http://127.0.0.1:${HTTP_PORT} (public qua reverse proxy: https://${DOMAIN})"
