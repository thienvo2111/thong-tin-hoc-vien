# Runbook deploy — Học viên đề nghị đổi buổi học (ADR 0007)

> Đây là **lệnh để người vận hành tự chạy trên VPS**. Trợ lý không SSH, không deploy, không chạy lệnh trên VPS.

Đưa VPS lên `main` có tính năng đổi buổi học. Thay đổi chính:

| Nội dung | Ảnh hưởng dữ liệu |
|---|---|
| Học viên đề nghị học 1 buổi ở lớp khác; người hỗ trợ cụm / Quản trị duyệt (`/doi-buoi-hoc`, `/hoc-vien/toi/doi-buoi`) | **Migration** `20261016120000_doi_buoi_hoc`: **chỉ thêm** bảng `doi_buoi_hoc` + cột `khoa_boi_duong.so_buoi_doi_toi_da SMALLINT NOT NULL DEFAULT 0` (CHECK 0–50). **Không sửa/xóa dòng cũ** |

Route mới dùng prefix `doi-buoi-hoc` (chưa có trong Nginx) → **phải chạy lại `05-install-nginx.sh`** (mục 4).
Prefix `/hoc-vien` đã có. Không đổi `.env`.

Học viên đang dùng → làm **sau 22h**. Dự kiến 10–15 phút. Gián đoạn: backend 3–5 giây lúc `pm2 reload`.

Mọi lệnh chạy trên VPS bằng user thường (không sudo) trừ khi ghi `sudo`. Repo: `~/apps/boi-duong-nls`.

---

## ⚠️ Cảnh báo dữ liệu

1. Migration chỉ `CREATE TABLE` + `ADD COLUMN ... DEFAULT 0`. Sau deploy mọi khóa có `so_buoi_doi_toi_da = 0`
   → **tính năng TẮT cho mọi khóa** cho tới khi Quản trị đặt số lượt (trang chi tiết khóa). Học viên gọi API nhận `403`
   "Khóa học chưa mở đề nghị đổi buổi"; trang `/de-nghi-doi-buoi` hiện thông báo. Hành vi mọi màn khác y như cũ.
2. Khi bật cho một khóa, các màn đọc theo **buổi** (trang lớp, điểm danh, Zoom, chuyên cần, báo vắng, nhắc lịch) bắt đầu tính
   đề nghị `da_duyet`; số liệu theo **lớp** giữ nguyên lớp gốc.
3. Quay lui code: code cũ bỏ qua bảng/cột mới (Prisma chỉ đọc cái nó biết) → không lỗi, chỉ mất tính năng. Không cần gỡ
   bảng. Xem mục 7.

## 1. Ghi lại trạng thái + backup (TRƯỚC khi deploy)

```bash
cd ~/apps/boi-duong-nls
git rev-parse --short HEAD | tee ~/truoc-deploy-$(date +%F).txt
git status --short
export DB_URL="$(grep '^DATABASE_URL=' backend/.env | cut -d= -f2- | tr -d '"' | sed 's/?.*//')"
(umask 077; pg_dump "$DB_URL" -Fc -f ~/backups/postgres/truoc-doi-buoi-hoc-$(date +%F-%H%M).dump) && ls -lh ~/backups/postgres/ | tail -3
```

Mật khẩu lấy từ `DATABASE_URL` trong `backend/.env` (bỏ đuôi `?schema=public` vì `pg_dump`/`psql` không nhận) —
**không** dùng `-U` để tránh bị hỏi mật khẩu. File dump phải có dung lượng hợp lý (không 0 byte).
`git status` có file sửa trên VPS → `git stash` trước bước 2, `git stash pop` sau đó.

## 2. Kéo code + kiểm tra migration chờ

```bash
git pull origin main && git log --oneline -1
cd backend && npx prisma migrate status
```

Kỳ vọng chưa áp (có thể kèm các migration của lần deploy trước nếu chưa chạy — xem
`docs/deploy/2026-10-09-dieu-chinh-muc-hoc.md`):

```
20261016120000_doi_buoi_hoc
```

Thấy migration lạ hoặc báo drift → **DỪNG**.

## 3. Deploy

```bash
cd ~/apps/boi-duong-nls/scripts/vps
bash 06-deploy.sh 2>&1 | tee ~/deploy-$(date +%F-%H%M).log
```

Script: `npm ci` → `prisma generate` → build → `migrate deploy` → `pm2 reload` → build frontend → chép asset →
thay `index.html`. Cảnh báo "Nginx CHUA proxy cac prefix" (thiếu `doi-buoi-hoc`) là **bình thường** — xử lý ở mục 4.

## 4. Cập nhật Nginx (prefix `doi-buoi-hoc`)

```bash
sudo bash ~/apps/boi-duong-nls/scripts/vps/05-install-nginx.sh
sudo nginx -t && sudo systemctl reload nginx
```

## 5. Kiểm tra sau deploy

```bash
export DB_URL="$(grep '^DATABASE_URL=' ~/apps/boi-duong-nls/backend/.env | cut -d= -f2- | tr -d '"' | sed 's/?.*//')"
psql "$DB_URL" -c "SELECT count(*) FROM doi_buoi_hoc;"                                   # kỳ vọng 0
psql "$DB_URL" -c "SELECT count(*) FROM khoa_boi_duong WHERE so_buoi_doi_toi_da <> 0;"   # kỳ vọng 0
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" https://boiduongnls.hcmue.edu.vn/doi-buoi-hoc/dem-cho-duyet
pm2 logs boiduongnls-backend --lines 100 --nostream
```

- Hai truy vấn đều phải ra `0` (không đổi dữ liệu cũ, mọi khóa đang tắt).
- `curl`: kỳ vọng `401 application/json`. Thấy `200 text/html` → Nginx chưa proxy prefix → làm lại mục 4.
- `pm2 logs` không có lỗi lặp lại.
- Quản trị: mở một khóa thử → đặt số lượt (vd 1) → học viên thử mở `/de-nghi-doi-buoi`; sau khi thử xong **đặt về 0** nếu chưa muốn mở.

## 6. Bật cho khóa nào

Tính năng **TẮT cho mọi khóa** sau deploy. Chỉ khi Quản trị đặt `so_buoi_doi_toi_da` > 0 trong cấu hình khóa
thì học viên của khóa đó mới thấy lối vào và gửi được đề nghị. Báo người hỗ trợ cụm trước khi bật (họ duyệt ở
menu **Đổi buổi**, có badge số chờ).

## 7. Quay lui (nếu cần)

Code cũ chạy được trên schema mới → quay lui code **không cần** khôi phục DB:

```bash
# Máy dev: revert merge commit trên main rồi push
git revert -m 1 <merge-commit> && git push
# VPS:
cd ~/apps/boi-duong-nls && git pull origin main
cd scripts/vps && bash 06-deploy.sh
```

Nếu muốn gỡ hẳn schema (chỉ khi chắc chắn không còn dữ liệu đổi buổi cần giữ — mất toàn bộ đề nghị):

```sql
DROP TABLE doi_buoi_hoc;
ALTER TABLE khoa_boi_duong DROP COLUMN so_buoi_doi_toi_da;
```

Rồi đánh dấu migration đã gỡ để `migrate deploy` không lệch: `npx prisma migrate resolve --rolled-back 20261016120000_doi_buoi_hoc`.
Chỉ khôi phục DB từ bản dump ở mục 1 khi **dữ liệu bị sai** (không phải khi chỉ lỗi giao diện).

## 8. Sau deploy

- [ ] Ghi commit đã deploy vào ghi chú dự án.
- [ ] Báo người hỗ trợ cụm cách duyệt đổi buổi trước khi bật cho khóa đầu tiên.
