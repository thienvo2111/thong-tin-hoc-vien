# Runbook — Khung Cổng đơn vị trên tên miền thứ hai (issue #55, ADR 0015 P1–P4, T7)

> Đây là **lệnh để người vận hành tự chạy trên VPS**. Trợ lý không SSH, không deploy, không chạy lệnh trên VPS.
> Nghiên cứu nền: `docs/research/2026-11-17-ten-mien-thu-hai.md` (nhánh `research/ten-mien-thu-hai`).

| Thay đổi | Ảnh hưởng dữ liệu |
|---|---|
| Frontend: cùng 1 bản build phục vụ 2 cổng, chọn theo hostname lúc chạy — trang NLS (như cũ) và **"Cổng đơn vị – Bồi dưỡng giáo viên HCMUE"** (đăng nhập, Trang chủ tạm, Hướng dẫn) | **Không migration, không sửa dữ liệu, không đổi backend** |
| Build sinh thêm `dist/cong-don-vi.html` (meta xem trước link Zalo/Facebook của Cổng đơn vị) | Không |
| Khi đã cấu hình tên miền Cổng đơn vị: tài khoản `truong`/`so_gddt`/`phong_vhxh` **không vào được trang NLS nữa** (thấy thông báo + link sang Cổng đơn vị); học viên/hỗ trợ/giảng viên không vào được Cổng đơn vị; `quan_tri` vào được cả 2 | Không (chặn ở frontend; quyền thật vẫn ở backend) |

**Công tắc:** `VITE_CONG_DON_VI_HOSTNAME` trống/không khai báo → bản build chạy **y như trước** (không chặn ai, không có Cổng đơn vị). Vì biến `VITE_*` được nhúng lúc build, đổi biến xong **phải build lại** frontend.

Mọi lệnh chạy trên VPS bằng user thường (trừ chỗ ghi `sudo`). Repo: `~/apps/boi-duong-nls`. Dưới đây `TEN_MIEN_CONG_DON_VI` là tên miền HCMUE cấp (chưa có — thay bằng giá trị thật).

## 0. Việc của IT HCMUE (đường găng — làm trước)

1. DNS `TEN_MIEN_CONG_DON_VI` → gateway HCMUE; chứng chỉ TLS cho tên miền này **trên proxy HCMUE** (VPS không có cert).
2. Proxy HCMUE chuyển `TEN_MIEN_CONG_DON_VI` về **cùng** VPS (NAT như `boiduongnls`) và **giữ nguyên header `Host`**.
   - **Phải hỏi IT HCMUE xác nhận việc giữ `Host`.** Hiện chưa có bằng chứng: hệ thống vẫn chạy dù Host bị đổi vì block NLS là server mặc định. Nếu proxy ghi đè Host, mọi request sẽ rơi vào block NLS và Cổng đơn vị không bao giờ hiện.
   - Kiểm chứng sau khi IT bật: xem bước 5.

## 1. Kiểm tra trước (chỉ đọc)

Đếm tài khoản đơn vị sẽ **bị chặn trên boiduongnls** ngay khi cấu hình xong (báo trước cho các đơn vị / Quản trị):

```bash
cd ~/apps/boi-duong-nls
export DB_URL="$(grep '^DATABASE_URL=' backend/.env | cut -d= -f2- | tr -d '"' | sed 's/?.*//')"
psql "$DB_URL" -c "SELECT vai_tro, count(*) FROM nguoi_dung WHERE vai_tro IN ('truong','so_gddt','phong_vhxh') GROUP BY 1;"
unset DB_URL
```

Không cần backup DB cho đợt này (không chạm dữ liệu). Ghi lại commit đang chạy để quay lui:

```bash
git log -1 --oneline | tee ~/truoc-cong-don-vi-$(date +%F).txt
```

## 2. Biến môi trường

### `frontend/.env` (VPS)

`06-deploy.sh` **không sửa** `.env` đã tồn tại → sửa tay:

```bash
cd ~/apps/boi-duong-nls/frontend
cp .env .env.bak-$(date +%F)
nano .env
```

```dotenv
# API gọi tương đối (cùng origin) — trang ở tên miền nào thì gọi API ở tên miền đó, không cần CORS chéo.
VITE_API_BASE_URL=
VITE_SITE_URL=https://boiduongnls.hcmue.edu.vn
VITE_CONG_DON_VI_HOSTNAME=TEN_MIEN_CONG_DON_VI
VITE_CONG_DON_VI_URL=https://TEN_MIEN_CONG_DON_VI
```

- `VITE_API_BASE_URL` để **rỗng**: hiện đang là `https://boiduongnls…` nên trang trên tên miền mới sẽ gọi API chéo sang tên miền NLS. Để rỗng thì cả 2 cổng gọi API cùng origin qua Nginx (bước 3). Trang NLS không đổi hành vi (vẫn cùng origin).
- `VITE_CONG_DON_VI_HOSTNAME`: chỉ hostname (không `https://`, không `/`), không phân biệt hoa thường.
- `VITE_CONG_DON_VI_URL`: dùng cho link "Mở Cổng đơn vị" ở trang NLS và `og:url`/`og:image` của `cong-don-vi.html`. `VITE_SITE_URL`: link ngược "Mở trang Bồi dưỡng năng lực số" ở Cổng đơn vị. Thiếu → chỉ hiện chữ, không có link.

### `backend/.env` (VPS) — tùy chọn, vô hại

Thêm tên miền mới vào `CORS_ORIGIN` (cách nhau dấu phẩy) cho chắc; với API cùng origin thì CORS không dùng tới:

```dotenv
CORS_ORIGIN=https://boiduongnls.hcmue.edu.vn,https://TEN_MIEN_CONG_DON_VI
```

Đổi `backend/.env` thì `pm2 reload` backend. **Không** đổi `FRONTEND_URL`: link trong email (đặt lại mật khẩu, kích hoạt) vẫn về tên miền NLS — chọn tên miền theo ngữ cảnh là việc của issue sau. Trong lúc chờ, Cổng đơn vị ghi "Quên mật khẩu? Liên hệ HCMUE".

## 3. Nginx — thêm server block thứ hai (sudo)

File: `/etc/nginx/sites-available/boiduongnls.hcmue.edu.vn` (do `05-install-nginx.sh` sinh ra).

1. Block NLS hiện có: đổi 2 dòng `listen` thành **default server** rõ ràng (Host lạ vẫn vào NLS như nay):

   ```nginx
   listen 80 default_server;
   listen [::]:80 default_server;
   ```

2. Thêm block mới **cùng file** (cùng `root`, **cùng danh sách prefix API** với block NLS — copy nguyên dòng `location ~ ^/(...)` từ block NLS để khỏi lệch; danh sách dưới đây khớp `scripts/vps/05-install-nginx.sh` tại thời điểm viết, được `backend/src/nginx-prefix.spec.ts` kiểm):

   ```nginx
   server {
       listen 80;
       listen [::]:80;
       server_name TEN_MIEN_CONG_DON_VI;

       root /var/www/boiduongnls;
       index cong-don-vi.html;

       add_header Strict-Transport-Security "max-age=HSTS_MAX_AGE" always;

       location ~ ^/(api|auth|hoc-vien|khoa-boi-duong|dot-xac-nhan|thong-bao|danh-muc|nguoi-dung|bao-cao|import|validate|lop|dang-ky-hoc|yeu-cau-ho-tro|cau-hinh-khao-sat|sso|ho-tro-hoc-vien|diem-hoc|giang-vien|ho-tro-giang-vien|bang-kiem|cong-giang-vien|van-hanh|thong-ke|lich-hoc|doi-buoi-hoc) {
           proxy_pass http://127.0.0.1:3000;
           proxy_http_version 1.1;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $http_x_forwarded_proto;
       }

       # SPA: mọi route không khớp file tĩnh → entry của Cổng đơn vị (meta xem trước link riêng).
       location / {
           try_files $uri /cong-don-vi.html;
       }

       location = /cong-don-vi.html {
           add_header Cache-Control "no-cache" always;
           add_header Strict-Transport-Security "max-age=HSTS_MAX_AGE" always;
       }

       location ~* \.(js|css|svg|png|jpg|jpeg|gif|ico|woff2?)$ {
           expires 30d;
           add_header Cache-Control "public, immutable";
           add_header Strict-Transport-Security "max-age=HSTS_MAX_AGE" always;
       }
   }
   ```

   Thay `HSTS_MAX_AGE` bằng giá trị đang dùng ở block NLS, cổng backend `3000` bằng `BACKEND_PORT` nếu khác. Lưu ý `try_files $uri /cong-don-vi.html` (không có `$uri/`) để `/` không rơi vào `index.html` của NLS.

3. Kiểm tra + nạp lại:

   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   ```

> **Chú ý:** chạy lại `05-install-nginx.sh` sẽ **ghi đè** file site và mất block này. Sửa script cho có block thứ hai (biến `DOMAIN_CONG_DON_VI` trong `00-config.sh`, trống = không sinh) là việc riêng — đợt này không sửa `scripts/vps/*`.

## 4. Build + đưa lên

`06-deploy.sh` hiện copy mọi file trong `dist/` **trừ `index.html`** trước, rồi mới đổi `index.html` nguyên tử ở cuối. `cong-don-vi.html` vì vậy được copy ở bước đầu (không nguyên tử): có một khoảnh khắc ngắn nó trỏ tới chunk vừa copy — rủi ro nhỏ. Khi sửa script (việc riêng), loại thêm `./cong-don-vi.html` khỏi lệnh `find` đầu và copy nó qua file tạm + `mv -f` ở cuối giống `index.html`:

```bash
# (mô tả thay đổi cho 06-deploy.sh — KHÔNG phải lệnh chạy tay)
(cd dist && find . -type f ! -path './index.html' ! -path './cong-don-vi.html' -print0 | xargs -0 -I{} cp --parents {} "${WEB_ROOT}/")
for f in index.html cong-don-vi.html; do
  cp "dist/$f" "${WEB_ROOT}/.$f.new" && mv -f "${WEB_ROOT}/.$f.new" "${WEB_ROOT}/$f"
done
```

Trước khi script được sửa, chạy `06-deploy.sh` như thường lệ là đủ (file vẫn được copy). Kiểm tra sau khi deploy:

```bash
ls -l /var/www/boiduongnls/index.html /var/www/boiduongnls/cong-don-vi.html
grep -o '<title>[^<]*' /var/www/boiduongnls/index.html /var/www/boiduongnls/cong-don-vi.html
```

Kỳ vọng: `index.html` → "Bồi dưỡng năng lực số cho giáo viên"; `cong-don-vi.html` → "Cổng đơn vị – Bồi dưỡng giáo viên HCMUE".

## 5. Kiểm chứng

Trên VPS (không phụ thuộc DNS/IT):

```bash
curl -s -H 'Host: TEN_MIEN_CONG_DON_VI' http://127.0.0.1/ | grep -o '<title>[^<]*'
curl -s -H 'Host: boiduongnls.hcmue.edu.vn' http://127.0.0.1/ | grep -o '<title>[^<]*'
curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: TEN_MIEN_CONG_DON_VI' http://127.0.0.1/auth/toi   # 401 = đã tới backend
```

Sau khi IT HCMUE bật tên miền: mở `https://TEN_MIEN_CONG_DON_VI` — tab trình duyệt ghi "Cổng đơn vị – Bồi dưỡng giáo viên HCMUE". Nếu ra trang giới thiệu NLS → proxy **không giữ Host**; kiểm tra bằng log (thêm tạm `$host` vào `log_format`, hoặc so `tail -f /var/log/nginx/access.log` khi mở từng tên miền) rồi báo IT.

Kiểm thử chức năng (điện thoại, trình duyệt Zalo, bề ngang 360px):

- Cổng đơn vị: tài khoản trường → đổi mật khẩu lần đầu → Trang chủ; menu chỉ có "Trang chủ", "Hướng dẫn"; `/huong-dan` xem được khi chưa đăng nhập; `/toi`, `/admin/tong-quan` → "Không tìm thấy trang".
- Cổng đơn vị: tài khoản học viên → báo "Tài khoản này dùng trên trang Bồi dưỡng năng lực số" + link, ở lại trang đăng nhập.
- boiduongnls: tài khoản trường → báo "Tài khoản đơn vị đăng nhập tại Cổng đơn vị" + link; học viên, hỗ trợ, giảng viên, quản trị → như cũ.

## 6. Quay lui

Không có dữ liệu để khôi phục. Xóa (hoặc để trống) `VITE_CONG_DON_VI_HOSTNAME` trong `frontend/.env`, build + deploy lại → mọi tài khoản dùng trang NLS như trước. Block Nginx thứ hai để nguyên cũng vô hại (chỉ khớp tên miền mới). Muốn quay hẳn về commit cũ: `git checkout` commit ghi ở bước 1 rồi chạy `06-deploy.sh`.

## Phụ lục — thử ở máy dev

```dotenv
# frontend/.env.local
VITE_CONG_DON_VI_HOSTNAME=donvi.localhost
VITE_CONG_DON_VI_URL=http://donvi.localhost:5173
VITE_SITE_URL=http://localhost:5173
```

`npm run dev` → `http://localhost:5173` là trang NLS, `http://donvi.localhost:5173` là Cổng đơn vị (dev server phục vụ `index.html` cho cả 2 nên tiêu đề tĩnh là của NLS; tiêu đề tab do JS đặt lại). Nếu `VITE_API_BASE_URL=http://localhost:3000`, thêm `http://donvi.localhost:5173` vào `CORS_ORIGIN` của backend dev.
