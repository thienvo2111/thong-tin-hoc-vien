# Runbook deploy — Cổng đơn vị: danh sách tham gia + hợp đồng bồi dưỡng (ADR 0015, issues #55–#71) — CÓ migration

> Đây là **lệnh để người vận hành tự chạy trên VPS**. Trợ lý không SSH, không deploy, không chạy lệnh trên VPS.
> `06-deploy.sh` chỉ kéo `main` — nhánh `claude/student-info-training-contract-ce8953` phải được merge vào `main` trước.

Deploy theo **2 nhịp**:

- **Nhịp A — đưa code + migration lên, Cổng đơn vị còn "ngủ"** (làm được ngay). `VITE_CONG_DON_VI_HOSTNAME` để trống → bản build chạy **y như trước** trên boiduongnls; các API `/cong-don-vi/*` có trên backend nhưng chưa có giao diện nào gọi tới.
- **Nhịp A+ — mở Cổng đơn vị TẠM ở `https://boiduongnls.hcmue.edu.vn/cdv`** (không cần tên miền mới; quyết định của người dùng 2026-11-23, sửa tạm ADR 0015 T7). Mục A+ dưới đây.
- **Nhịp B — bật Cổng đơn vị trên tên miền thứ hai** (chờ IT HCMUE cấp tên miền, issue #51). Theo `docs/deploy/2026-11-18-cong-don-vi-ten-mien.md` + mục B dưới đây. Đã làm A+ thì xem thêm mục A+8 (chuyển `/cdv` sang tên miền mới).

## Thay đổi và ảnh hưởng dữ liệu

| Thay đổi | Ảnh hưởng dữ liệu |
|---|---|
| Cổng đơn vị (chỉ hiện ở tên miền thứ hai): đợt triển khai HSG/NLS, nạp/sửa danh sách tham gia, trường xác nhận + đề nghị sửa, Hồ sơ đơn vị, hợp đồng (nháp/nộp/mở lại), hạn nộp + gia hạn riêng, tiến độ đợt, Excel KHTC, chụp danh sách NLS từ khóa, nhóm menu NLS, màn Sở/Phòng | **8 migration, chỉ thêm** (bảng/enum/cột mới NULL được hoặc có DEFAULT). Không sửa, không xóa dữ liệu cũ |
| `hoc-vien.service` (đường sửa hồ sơ của Quản trị) nhận thêm tham số tùy chọn cho đồng bộ ngược (issue #69) | Không — mọi chỗ gọi cũ không truyền tham số mới, hành vi như trước (e2e dot-xac-nhan, ho-tro-can-thiep, hoc-vien xanh) |
| Màn Admin Học viên / Khóa / Tổng quan: link nội bộ đi qua hàm đường dẫn (issue #70), mặc định vẫn `/admin/...` | Không |

8 migration (đều chỉ thêm):

| Migration | Nội dung |
|---|---|
| `20261119090000_dot_trien_khai` | enum `chuong_trinh_boi_duong`, bảng `dot_trien_khai` |
| `20261119150000_danh_sach_tham_gia` | enum `giai_doan_tham_gia`, bảng `danh_sach_tham_gia` (FK `hoc_vien_id` ON DELETE SET NULL) |
| `20261120090000_hop_dong_boi_duong` | 2 enum, bảng `hop_dong_boi_duong` + backfill từ `danh_sach_tham_gia` (prod đang rỗng → 0 dòng) |
| `20261121090000_de_nghi_sua_danh_sach` | 2 enum, bảng `de_nghi_sua_danh_sach` |
| `20261122090000_ho_so_don_vi` | bảng `ho_so_don_vi` |
| `20261123090000_hop_dong_phan_3_4` | ADD COLUMN vào `hop_dong_boi_duong` (Phần 3–4, nộp, bản chụp; `diem_hoc_truc_tiep` NOT NULL DEFAULT false) |
| `20261124090000_hop_dong_han_rieng` | ADD COLUMN `hop_dong_boi_duong.han_rieng` |
| `20261125090000_khoa_dot_trien_khai` | ADD COLUMN `khoa_boi_duong.dot_trien_khai_id` UUID NULL + FK + index |

Gián đoạn: backend 3–5 giây lúc `pm2 reload`. Mọi lệnh chạy bằng user thường (trừ chỗ ghi `sudo`). Repo: `~/apps/boi-duong-nls`.

---

## A. Nhịp A — code + migration (Cổng đơn vị chưa bật)

### A1. Ghi lại trạng thái + backup (bắt buộc, có migration)

```bash
cd ~/apps/boi-duong-nls
git log -1 --oneline | tee ~/truoc-cong-don-vi-$(date +%F).txt
export DB_URL="$(grep '^DATABASE_URL=' backend/.env | cut -d= -f2- | tr -d '"' | sed 's/?.*//')"
mkdir -p ~/backups/postgres
F=~/backups/postgres/truoc-cong-don-vi-$(date +%F-%H%M).dump
(umask 077; pg_dump "$DB_URL" -Fc -f "$F") && ls -lh "$F"
test -s "$F" || { echo "Dump rỗng — DỪNG"; exit 1; }
```

Số liệu đối chiếu trước/sau (chỉ đọc; giữ `DB_URL` cho các bước sau):

```bash
psql "$DB_URL" -At -c "SELECT 'hoc_vien', count(*) FROM hoc_vien UNION ALL SELECT 'khoa', count(*) FROM khoa_boi_duong UNION ALL SELECT 'dang_ky_hoc', count(*) FROM dang_ky_hoc UNION ALL SELECT 'nguoi_dung', count(*) FROM nguoi_dung;" | tee ~/dem-truoc-cong-don-vi-$(date +%F).txt
```

### A2. Kéo code + xác nhận migration chờ

```bash
git pull origin main && git log --oneline -3
cd backend && npx prisma migrate status
```

Kỳ vọng — một trong hai:

- **8** migration chờ, đúng 8 tên ở bảng trên → prod đã có đợt VLE (11/11). Tiếp A3.
- **11** migration chờ = 8 tên trên + `20261110090000_dang_nhap_vle_enum`, `20261110090100_dang_nhap_vle_table`, `20261111090000_mo_vao_hoc_vle` → đợt VLE **chưa** lên prod. Đọc trước `docs/deploy/2026-11-11-vao-hoc-vle.md` và `docs/deploy/2026-11-11-cong-tac-vao-hoc-vle.md` (để `VLE_LOGIN_KEY` trống = nút VLE ẩn; `mo_vao_hoc_vle` mặc định tắt) rồi mới tiếp.

Có migration lạ khác, hoặc báo drift → **DỪNG**, báo lại.

### A3. Nginx — thêm tiền tố `cong-don-vi` vào block đang chạy (sudo)

File site trên VPS sinh từ `05-install-nginx.sh` **cũ**, chưa có `cong-don-vi` (script trong repo đã có). Thiếu thì `/cong-don-vi/...` rơi vào `index.html` và API hỏng âm thầm.

```bash
F=/etc/nginx/sites-available/boiduongnls.hcmue.edu.vn
sudo cp "$F" "$F.bak-$(date +%F)"
grep -c 'cong-don-vi' "$F"     # 0 = chưa có
sudo sed -i 's/|doi-buoi-hoc) {/|doi-buoi-hoc|cong-don-vi) {/' "$F"
grep -n 'location ~ \^/(' "$F"  # dòng location phải kết thúc bằng ...|doi-buoi-hoc|cong-don-vi) {
sudo nginx -t && sudo systemctl reload nginx
```

> Nếu dòng `location ~ ^/(...)` trên VPS không kết thúc bằng `|doi-buoi-hoc) {` (lệch với repo), **đừng** dùng `sed`: sửa tay bằng `sudo nano "$F"`, thêm `|cong-don-vi` ngay trước `) {`.

Tùy chọn: thêm `client_max_body_size 2m;` vào block `server` (mặc định Nginx 1m; backend nhận JSON tối đa 1mb cho nạp danh sách HSG — file 682 GV chỉ ~150 KB nên chưa cần).

### A4. Deploy

```bash
cd ~/apps/boi-duong-nls/scripts/vps
bash 06-deploy.sh
```

Script tự backup (nếu có `07-setup-backup.sh`), chạy `prisma migrate deploy`, build, `pm2 reload`. Mục "Kiem tra Nginx da proxy du moi prefix" phải ra `OK` (sau A3).

### A5. Kiểm chứng

```bash
cd ~/apps/boi-duong-nls/backend && npx prisma migrate status            # "Database schema is up to date!"
psql "$DB_URL" -At -c "SELECT 'dot_trien_khai', count(*) FROM dot_trien_khai UNION ALL SELECT 'danh_sach_tham_gia', count(*) FROM danh_sach_tham_gia UNION ALL SELECT 'hop_dong', count(*) FROM hop_dong_boi_duong UNION ALL SELECT 'ho_so_don_vi', count(*) FROM ho_so_don_vi UNION ALL SELECT 'khoa co dot', count(*) FROM khoa_boi_duong WHERE dot_trien_khai_id IS NOT NULL;"
# Kỳ vọng: cả 5 dòng = 0
psql "$DB_URL" -At -c "SELECT 'hoc_vien', count(*) FROM hoc_vien UNION ALL SELECT 'khoa', count(*) FROM khoa_boi_duong UNION ALL SELECT 'dang_ky_hoc', count(*) FROM dang_ky_hoc UNION ALL SELECT 'nguoi_dung', count(*) FROM nguoi_dung;"
# So với file ~/dem-truoc-cong-don-vi-*.txt: phải KHÔNG giảm
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1/cong-don-vi/dot-trien-khai   # 401 = đã tới backend
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1/cong-don-vi/toi/chuong-trinh # 401
curl -s http://127.0.0.1/ | grep -o '<title>[^<]*'                                     # tiêu đề NLS như cũ
ls -l /var/www/boiduongnls/cong-don-vi.html
pm2 logs --lines 50 --nostream
unset DB_URL
```

Kiểm thử tay trên boiduongnls (phải **như trước**):

- Quản trị: Tổng quan → bấm vào học viên / khóa mở đúng trang `/admin/...`; breadcrumb "Khóa bồi dưỡng" về đúng danh sách.
- Quản trị sửa hồ sơ 1 học viên thử (ví dụ học viên của khóa TEST-001) → lưu được, lịch sử thay đổi hiện như cũ.
- Tài khoản trường/Sở vẫn đăng nhập boiduongnls bình thường (chưa bị chuyển sang cổng vì `VITE_CONG_DON_VI_HOSTNAME` trống).

### A6. Quay lui

- Code: `git checkout <commit ở ~/truoc-cong-don-vi-*.txt>` rồi `bash 06-deploy.sh` (lưu ý script sẽ `checkout main` lại — muốn giữ commit cũ thì chạy tay các bước build/copy, hoặc revert trên `main` rồi deploy).
- Migration: **không cần gỡ** — 8 migration chỉ thêm, code cũ không đọc bảng/cột mới. Chỉ khôi phục dump (`pg_restore`) khi dữ liệu cũ bị hỏng thật (không kỳ vọng).

---

## A+. Nhịp A+ — mở Cổng đơn vị tạm ở `https://boiduongnls.hcmue.edu.vn/cdv`

Cổng đơn vị chạy ở tiền tố đường dẫn `/cdv` **của chính boiduongnls** (cùng origin, dùng luôn HTTPS sẵn có) cho tới khi IT HCMUE cấp tên miền thứ hai. Cùng 1 bản build: frontend nhận ra Cổng đơn vị khi đường dẫn là `/cdv` hoặc `/cdv/...` (biến `VITE_CONG_DON_VI_DUONG_DAN`); mọi đường dẫn khác vẫn là trang NLS.

| Thay đổi | Ảnh hưởng dữ liệu |
|---|---|
| Frontend: chế độ đường dẫn `/cdv` (router `basename`), link "sang cổng đúng" trỏ `/cdv` | **Không migration, không sửa dữ liệu, không đổi backend** |
| Nginx: thêm 3 `location` vào block NLS (`/cdv/...` → `cong-don-vi.html`) | Không |
| Tài khoản `truong`/`so_gddt`/`phong_vhxh` **không dùng các trang NLS nữa** (thấy thông báo + link `/cdv`); học viên/hỗ trợ/giảng viên không vào được `/cdv`; `quan_tri` vào được cả 2 | Không (chặn ở frontend; quyền thật vẫn ở backend) |

Điều kiện: Nhịp A đã xong và `main` trên VPS đã có commit chế độ đường dẫn — `grep -c VITE_CONG_DON_VI_DUONG_DAN ~/apps/boi-duong-nls/frontend/src/vite-env.d.ts` ra `1`.

### A+1. Báo trước + đếm tài khoản bị ảnh hưởng (chỉ đọc)

Ngay khi bật, đơn vị đang dùng boiduongnls phải chuyển sang `https://boiduongnls.hcmue.edu.vn/cdv` — **báo trước** cho trường/Sở/Phòng. Đếm số tài khoản và ghi commit đang chạy:

```bash
cd ~/apps/boi-duong-nls
export DB_URL="$(grep '^DATABASE_URL=' backend/.env | cut -d= -f2- | tr -d '"' | sed 's/?.*//')"
psql "$DB_URL" -c "SELECT vai_tro, count(*) FROM nguoi_dung WHERE vai_tro IN ('truong','so_gddt','phong_vhxh') GROUP BY 1;"
unset DB_URL
git log -1 --oneline | tee ~/truoc-cdv-$(date +%F).txt
```

### A+2. Nginx — thêm 3 `location` vào block NLS đang chạy (sudo)

File site trên VPS sinh từ `05-install-nginx.sh` cũ nên phải sửa tay (script trong repo đã có sẵn 3 block này — chạy lại script cũng sinh đúng như vậy):

```bash
F=/etc/nginx/sites-available/boiduongnls.hcmue.edu.vn
sudo cp "$F" "$F.bak-cdv-$(date +%F-%H%M)"
grep -n 'location = /index.html\|location = /cdv\|cong-don-vi.html\|max-age=' "$F"
sudo nano "$F"
```

- `grep` đã thấy `location = /cdv` hoặc `location = /cong-don-vi.html` trong block NLS → đã có, **không** thêm lần nữa (`location` trùng thì `nginx -t` báo lỗi).
- Dán ngay **sau** khối `location = /index.html { ... }`, bên trong `server { ... }` của boiduongnls. Thay `86400` bằng giá trị `max-age=` đang dùng trong file:

```nginx
    # Cổng đơn vị tạm ở /cdv (ADR 0015 T7). absolute_redirect off: Location tương đối, không bị đổi thành http://.
    location = /cdv {
        absolute_redirect off;
        return 301 /cdv/;
    }

    location /cdv/ {
        try_files $uri /cong-don-vi.html;
    }

    location = /cong-don-vi.html {
        add_header Cache-Control "no-cache" always;
        add_header Strict-Transport-Security "max-age=86400" always;
    }
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

`/cdv` không trùng và không bị nuốt bởi tiền tố API nào trong `location ~ ^/(...)` (`backend/src/nginx-prefix.spec.ts` kiểm). Asset của Vite nằm ở `/assets/...` (gốc origin, không dưới `/cdv`) nên vẫn đi qua các `location` cũ.

### A+3. `frontend/.env` (VPS)

```bash
cd ~/apps/boi-duong-nls/frontend
cp .env .env.bak-cdv-$(date +%F)
nano .env
```

```dotenv
VITE_SITE_URL=https://boiduongnls.hcmue.edu.vn
VITE_CONG_DON_VI_HOSTNAME=
VITE_CONG_DON_VI_DUONG_DAN=/cdv
VITE_CONG_DON_VI_URL=https://boiduongnls.hcmue.edu.vn/cdv
```

- `VITE_CONG_DON_VI_HOSTNAME` để **trống** (chưa có tên miền).
- `VITE_CONG_DON_VI_DUONG_DAN` phải khớp tiền tố trong Nginx (`/cdv`); giá trị được chuẩn hóa (`cdv/`, `/CDV` đều thành `/cdv`).
- `VITE_CONG_DON_VI_URL`: link "Mở Cổng đơn vị" ở trang NLS + `og:url` của `cong-don-vi.html` (ảnh chia sẻ vẫn lấy ở gốc origin). Để trống thì frontend tự suy `origin + /cdv`.
- `VITE_API_BASE_URL` giữ nguyên (cùng origin, không ảnh hưởng).
- Như B2: có SĐT hỗ trợ thật thì điền vào `frontend/src/content/congDonVi.ts` trên `main` trước khi build.

### A+4. Build + đưa lên

```bash
cd ~/apps/boi-duong-nls/scripts/vps
bash 06-deploy.sh
```

Đổi biến `VITE_*` **bắt buộc build lại** (biến nhúng lúc build). Lần này không có migration mới (`prisma migrate deploy` không làm gì).

### A+5. Kiểm chứng

```bash
curl -s http://127.0.0.1/cdv/ | grep -o '<title>[^<]*'                       # Cổng đơn vị – Bồi dưỡng giáo viên HCMUE
curl -s http://127.0.0.1/cdv/quan-tri/hop-dong | grep -o '<title>[^<]*'      # deep link → cũng Cổng đơn vị
curl -s http://127.0.0.1/ | grep -o '<title>[^<]*'                           # Bồi dưỡng năng lực số cho giáo viên
curl -s http://127.0.0.1/dang-nhap | grep -o '<title>[^<]*'                  # NLS như cũ
curl -sI http://127.0.0.1/cdv | grep -i '^location'                          # Location: /cdv/ (tương đối)
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1/cong-don-vi/dot-trien-khai   # 401 = API vẫn tới backend
grep -o 'src="/assets/[^"]*' /var/www/boiduongnls/cong-don-vi.html | head -1  # asset tuyệt đối /assets/...
```

Trên trình duyệt (điện thoại, trình duyệt Zalo, 360px):

- `https://boiduongnls.hcmue.edu.vn/cdv` → màn đăng nhập Cổng đơn vị; tài khoản trường → đổi mật khẩu lần đầu → `/cdv/trang-chu`; bấm menu, F5 ở `/cdv/...` vẫn đúng trang.
- `https://boiduongnls.hcmue.edu.vn/` và `/dang-nhap` → trang NLS như cũ; học viên đăng nhập như trước.
- Tài khoản trường đăng nhập ở `/dang-nhap` (NLS) → "Tài khoản đơn vị đăng nhập tại Cổng đơn vị" + link `https://boiduongnls.hcmue.edu.vn/cdv`.
- Học viên đăng nhập ở `/cdv` → "Tài khoản này dùng trên trang Bồi dưỡng năng lực số" + link về trang NLS.

### A+6. Hệ quả người dùng thấy

- Đơn vị (trường/Sở/Phòng) **không vào các trang NLS** nữa — dùng nhóm menu **NLS** trong `/cdv`. Báo trước (A+1).
- Cùng origin ⇒ **chung phiên trong 1 tab** (token ở `sessionStorage`): đăng nhập ở `/cdv` rồi mở `/` trong cùng tab sẽ thấy thông báo sai cổng (và ngược lại); Đăng xuất ở bên nào cũng là đăng xuất cả hai trong tab đó. Tab mới vẫn độc lập.
- Email đặt lại mật khẩu/kích hoạt vẫn dẫn về trang NLS (`FRONTEND_URL`), như runbook 18/11.

### A+7. Quay lui

Không có dữ liệu để khôi phục. Trong `frontend/.env` để **trống** `VITE_CONG_DON_VI_DUONG_DAN` (và `VITE_CONG_DON_VI_URL`), chạy lại `bash 06-deploy.sh` → mọi tài khoản dùng trang NLS như trước. 3 `location` Nginx để nguyên cũng vô hại (`/cdv/...` chỉ ra trang "Không tìm thấy trang"); muốn gỡ hẳn thì khôi phục `$F.bak-cdv-*` rồi `sudo nginx -t && sudo systemctl reload nginx`.

### A+8. Khi có tên miền thứ hai (về chế độ hostname — chỉ đổi cấu hình)

1. Làm runbook `2026-11-18-cong-don-vi-ten-mien.md` (server block thứ hai, `VITE_CONG_DON_VI_HOSTNAME=TEN_MIEN_CONG_DON_VI`, `VITE_CONG_DON_VI_URL=https://TEN_MIEN_CONG_DON_VI`), **để trống** `VITE_CONG_DON_VI_DUONG_DAN`, build + deploy.
2. Trong block NLS, thay 2 `location` `/cdv` bằng chuyển hướng sang tên miền mới (giữ link Zalo/bookmark cũ); `location = /cong-don-vi.html` giữ nguyên:

   ```nginx
   location = /cdv { return 301 https://TEN_MIEN_CONG_DON_VI/; }
   location /cdv/ { rewrite ^/cdv/(.*)$ https://TEN_MIEN_CONG_DON_VI/$1 permanent; }
   ```

   `sudo nginx -t && sudo systemctl reload nginx`. Phiên đăng nhập không đi theo (khác origin) — đơn vị đăng nhập lại 1 lần.

---

## B. Nhịp B — bật Cổng đơn vị (khi có tên miền)

Điều kiện: IT HCMUE đã cấp `TEN_MIEN_CONG_DON_VI`, trỏ về VPS và **giữ nguyên header `Host`** (issue #51).

1. Làm đủ các bước 0–5 của `docs/deploy/2026-11-18-cong-don-vi-ten-mien.md` (env `VITE_*`, `VITE_API_BASE_URL` rỗng, block Nginx thứ hai — block đó đã có `cong-don-vi` trong danh sách tiền tố, build + deploy, kiểm chứng `Host`).
2. **Trước khi build:** điền SĐT hỗ trợ thật vào `frontend/src/content/congDonVi.ts` (`soDienThoaiHoTro`, hiện "(chưa cập nhật)") — commit lên `main`, rồi deploy. Thiếu thì màn trường chỉ ghi "liên hệ HCMUE".
3. Báo trước cho các đơn vị: ngay khi bật, tài khoản `truong` / `so_gddt` / `phong_vhxh` **không vào boiduongnls nữa** mà dùng Cổng đơn vị (đếm số tài khoản ở bước 1 của runbook 18/11). Sở/Phòng/trường có học viên NLS thấy nhóm menu **NLS** (Tổng quan, Học viên, Khóa, Báo cáo) trên cổng.
4. Vận hành đợt HSG An Giang 2026 (Quản trị, trên Cổng đơn vị):
   1. Chương trình / Đợt → tạo đợt HSG (Sở An Giang, đơn giá, khoảng ngày QĐ, hạn nộp).
   2. Danh sách tham gia → tải mẫu, nạp Excel HSG (xem trước, chọn tay trường không khớp).
   3. Đơn vị & tài khoản → nhập tài khoản trường (chỉ trường có trong danh sách — T4), gửi mật khẩu riêng từng trường.
   4. Theo dõi ở **Tiến độ đợt**; gia hạn riêng khi cần; xuất Excel trường chưa xong để nhắc.
   5. Hợp đồng → **Xuất Excel cho KHTC** khi các trường đã nộp.
5. Kiểm thử trên điện thoại (trình duyệt Zalo, 360px): trường đăng nhập → đổi mật khẩu → Hồ sơ đơn vị (ô QHNS hiện STK `HCMUE…`) → Đồng ý/Không đồng ý → Xác nhận → Thông tin hợp đồng → Nộp.

## Việc còn mở (không chặn nhịp A)

- **Thứ tự cột sheet "Hợp đồng" (Excel KHTC)** chưa đối chiếu với bảng câu trả lời Google Form thật — sửa ở một chỗ: `COT_HOP_DONG_KHTC` trong `backend/src/cong-don-vi/xuat-khtc.ts`.
- Màn Danh mục trường hiện nút "Sửa địa bàn" cho Sở/Phòng nhưng API chỉ cho Quản trị (bấm → 403) — giống boiduongnls hiện nay.
- `06-deploy.sh` copy `cong-don-vi.html` không nguyên tử (rủi ro nhỏ, xem runbook 18/11 mục 4).
- Email (đặt lại mật khẩu, kích hoạt) vẫn dẫn về tên miền NLS (`FRONTEND_URL`); trên cổng ghi "Quên mật khẩu? Liên hệ HCMUE".
