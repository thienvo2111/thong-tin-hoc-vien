# Runbook deploy — Đợt nhu cầu mức học (ADR 0013)

> Đây là **lệnh để người vận hành tự chạy trên VPS**. Trợ lý không SSH, không deploy, không chạy lệnh trên VPS.

Đưa VPS lên `main` có tính năng Đợt nhu cầu mức học (Quản trị tạo đợt theo khóa; học viên chọn mức ≤ mốc; thống kê + Excel theo đợt). Prod hiện tại: kiểm tra `git log -1` trên VPS (bước 1) — lần deploy gồm mọi commit chưa deploy.

| Thay đổi | Ảnh hưởng dữ liệu |
|---|---|
| Migration `20261020100000_dot_nhu_cau_muc` | **CÓ migration, chỉ THÊM**: enum `nguon_moc_nhu_cau` + bảng `dot_nhu_cau_muc` + bảng `nhu_cau_muc_hoc_vien` + 2 CHECK. **Không sửa/xóa dòng cũ**; không đụng `dang_ky_hoc` |
| 10 route mới (`/khoa-boi-duong/:id/dot-nhu-cau-muc`, `/dot-nhu-cau-muc/*`, `/hoc-vien/toi/nhu-cau-muc*`, `/thong-ke/nhu-cau-muc-dot*`) | Không đổi route cũ; không prefix mới ở Nginx |
| Nhật ký mới `xuat_nhu_cau_muc_dot` | Chỉ ghi thêm vào `nhat_ky` |

Không đổi `.env`. **Tính năng TẮT cho tới khi Quản trị tạo đợt** (chưa có dòng nào trong `dot_nhu_cau_muc` thì học viên không thấy gì). Tính năng **không đổi xếp lớp**.

Làm **sau 22h**. Dự kiến 10 phút. Gián đoạn: backend 3–5 giây lúc `pm2 reload`. `CREATE TABLE`/`CREATE TYPE` không khóa bảng cũ.

Mọi lệnh chạy trên VPS bằng user thường (không sudo). Repo: `~/apps/boi-duong-nls`.

---

## ⚠️ Cảnh báo dữ liệu

1. Migration chỉ thêm → migration không xóa/sửa dòng nào; số dòng bảng cũ (đặc biệt `dang_ky_hoc`) sau deploy phải **≥** trước deploy (có thể tăng nhẹ do hệ thống đang chạy).
2. Hai bảng mới ban đầu rỗng. Khi Quản trị tạo đợt và học viên chọn, dữ liệu nằm **chỉ** trong `nhu_cau_muc_hoc_vien`.
3. **Quay lui schema làm mất toàn bộ nhu cầu đã thu** (mục 7) → backup 2 bảng đó trước khi gỡ.
4. Xóa khóa → các đợt + lựa chọn của khóa bị xóa theo (`ON DELETE CASCADE`).

## 1. Ghi lại trạng thái + backup (TRƯỚC khi deploy)

```bash
cd ~/apps/boi-duong-nls
git log -1 --oneline | tee ~/truoc-deploy-dot-nhu-cau-$(date +%F).txt     # ghi lại commit prod hiện tại
git status --short
export DB_URL="$(grep '^DATABASE_URL=' backend/.env | cut -d= -f2- | tr -d '"' | sed 's/?.*//')"
mkdir -p ~/backups/postgres
F=~/backups/postgres/truoc-dot-nhu-cau-$(date +%F-%H%M).dump
(umask 077; pg_dump "$DB_URL" -Fc -f "$F") && ls -lh "$F"
test -s "$F" || { echo "Dump rỗng — DỪNG"; exit 1; }
psql "$DB_URL" -c "SELECT count(*) FROM dang_ky_hoc;" | tee ~/truoc-dot-nhu-cau-dem.txt
unset DB_URL
```

Mật khẩu lấy từ `DATABASE_URL` trong `backend/.env` (bỏ đuôi `?schema=public`) — **không** dùng `-U` để tránh bị hỏi mật khẩu. Lệnh `test -s` ở trên là chốt chặn cứng: dump rỗng thì **DỪNG**, không sang bước 2. `git status` có file sửa trên VPS → `git stash` trước bước 2, `git stash pop` sau đó.

## 2. Kéo code + kiểm tra migration chờ

```bash
git pull origin main && git log --oneline -1
cd backend && npx prisma migrate status
```

`prisma migrate status` thoát mã khác 0 khi còn migration chờ áp — **bình thường ở đây**. Kỳ vọng chỉ `20261020100000_dot_nhu_cau_muc` đang chờ. Có migration chờ nào khác, hoặc báo drift → **DỪNG**.

## 3. Deploy

```bash
cd ~/apps/boi-duong-nls/scripts/vps
bash 06-deploy.sh 2>&1 | tee ~/deploy-dot-nhu-cau-$(date +%F-%H%M).log
```

Script: `npm ci` → `prisma generate` → build → chạy `backup-postgres.sh` nếu đã cài (backup thêm, vô hại) → `npx prisma migrate deploy` → `prisma db seed` (idempotent, bỏ qua nếu đã có tài khoản quan_tri; vô hại) → `pm2 reload` → build frontend → chép asset → thay `index.html`. Nếu cần chạy tay từng bước: `cd backend && npx prisma migrate deploy`, build backend/frontend, rồi `pm2 reload boiduongnls-backend`. Script không reload được Nginx khi không có sudo — lần này **không cần** reload Nginx (không prefix route mới).

## 4. Kiểm tra sau deploy

```bash
export DB_URL="$(grep '^DATABASE_URL=' ~/apps/boi-duong-nls/backend/.env | cut -d= -f2- | tr -d '"' | sed 's/?.*//')"
psql "$DB_URL" -c "SELECT count(*) FROM dot_nhu_cau_muc;"            # kỳ vọng 0
psql "$DB_URL" -c "SELECT count(*) FROM nhu_cau_muc_hoc_vien;"       # kỳ vọng 0
psql "$DB_URL" -c "SELECT count(*) FROM dang_ky_hoc;"                 # phải ≥ ~/truoc-dot-nhu-cau-dem.txt
psql "$DB_URL" -c "SELECT migration_name, finished_at FROM _prisma_migrations WHERE migration_name = '20261020100000_dot_nhu_cau_muc';"
psql "$DB_URL" -c "SELECT conname FROM pg_constraint WHERE conname IN ('chk_dot_nhu_cau_muc_thoi_gian','chk_nhu_cau_muc_chon_le_moc');"  # 2 dòng
pm2 logs boiduongnls-backend --lines 100 --nostream
unset DB_URL
```

- `dot_nhu_cau_muc` = 0 và `nhu_cau_muc_hoc_vien` = 0; số dòng `dang_ky_hoc` phải **≥ số đã lưu** (hệ thống đang chạy nên có thể tăng nhẹ; migration không bao giờ làm giảm). Thấp hơn → **DỪNG**, không làm gì thêm, báo lại.
- `_prisma_migrations` có dòng với `finished_at` không NULL. `pm2 logs` không có lỗi lặp lại.
- Học viên đăng nhập: trang `/toi` **không** hiện thẻ nhu cầu (chưa có đợt) — đúng.

## 5. Bật cho khóa nào

Quản trị → chi tiết khóa → mục **Đợt nhu cầu mức học** → tạo đợt (tên, mở lúc, đóng lúc; các đợt cùng khóa không chồng giờ). Nên thử đợt ngắn trên khóa thử: học viên thấy thẻ ở `/toi`, chọn mức ≤ mốc, đổi được tới khi đóng; Thống kê → tab nhu cầu theo đợt + Excel khớp. Đúng hết mới mở cho khóa thật. Đợt đã có dữ liệu thì không xóa được (chỉ đóng).

## 6. Kiểm tra định kỳ sau khi bật

```bash
export DB_URL="$(grep '^DATABASE_URL=' ~/apps/boi-duong-nls/backend/.env | cut -d= -f2- | tr -d '"' | sed 's/?.*//')"
psql "$DB_URL" -c "SELECT d.ten_dot, d.mo_luc, d.dong_luc, count(n.id) AS da_chon FROM dot_nhu_cau_muc d LEFT JOIN nhu_cau_muc_hoc_vien n ON n.dot_id = d.id GROUP BY d.id ORDER BY d.mo_luc DESC;"
unset DB_URL
```

## 7. Quay lui (nếu cần)

Ưu tiên **không gỡ schema**: bảng mới vô hại với code cũ (code cũ không biết đến chúng). Chỉ quay lui code: trên máy dev revert merge commit rồi push; trên VPS `cd ~/apps/boi-duong-nls && git pull origin main && cd scripts/vps && bash 06-deploy.sh`. `prisma migrate status` sau đó có thể báo migration "applied but missing" — bình thường.

**Gỡ hẳn schema** (⚠️ **mất toàn bộ dữ liệu nhu cầu đã thu**). Thứ tự: quay lui code trước, rồi **backup 2 bảng**, rồi gỡ:

```bash
export DB_URL="$(grep '^DATABASE_URL=' ~/apps/boi-duong-nls/backend/.env | cut -d= -f2- | tr -d '"' | sed 's/?.*//')"
(umask 077; pg_dump "$DB_URL" -Fc -t dot_nhu_cau_muc -t nhu_cau_muc_hoc_vien -f ~/backups/postgres/nhu-cau-muc-truoc-go-$(date +%F-%H%M).dump) && ls -lh ~/backups/postgres/ | tail -2
psql "$DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
DROP TABLE nhu_cau_muc_hoc_vien;
DROP TABLE dot_nhu_cau_muc;
DROP TYPE nguon_moc_nhu_cau;
DELETE FROM _prisma_migrations WHERE migration_name='20261020100000_dot_nhu_cau_muc';
COMMIT;
SQL
unset DB_URL
```

(`DROP TABLE` gỡ luôn index, FK, CHECK của bảng.) Nếu `migrate deploy` lúc deploy đã **thất bại giữa chừng** thì dừng, chụp log, không tự xóa gì.

**Khôi phục toàn bộ từ backup bước 1** (chỉ khi dữ liệu bị sai — mất mọi thay đổi từ lúc dump). Dump `-Fc` dùng `pg_restore`. Thứ tự **bắt buộc**:

1. `pm2 stop boiduongnls-backend`; quay lui code về commit trước deploy (`git checkout <commit-cũ>` + build).
2. Chạy khối **"Gỡ hẳn schema"** ở trên (DROP 2 bảng + type + xóa dòng `_prisma_migrations`) **TRƯỚC** `pg_restore`. Nếu không, `--clean` không DROP được PK của `dang_ky_hoc`, `khoa_boi_duong`, `lop_hoc`, `nguoi_dung` vì 2 bảng mới còn FK trỏ tới → lỗi bị bỏ qua và bản khôi phục dở dang trong khi tưởng đã xong.
3. Restore với cờ hủy-khi-lỗi:

```bash
export DB_URL="$(grep '^DATABASE_URL=' ~/apps/boi-duong-nls/backend/.env | cut -d= -f2- | tr -d '"' | sed 's/?.*//')"
pg_restore -d "$DB_URL" --clean --if-exists --single-transaction --exit-on-error ~/backups/postgres/truoc-dot-nhu-cau-<ngay-gio>.dump
pm2 start boiduongnls-backend
unset DB_URL
```

`pg_restore` báo lỗi nào → toàn bộ bị rollback (`--single-transaction`); **không** `pm2 start`, chụp log và báo lại.

## 8. Sau deploy

- [ ] Ghi commit đã deploy vào ghi chú dự án.
- [ ] Báo Quản trị: cách tạo đợt (mục 5); tính năng không đổi xếp lớp, chỉ thu nhu cầu và thống kê.
