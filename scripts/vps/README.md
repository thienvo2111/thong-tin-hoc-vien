# Script chuẩn bị VPS — Bồi dưỡng năng lực số (Ubuntu 22.04, PM2 + Nginx, không Docker)

Ten hien thi app: **Bồi dưỡng năng lực số** (domain `boiduongnls.hcmue.edu.vn`).
Repo GitHub và schema Postgres vẫn giữ tên kỹ thuật gốc
`thong-tin-hoc-vien` / `thong_tin_hoc_vien` — đó là tên thật của repo
và schema Prisma, đổi sẽ phá migration/clone, không liên quan tên hiển thị.

**NAT port ở tầng ngoài:** VPS này nằm sau NAT/firewall trung tâm của
HCMUE — **từ bên ngoài** kết nối SSH qua port **2463** và HTTP qua port
**2464** (vd. `ssh -p 2463 thienvpt@<IP-gateway>`), nhưng NAT đó forward
thẳng vào port **chuẩn nội bộ 22/80** trên chính VPS này (đã xác minh thực
nghiệm: `echo $SSH_CONNECTION` cho server port 22; test `python3 -m
http.server 80` nhận được request khi curl vào `:2464` từ ngoài). Vì vậy
**sshd và Nginx trên VPS này vẫn cấu hình như bình thường ở 22/80** —
2463/2464 chỉ là con số cần nhớ khi *gõ lệnh ssh từ máy khác vào*, các
script trong này không đổi `Port`/`listen` sang 2 số đó. Domain công khai
vẫn không cần certbot/SSL ở VPS này — TLS terminate ở gateway/NAT phía trên.

Áp dụng cho VPS đã kiểm tra: Ubuntu 22.04.4 LTS, 8 CPU, 15GB RAM, 97GB disk,
hoàn toàn sạch (chưa cài gì ngoài `git`). User vận hành: `thienvpt` (có
quyền `sudo`, nhóm `adm`/`sudo`).

## Thứ tự chạy

1. **Sửa `00-config.sh`** — bắt buộc đổi `DOMAIN`, `GIT_REPO` (owner/repo
   đúng). `SSH_PORT`/`HTTP_PORT` giữ nguyên `22`/`80` (port thật trên VPS),
   không sửa thành 2463/2464 — xem giải thích NAT ở trên. Các script khác
   đều `source` file này.

2. `sudo bash 01-system-setup.sh` — cập nhật apt, cài gói nền, UFW (mở đúng
   port thật 22 + 80), fail2ban, timezone.

3. `sudo bash 02-install-node.sh` — Node.js 20.x (NodeSource) + PM2 global +
   `pm2 startup` để tự khởi động lại khi VPS reboot.

4. `sudo bash 03-install-postgres.sh` — PostgreSQL 16 (repo PGDG, khớp
   `docker-compose.yml` gốc dùng `postgres:16-alpine`), tạo user/DB riêng
   `hocvien_app`/`thong_tin_hoc_vien`, bật extension `pgcrypto` + `pg_trgm`
   (bắt buộc cho migration init — xem `docs/database-ddl.sql`). Mật khẩu DB
   tự sinh, lưu tại `~/.hocvien_db_password`.

5. `bash 04-github-deploy-key.sh` (**không sudo**, chạy bằng user
   `thienvpt`) — tạo SSH deploy key, in public key để add vào GitHub repo
   (Settings → Deploy keys → Add deploy key, không cần quyền write). Sau khi
   add, sửa `GIT_REPO` trong `00-config.sh` sang dạng alias
   `github-hocvien:owner/repo.git` như script gợi ý cuối output.

6. **Xác nhận NAT/DNS**: đảm bảo `DOMAIN` đã trỏ đúng tới NAT/gateway trung
   tâm HCMUE, và NAT đó đã forward public HTTPS về VPS:2464 (nội bộ nhận ở
   port 80 — việc cấu hình NAT/gateway nằm ngoài phạm vi script, làm việc
   với đội hạ tầng HCMUE nếu chưa có) trước khi chạy bước 7.

7. `sudo bash 05-install-nginx.sh` — cài Nginx, tạo site config nghe HTTP
   thuần trên port **80** (`HTTP_PORT`), reverse-proxy các route backend
   thật → PM2 (`localhost:3000`), serve tĩnh từ `WEB_ROOT`
   (`/var/www/boiduongnls`, **không phải** `~/apps/.../frontend/dist` —
   `/home/<user>` mặc định Ubuntu là `750`, `www-data` không "traverse" vào
   được dù thư mục con đúng quyền, sẽ ra lỗi 500). Không cài SSL ở đây.

8. `bash 06-deploy.sh` (**không sudo**, phải chạy sau bước 7 vì cần
   `WEB_ROOT` đã tồn tại) — clone repo (hoặc `git pull` nếu chạy lại), cài
   dependency, build backend + frontend, copy `frontend/dist` sang
   `WEB_ROOT`, `prisma migrate deploy`, seed tài khoản `quan_tri` đầu tiên
   (idempotent — an toàn chạy lại), khởi động/reload PM2, reload Nginx.

9. `bash 07-setup-backup.sh` (**không sudo**) — `pg_dump` theo `BACKUP_CRON`
   (mặc định 4 lần/ngày: 02h, 08h, 14h, 20h) nén gzip vào `~/backups/postgres`,
   kiểm tra file nén toàn vẹn, tự xoá bản cũ hơn `BACKUP_RETENTION_DAYS`
   (14 ngày). Nếu đặt `RCLONE_REMOTE` thì mỗi bản được đẩy thêm ra ngoài VPS
   (giữ `RCLONE_REMOTE_RETENTION_DAYS` = 90 ngày). Lỗi ở bất kỳ bước nào ->
   ghi `backup.log` và gửi cảnh báo tới `ALERT_WEBHOOK_URL` (nếu có). Script
   kiểm tra remote trước khi cài cron — cấu hình sai sẽ báo ngay. Xem mục
   **Sao lưu ra ngoài VPS** bên dưới để bật (nên bật trước khi mở đợt).

10. `sudo bash 08-setup-monitoring.sh` — cron mỗi 5 phút kiểm tra
    Postgres/Nginx/PM2/dung lượng disk, tự `restart` service hệ thống bị
    down, ghi log `/var/log/hocvien-healthcheck.log`. Đặt
    `ALERT_WEBHOOK_URL` trong `00-config.sh` (vd. topic [ntfy.sh](https://ntfy.sh)
    miễn phí) để nhận thông báo đẩy trên điện thoại — để trống thì chỉ ghi log.

11. `bash 09-pm2-logrotate.sh` (**không sudo**) — cài `pm2-logrotate`, xoay
    log khi > 10MB, giữ 14 bản, nén gzip bản cũ.

12. `sudo bash 10-ssh-hardening.sh` — **đọc kỹ cảnh báo trong file trước khi
    chạy**, có thể tự khoá bạn khỏi VPS nếu làm sai. Tắt đăng nhập SSH bằng
    mật khẩu (chỉ còn SSH key), tắt đăng nhập root trực tiếp. **Không đổi
    port SSH** (giữ nguyên `SSH_PORT=22` — port 2463 chỉ tồn tại ở NAT bên
    ngoài, đổi port nội bộ sẽ phá NAT). Script tự chối chạy nếu chưa có
    `~/.ssh/authorized_keys`, và tự backup `sshd_config` trước khi sửa.
    **Bắt buộc mở thêm 1 terminal mới, thử `ssh -p 2463
    thienvpt@<IP-gateway-ben-ngoai>` (đúng như cách đang dùng hằng ngày)
    trước khi đóng terminal đang chạy script** — xác nhận đăng nhập bằng
    SSH key vẫn hoạt động sau khi tắt mật khẩu.

## Sau khi deploy lần đầu

- **Đổi mật khẩu `quan_tri`** ngay: script seed in `ten_dang_nhap` + mật
  khẩu ra terminal (xem log bước 8) — đăng nhập rồi gọi
  `POST /auth/doi-mat-khau` đổi ngay.
- **Điền SMTP thật** vào `~/apps/boi-duong-nls/backend/.env`
  (`SMTP_HOST/SMTP_USER/SMTP_PASS/SMTP_FROM`) — mặc định đang dùng Ethereal
  test, email không đến hộp thư thật. Sau khi sửa: `pm2 reload
  boiduongnls-backend --update-env`.
- **Kiểm tra**: `pm2 status`, `pm2 logs boiduongnls-backend`, test nội bộ
  trên VPS `curl http://127.0.0.1/api` (Swagger, port 80 chuẩn), rồi test
  qua domain thật `https://boiduongnls.hcmue.edu.vn/api` (đi qua NAT/gateway
  trung tâm — nếu domain không vào được nhưng curl nội bộ port 80 OK thì
  lỗi nằm ở NAT/gateway, không phải VPS này).

## Deploy lại sau này (code mới)

Chỉ cần chạy lại bước 8:

```bash
bash 06-deploy.sh
```

Script tự `git pull`, rebuild, **sao lưu Postgres** (qua
`~/bin/backup-postgres.sh` nếu bước 9 đã chạy — nếu chưa, script vẫn tiếp
tục nhưng in cảnh báo bỏ qua backup), rồi mới `migrate deploy`, reload PM2 —
không tạo lại DB/Nginx/SSL. Nếu migration lỗi hoặc dữ liệu sai sau khi
deploy, khôi phục từ bản backup vừa tạo:

```bash
ls -t ~/backups/postgres/*.sql.gz | head -1   # tim ban backup moi nhat
gunzip -c ~/backups/postgres/<file>.sql.gz | psql -h 127.0.0.1 -U hocvien_app thong_tin_hoc_vien
```

## Sao lưu ra ngoài VPS (làm 1 lần, ~10 phút)

Bản sao lưu chứa CCCD, số điện thoại của ~9.000 học viên — **bắt buộc mã
hoá** trước khi rời VPS. Dùng 2 remote rclone lồng nhau: `gdrive` (nơi lưu,
vd. Google Drive tài khoản công việc của đơn vị) và `hocvien-crypt` (mã hoá
bọc ngoài — Google chỉ thấy tên file/nội dung đã mã hoá).

1. Trên VPS: `sudo apt-get install -y rclone`
2. VPS không có trình duyệt nên lấy token Google trên **máy tính cá nhân**:
   cài rclone (<https://rclone.org/downloads/>), chạy `rclone authorize "drive"`,
   đăng nhập tài khoản Google sẽ chứa bản sao lưu, copy đoạn JSON token in ra.
3. Trên VPS: `rclone config` -> `n` (new remote) -> tên `gdrive` -> loại
   `drive` -> để trống client_id/secret -> scope `drive.file` -> "Use auto
   config?" chọn **n** -> dán token ở bước 2 -> các câu còn lại Enter.
4. Vẫn `rclone config` -> `n` -> tên `hocvien-crypt` -> loại `crypt` ->
   remote `gdrive:boiduongnls-backups` -> filename encryption `standard` ->
   chọn **tự nhập mật khẩu dài** (2 mật khẩu: password + salt).
   **Lưu 2 mật khẩu này ở nơi an toàn ngoài VPS** (két mật khẩu của đơn vị) —
   mất chúng là mất khả năng giải mã, mất VPS thì phải có chúng để khôi phục.
5. Sửa `00-config.sh`: `export RCLONE_REMOTE="hocvien-crypt:"` (và nên đặt
   `ALERT_WEBHOOK_URL` để nhận cảnh báo khi sao lưu lỗi).
6. Chạy lại `bash 07-setup-backup.sh` — script kiểm tra remote, chạy thử 1
   lần, in 5 bản mới nhất trên remote, rồi cài cron.

Kiểm tra định kỳ: `tail ~/backups/postgres/backup.log` (mỗi lần chạy có
dòng `OK ... ` và `OK da day len hocvien-crypt:`); `rclone lsl hocvien-crypt:`.

Khôi phục khi mất VPS (máy mới đã cài rclone + Postgres): tạo lại 2 remote
như bước 3-4 với **đúng 2 mật khẩu cũ**, rồi
`rclone copy hocvien-crypt:<file>.sql.gz /tmp/` và
`gunzip -c /tmp/<file>.sql.gz | psql -h 127.0.0.1 -U hocvien_app thong_tin_hoc_vien`.

## Lưu ý fragile: danh sách route proxy trong bước 7

Backend không dùng `setGlobalPrefix` (xem `backend/src/main.ts`) — mỗi
`@Controller('...')` mount thẳng ở root (`/auth`, `/hoc-vien`, ...), chỉ
`/api` là Swagger. Nginx ở bước 7 phải liệt kê rõ các prefix đó để proxy
đúng sang backend, phần còn lại rơi vào SPA catch-all. Nếu sau này thêm
`@Controller` mới ở root (`grep -rn "@Controller(" backend/src` để rà lại),
phải thêm tên vào regex `location ~ ^/(...)"` trong
`05-install-nginx.sh` rồi chạy lại `sudo bash 05-install-nginx.sh` (an toàn
chạy lại: ghi đè site config, không đụng `WEB_ROOT` đã có build) — nếu không,
các route mới sẽ bị SPA nuốt mất, trả về `index.html` thay vì gọi API.

Từ 2026-10-02, `06-deploy.sh` tự so prefix `@Controller` với site config Nginx
đang chạy và in `!! CANH BAO: Nginx CHUA proxy cac prefix: ...` nếu thiếu
(chỉ cảnh báo, không dừng deploy). Đã từng bị lọt: `yeu-cau-ho-tro` (M8) và
`cau-hinh-khao-sat` — đã bổ sung vào regex cùng ngày.

## Vẫn còn ngoài phạm vi script (chưa tự động hoá)

- Khôi phục backup thật sự (script chỉ tạo backup, lệnh restore ghi ở cuối
  bước 9 trong output — nên **thử restore 1 lần trên môi trường test** để
  chắc quy trình chạy được trước khi cần dùng thật).
- Dashboard giám sát trực quan (Grafana/Uptime Kuma...) — bước 10 chỉ là
  healthcheck + alert đơn giản qua cron, không có UI.
- Xoay vòng SSH key, audit log truy cập sâu hơn fail2ban mặc định.
