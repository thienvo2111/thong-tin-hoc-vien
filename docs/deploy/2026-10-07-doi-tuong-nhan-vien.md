# Runbook deploy — Đối tượng nhân viên + thống kê theo trường

Đưa VPS từ `27d4493` (bản đang chạy) lên `main` hiện tại (`8bc168a` trở lên). Gồm:

| Commit | Nội dung | Ảnh hưởng dữ liệu |
|---|---|---|
| `8bc168a` | Đối tượng **Nhân viên**: chặn khảo sát đầu vào/đầu ra, hiện thông báo năm 2027 | **1 migration**: thêm giá trị enum `nhan_vien` |
| `1410cda`, `c88c40e`, `08dbe89` | Thống kê: tiến độ theo trường (+ Excel có số lượng), tỉ lệ biểu đồ NLS, kết quả theo trường | Không — chỉ đọc |
| `ea91ef5` | `POST /sso/doi-ma` trả thêm `ho_ten` | Không — chỉ thêm trường vào response |

Không có prefix API mới → **không cần chạy lại Nginx**. Không đổi `.env`.

Học viên đang dùng → làm **sau 22h**. Dự kiến 10–15 phút. Gián đoạn: backend 3–5 giây lúc `pm2 reload`.

Mọi lệnh chạy trên VPS bằng user thường, trừ khi ghi `sudo`. Repo: `~/apps/boi-duong-nls`.

---

## ⚠️ Cảnh báo dữ liệu (đọc trước)

1. **Migration `20261007180000_doi_tuong_nhan_vien`** = `ALTER TYPE "doi_tuong_hoc_vien" ADD VALUE 'nhan_vien'`.
   Chỉ thêm 1 giá trị, **không sửa/xóa dòng nào**. Hồ sơ đã chọn giáo viên / cán bộ quản lý giữ nguyên.
2. **Không gỡ ngược được** giá trị enum (Postgres không có `DROP VALUE`). Không ảnh hưởng gì nếu để đó.
3. **Rủi ro khi quay lui code**: khi đã có học viên chọn "Nhân viên", code cũ (`27d4493`) **không đọc được**
   các hồ sơ đó (Prisma cũ không biết giá trị `nhan_vien` → lỗi 500). Xem mục 7 trước khi quay lui.
4. Câu báo thiếu hồ sơ đổi thành "Chưa chọn đối tượng (giáo viên, cán bộ quản lý hoặc nhân viên)" —
   không đổi dữ liệu, không đổi trạng thái "đầy đủ" của hồ sơ nào.
5. **Không chạy** `npm run demo:thong-ke` trên VPS (script chỉ dành cho DB dev, tự từ chối DB không phải local).

---

## 1. Ghi lại trạng thái hiện tại

```bash
cd ~/apps/boi-duong-nls
git rev-parse --short HEAD | tee ~/truoc-deploy-$(date +%F).txt   # kỳ vọng: 27d4493
git status --short                                                  # kỳ vọng: trống
timedatectl | grep synchronized                                     # kỳ vọng: yes
pm2 status
```

- HEAD khác `27d4493` → **DỪNG**, danh sách migration ở bước 4 sẽ khác.
- `git status` có file sửa trên VPS (vd. `scripts/vps/00-config.sh`) → ghi lại, `git stash` trước bước 3, `git stash pop` sau đó.

## 2. Sao lưu DB thủ công

`06-deploy.sh` có tự backup trước migrate nếu đã cài `07-setup-backup.sh`, nhưng vẫn dump riêng 1 bản
định dạng `-Fc` để khôi phục nhanh.

Mật khẩu DB **lấy thẳng từ `DATABASE_URL` trong `backend/.env`** (không gõ tay, không lộ trong lịch sử lệnh).
Bỏ đuôi `?schema=public` vì đó là tham số của Prisma, `pg_dump`/`psql` không nhận. Biến `DB_URL` dùng tiếp
cho mọi lệnh `psql`/`pg_restore` bên dưới trong cùng phiên SSH:

```bash
export DB_URL="$(grep '^DATABASE_URL=' ~/apps/boi-duong-nls/backend/.env | cut -d= -f2- | tr -d '"' | sed 's/?.*//')"
```

```bash
(umask 077; pg_dump "$DB_URL" -Fc -f ~/backups/postgres/truoc-nhan-vien-$(date +%F-%H%M).dump) && ls -lh ~/backups/postgres/ | tail -3
```

File phải có dung lượng hợp lý (không 0 byte), quyền `-rw-------` (dump chứa CCCD/ngày sinh/SĐT).

## 3. Kéo code mới

```bash
cd ~/apps/boi-duong-nls
git pull origin main
git log --oneline -1                      # kỳ vọng: 8bc168a (hoặc mới hơn)
```

## 4. Kiểm tra migration đang chờ

```bash
cd ~/apps/boi-duong-nls/backend
npx prisma migrate status
```

Kỳ vọng: **đúng 1 migration chưa áp**:

```
20261007180000_doi_tuong_nhan_vien
```

Thấy migration khác hoặc báo drift → **DỪNG**.

## 5. Deploy

```bash
cd ~/apps/boi-duong-nls/scripts/vps
bash 06-deploy.sh 2>&1 | tee ~/deploy-$(date +%F-%H%M).log
```

Sau khi xong:

```bash
cd ~/apps/boi-duong-nls/backend && npx prisma migrate status   # kỳ vọng: Database schema is up to date
psql "$DB_URL" -c "SELECT enum_range(NULL::doi_tuong_hoc_vien);"   # kỳ vọng: {giao_vien,can_bo_quan_ly,nhan_vien}
pm2 logs boiduongnls-backend --lines 50 --nostream
```

## 6. Kiểm tra trên trình duyệt

Học viên (dùng tài khoản thử, **không** đổi đối tượng trên hồ sơ thật):
- [ ] Hồ sơ → mục Đối tượng có 3 lựa chọn; chọn **Nhân viên** → hiện khung thông báo "Khảo sát chưa triển khai…".
- [ ] Lưu → về Trang chính: thấy thông báo; thẻ "Khảo sát đầu vào" / "Đánh giá đầu ra" bị khóa, ghi
      "Chưa triển khai cho đối tượng nhân viên (dự kiến năm 2027)"; không có nút làm khảo sát.
- [ ] `/toi/danh-gia-dau-vao` chỉ hiện thông báo.
- [ ] Đổi lại **Giáo viên** → khối khảo sát xuất hiện lại, bấm làm bài chuyển sang trang khảo sát được (SSO).
- [ ] Trả tài khoản thử về đối tượng ban đầu.

Quản trị:
- [ ] `/admin/tong-quan`: khối "Tiến độ theo trường" hiện, nút xuất Excel tải được file có cột số lượng.

## 7. Quay lui (nếu cần)

**Trước khi chạy lại code cũ**, kiểm tra có hồ sơ nào đã chọn Nhân viên:

```bash
psql "$DB_URL" -c "SELECT count(*) FROM hoc_vien WHERE doi_tuong = 'nhan_vien';"
```

(Phiên SSH mới thì chạy lại lệnh `export DB_URL=...` ở bước 2 trước.)

- `0` → quay lui code thoải mái, không cần đụng DB.
- `> 0` → code cũ sẽ lỗi khi đọc các hồ sơ này. **Cách ưu tiên: sửa lỗi tiến (fix forward), không quay lui.**
  Nếu bắt buộc quay lui, phải **đổi dữ liệu** — hỏi lại trước khi làm, vì học viên mất lựa chọn đã chọn:
  ```sql
  -- lưu danh sách id (file ghi vào thư mục đang đứng) để khôi phục sau
  \copy (SELECT id FROM hoc_vien WHERE doi_tuong = 'nhan_vien') TO 'nhan-vien-ids.csv' CSV
  UPDATE hoc_vien SET doi_tuong = NULL WHERE doi_tuong = 'nhan_vien';
  ```
  Các hồ sơ này sẽ thành "chưa đầy đủ" (thiếu đối tượng) cho đến khi deploy lại.

Quay lui code:

```bash
# Máy dev: git revert 8bc168a && git push
cd ~/apps/boi-duong-nls && git pull origin main
cd scripts/vps && bash 06-deploy.sh
```

Chỉ khôi phục từ bản dump ở bước 2 khi **dữ liệu bị sai** — sẽ mất mọi thay đổi hồ sơ từ lúc dump:

```bash
pm2 stop boiduongnls-backend
pg_restore -d "$DB_URL" --clean --if-exists \
  ~/backups/postgres/truoc-nhan-vien-<ngay-gio>.dump
pm2 start boiduongnls-backend
```

## 8. Sau deploy

- [ ] Báo đội hệ thống khảo sát: `POST /sso/doi-ma` có thêm `ho_ten`; `vai_tro` không bao giờ là `nhan_vien`
      (nhân viên không được cấp mã).
- [ ] Ghi commit đã deploy vào ghi chú dự án.
