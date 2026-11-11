# Runbook deploy — Vào học VLE (external-login P.CNTT) + lượt vào VLE (CÓ migration)

> Đây là **lệnh để người vận hành tự chạy trên VPS**. Trợ lý không SSH, không deploy, không chạy lệnh trên VPS.

Đợt này đưa lên PR #38 (`feat/vle-external-login`) — **phải merge vào `main` trước** (`06-deploy.sh` chỉ kéo `main`).

| Thay đổi | Ảnh hưởng dữ liệu |
|---|---|
| Bảng mới `dang_nhap_vle` (username/email đăng nhập VLE theo học viên) + loại import `dang_nhap_vle` ("Tài khoản đăng nhập VLE (username / email)") | **2 migration, chỉ thêm**: `20261110090000_dang_nhap_vle_enum` (`ALTER TYPE loai_danh_muc_import ADD VALUE`), `20261110090100_dang_nhap_vle_table` (`CREATE TABLE`). Không sửa dữ liệu cũ |
| `GET /sso/vle/trang-thai`, `POST /sso/vle/form` (mục 10.2 `docs/api-contract.md`); nút **"Vào học VLE"** ở thẻ lớp VLE (ẩn link "Vào học"/"Địa điểm" từng buổi của lớp VLE) | Mỗi lần bấm ghi 1 dòng `nhat_ky_hoat_dong` (`vao_hoc_vle`: `khop_theo`, `id_course`, `ip`) — không ghi khóa |
| Báo cáo **Tình hình đi học**: cột "Vào VLE"; Excel thêm "Số lần vào VLE", "Vào VLE gần nhất" | **Chỉ đọc** nhật ký. Lượt vào VLE **không phải điểm danh** |

Không route prefix mới (`/sso`, `/import` đã có trong Nginx). Gián đoạn: backend 3–5 giây lúc `pm2 reload`.

**Công tắc tắt/bật:** `VLE_LOGIN_KEY` trống → nút ẩn hẳn, `POST /sso/vle/form` trả `503`. Vì vậy deploy theo 3 nhịp: (A) đưa code lên với khóa **trống** → (B) import username → (C) điền khóa, reload. Học viên chỉ thấy nút khi đã được **xếp lớp VLE** (`loai_lop = vle`).

Mọi lệnh chạy trên VPS bằng user thường (không sudo). Repo: `~/apps/boi-duong-nls`.

## 1. Ghi lại trạng thái + backup

```bash
cd ~/apps/boi-duong-nls
git log -1 --oneline | tee ~/truoc-deploy-vle-$(date +%F).txt
export DB_URL="$(grep '^DATABASE_URL=' backend/.env | cut -d= -f2- | tr -d '"' | sed 's/?.*//')"
mkdir -p ~/backups/postgres
F=~/backups/postgres/truoc-vle-$(date +%F-%H%M).dump
(umask 077; pg_dump "$DB_URL" -Fc -f "$F") && ls -lh "$F"
test -s "$F" || { echo "Dump rỗng — DỪNG"; exit 1; }
unset DB_URL
```

## 2. Kéo code + xác nhận migration chờ

```bash
git pull origin main && git log --oneline -3
cd backend && npx prisma migrate status
```

Kỳ vọng: **đúng 2** migration chờ là `20261110090000_dang_nhap_vle_enum` và `20261110090100_dang_nhap_vle_table`. Có migration khác chờ, hoặc báo drift → **DỪNG**, báo lại.

## 3. Thêm biến môi trường (khóa để TRỐNG)

`06-deploy.sh` giữ nguyên `backend/.env` đã có nên phải thêm tay. **Không** đụng `VLE_SECRET_KEY` (khóa T15, khác hoàn toàn).

```bash
cd ~/apps/boi-duong-nls/backend
grep -q '^VLE_LOGIN_URL=' .env || cat >> .env <<'EOF'

# Vào học VLE (external-login P.CNTT) — docs/api-contract.md mục 10.2
VLE_LOGIN_URL=https://vlebdhvs.hcmue.edu.vn/users/external-login
VLE_LOGIN_KEY=
VLE_COURSE_MAP=co_ban:4096,thanh_thao:4155,nang_cao:4154
EOF
chmod 600 .env
grep -E '^VLE_(LOGIN_URL|COURSE_MAP)=|^TRUST_PROXY=' .env
grep -c '^VLE_LOGIN_KEY=$' .env   # phải ra 1 (khóa đang trống)
```

`thanh_thao:4155` đã thử thật; `co_ban:4096`, `nang_cao:4154` chờ P.CNTT xác nhận — sai id thì VLE chỉ đưa về `/dashboard`, không vào nhầm khóa. Thiếu `TRUST_PROXY` → nhật ký ghi IP proxy; thêm `TRUST_PROXY=loopback,10.0.197.1` (xem `06-deploy.sh`).

## 4. Deploy (nhịp A — nút còn ẩn)

```bash
cd ~/apps/boi-duong-nls/scripts/vps
bash 06-deploy.sh 2>&1 | tee ~/deploy-vle-$(date +%F-%H%M).log
grep -E 'migration|Applying|CANH BAO|LOI' ~/deploy-vle-*.log | tail
cd ~/apps/boi-duong-nls/backend && npx prisma migrate status   # "Database schema is up to date!"
pm2 logs boiduongnls-backend --lines 50 --nostream
```

Kiểm tra: đăng nhập học viên có lớp VLE → thẻ lớp **không** có nút "Vào học VLE" (đúng, khóa trống), link từng buổi của lớp VLE đã ẩn; lớp Zoom/trực tiếp vẫn có "Vào học". Trang Tình hình đi học có cột "Vào VLE" (toàn `—`).

## 5. Import tài khoản VLE (nhịp B)

Quản trị → **Nhập dữ liệu** → loại **"Tài khoản đăng nhập VLE (username / email)"** → file `import-dang-nhap-vle-AG2026.xlsx` (7.410 dòng; trang nhập chỉ đọc sheet đầu, sheet `ngoai_le` tự bỏ qua — giữ `ngoai_le` là sheet thứ hai) → Xem trước → sửa dòng lỗi nếu có → Xác nhận.

- Ô trống giữ giá trị cũ; trùng username/email giữa 2 học viên → lỗi dòng (không ghi).
- File có email/username học viên — không để lại trên VPS, không gửi nhóm Zalo công khai.
- Đếm sau import (không in dữ liệu cá nhân):

```bash
psql "$(grep '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"' | sed 's/?.*//')" -Atc \
  "SELECT count(*), count(username), count(email_chup) FROM dang_nhap_vle;"
```

## 6. Bật khóa (nhịp C)

Khóa P.CNTT gửi riêng — **không** dán vào lệnh (tránh lưu lịch sử shell), không commit, không gửi qua chat.

```bash
cd ~/apps/boi-duong-nls/backend
nano .env          # điền VLE_LOGIN_KEY=<khóa> , lưu
chmod 600 .env
grep -c '^VLE_LOGIN_KEY=.\+' .env   # phải ra 1 — KHÔNG in giá trị
pm2 reload boiduongnls-backend --update-env
pm2 logs boiduongnls-backend --lines 30 --nostream
```

## 7. Kiểm tra sau khi bật

1. Tài khoản học viên test (mức Thành thạo, đã xếp lớp VLE) → thẻ lớp VLE có **"Vào học VLE"** + "Chưa vào VLE lần nào" → bấm → vào thẳng khóa **Thành thạo** trên VLE (về `/dashboard` = sai `id_course` hoặc học viên chưa có trong lớp của khóa đó ở VLE).
2. Quay lại tab boiduongnls → dòng đổi thành "Đã vào VLE 1 lần · gần nhất …".
3. Nhật ký không chứa khóa:

```bash
psql "$(grep '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"' | sed 's/?.*//')" -Atc \
  "SELECT thoi_gian, chi_tiet FROM nhat_ky_hoat_dong WHERE hanh_dong='vao_hoc_vle' ORDER BY thoi_gian DESC LIMIT 3;"
```

`chi_tiet` chỉ có `khop_theo`, `id_course`, `ip`.

4. Học viên chưa có username/email trong `dang_nhap_vle` → nút mờ kèm "Chưa có tài khoản VLE…".
5. Tình hình đi học (hỗ trợ/Quản trị) → cột "Vào VLE" của học viên test = "1 lần"; xuất Excel có 2 cột mới.

## 8. Quay lui

- **Tắt nhanh** (không cần deploy): xóa giá trị `VLE_LOGIN_KEY` trong `.env` → `pm2 reload boiduongnls-backend --update-env` → nút ẩn ngay.
- **Gỡ code**: trên máy dev `git revert -m 1 <merge-commit PR #38>` → push `main` → VPS `git pull origin main && cd scripts/vps && bash 06-deploy.sh`. Bảng `dang_nhap_vle` và giá trị enum `dang_nhap_vle` để nguyên (vô hại, Postgres không gỡ được giá trị enum). **Không** restore DB — sẽ mất dữ liệu phát sinh sau backup.
