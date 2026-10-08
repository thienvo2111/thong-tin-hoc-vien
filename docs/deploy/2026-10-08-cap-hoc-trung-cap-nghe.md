# Runbook deploy — Cấp học "Trung cấp nghề"

Đưa VPS lên `main` hiện tại (`e998a98` trở lên). Thay đổi chính:

| Commit | Nội dung | Ảnh hưởng dữ liệu |
|---|---|---|
| `e9bce92`, `e998a98` | Cấp giảng dạy **Trung cấp nghề** + môn **Các môn trung cấp nghề**; báo cáo Excel thêm cột; hồ sơ trung cấp nghề do **Sở GD&ĐT** duyệt (như THPT) | **2 migration**: thêm giá trị enum `cap_hoc` + thêm 1 dòng `mon_hoc` |

Nếu VPS còn đang chạy bản cũ hơn `021c690`, lần deploy này sẽ kéo theo các commit chưa deploy trước đó
(xem `docs/deploy/2026-10-07-doi-tuong-nhan-vien.md` — migration `nhan_vien`). `SMTP_ACCOUNTS` (xoay vòng hộp
thư, `23715df`) là tùy chọn: để trống thì vẫn gửi bằng `SMTP_USER/SMTP_PASS` như cũ.

Không có prefix API mới → **không cần chạy lại Nginx**. Không bắt buộc đổi `.env`.

Học viên đang dùng → làm **sau 22h**. Dự kiến 10 phút. Gián đoạn: backend 3–5 giây lúc `pm2 reload`.

Mọi lệnh chạy trên VPS bằng user thường. Repo: `~/apps/boi-duong-nls`.

---

## ⚠️ Cảnh báo dữ liệu

1. `20261008090000_cap_hoc_trung_cap_nghe` = `ALTER TYPE "cap_hoc" ADD VALUE IF NOT EXISTS 'trung_cap_nghe'`.
   Chỉ thêm giá trị, **không sửa/xóa dòng nào**. Không gỡ ngược được (Postgres không có `DROP VALUE`), để đó vô hại.
2. `20261008090100_mon_hoc_trung_cap_nghe` = `INSERT` 1 môn, `ON CONFLICT DO NOTHING` — chạy lại không trùng.
3. **Rủi ro khi quay lui code**: khi đã có hồ sơ chọn cấp "Trung cấp nghề", code cũ (Prisma cũ) không đọc được
   các hồ sơ/môn đó → lỗi 500. Xem mục 6.

## 1. Ghi lại trạng thái + backup

```bash
cd ~/apps/boi-duong-nls
git rev-parse --short HEAD | tee ~/truoc-deploy-$(date +%F).txt
git status --short
export DB_URL="$(grep '^DATABASE_URL=' backend/.env | cut -d= -f2- | tr -d '"' | sed 's/?.*//')"
(umask 077; pg_dump "$DB_URL" -Fc -f ~/backups/postgres/truoc-trung-cap-nghe-$(date +%F-%H%M).dump) && ls -lh ~/backups/postgres/ | tail -3
```

`git status` có file sửa trên VPS → `git stash` trước bước 2, `git stash pop` sau đó.

## 2. Kéo code + kiểm tra migration chờ

```bash
git pull origin main && git log --oneline -1          # kỳ vọng: e998a98 hoặc mới hơn
cd backend && npx prisma migrate status
```

Kỳ vọng chưa áp (có thể kèm `20261007180000_doi_tuong_nhan_vien` nếu chưa deploy lần trước):

```
20261008090000_cap_hoc_trung_cap_nghe
20261008090100_mon_hoc_trung_cap_nghe
```

Thấy migration lạ hoặc báo drift → **DỪNG**.

## 3. Deploy

```bash
cd ~/apps/boi-duong-nls/scripts/vps
bash 06-deploy.sh 2>&1 | tee ~/deploy-$(date +%F-%H%M).log
```

## 4. Kiểm tra sau deploy

```bash
cd ~/apps/boi-duong-nls/backend && npx prisma migrate status    # Database schema is up to date
psql "$DB_URL" -c "SELECT enum_range(NULL::cap_hoc);"            # có trung_cap_nghe
psql "$DB_URL" -c "SELECT ten_mon, cap_hoc FROM mon_hoc WHERE cap_hoc = 'trung_cap_nghe';"
pm2 logs boiduongnls-backend --lines 50 --nostream
```

## 5. Kiểm tra trên trình duyệt (tài khoản thử)

- [ ] Hồ sơ → Cấp giảng dạy có **Trung cấp nghề**; chọn → Môn giảng dạy hiện **Các môn trung cấp nghề**; lưu được.
- [ ] Trả tài khoản thử về cấp ban đầu.
- [ ] Quản trị → Danh sách học viên: bộ lọc cấp có "Trung cấp nghề".
- [ ] Báo cáo tổng hợp → xuất Excel có cột "Trung cấp nghề".

## 6. Quay lui (nếu cần)

```bash
psql "$DB_URL" -c "SELECT count(*) FROM hoc_vien WHERE cap_giang_day = 'trung_cap_nghe';"
```

- `0` → quay lui code thoải mái (môn `trung_cap_nghe` vẫn nằm trong `mon_hoc`; nếu code cũ lỗi khi liệt kê
  môn thì `DELETE FROM mon_hoc WHERE cap_hoc = 'trung_cap_nghe';`).
- `> 0` → **ưu tiên sửa lỗi tiến**. Quay lui bắt buộc phải đổi dữ liệu hồ sơ — hỏi lại trước khi làm.

```bash
# Máy dev: git revert e998a98 e9bce92 && git push
cd ~/apps/boi-duong-nls && git pull origin main && cd scripts/vps && bash 06-deploy.sh
```

Chỉ `pg_restore` bản dump ở bước 1 khi dữ liệu sai — mất mọi thay đổi từ lúc dump:

```bash
pm2 stop boiduongnls-backend
pg_restore -d "$DB_URL" --clean --if-exists ~/backups/postgres/truoc-trung-cap-nghe-<ngay-gio>.dump
pm2 start boiduongnls-backend
```
