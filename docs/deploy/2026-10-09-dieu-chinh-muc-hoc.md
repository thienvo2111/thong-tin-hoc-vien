# Runbook deploy — Học viên tự điều chỉnh mức lớp học

Đưa VPS lên `main` hiện tại (`b02ee5e` trở lên). Thay đổi chính:

| Commit | Nội dung | Ảnh hưởng dữ liệu |
|---|---|---|
| `d57698c` | Học viên tự chọn mức lớp học **bằng hoặc thấp hơn** mức đánh giá đầu vào; công tắc mở/khóa theo khóa (Quản trị); Quản trị sửa hộ; cảnh báo phân lớp so với mức học hiệu lực | **Migration** `20261008120000_dieu_chinh_muc_hoc`: thêm `dang_ky_hoc.muc_hoc_chon` (NULL) + `khoa_boi_duong.mo_dieu_chinh_muc` (mặc định `false`) |
| `b02ee5e` | Kết quả đầu vào + điều chỉnh mức nằm trong thẻ GĐ đánh giá (M7), hộp thoại xác nhận, hiện "Đã điều chỉnh lúc …" | **Migration** `20261008150000_muc_hoc_chon_luc`: thêm `dang_ky_hoc.muc_hoc_chon_luc` (NULL) |

Nếu VPS còn chạy bản cũ hơn, lần deploy này kéo theo các commit chưa deploy trước đó — xem
`docs/deploy/2026-10-07-doi-tuong-nhan-vien.md` (migration `nhan_vien`) và
`docs/deploy/2026-10-08-cap-hoc-trung-cap-nghe.md` (2 migration `trung_cap_nghe`). Mục 2 cho biết chính xác
migration nào còn chờ.

Route mới nằm dưới prefix đã có (`/hoc-vien`, `/dang-ky-hoc`) → **không cần chạy lại Nginx**. Không đổi `.env`.

Học viên đang dùng → làm **sau 22h**. Dự kiến 10 phút. Gián đoạn: backend 3–5 giây lúc `pm2 reload`.

Mọi lệnh chạy trên VPS bằng user thường. Repo: `~/apps/boi-duong-nls`.

---

## ⚠️ Cảnh báo dữ liệu

1. Cả 2 migration chỉ `ADD COLUMN`, **không sửa/xóa dòng nào**. Sau deploy: mọi khóa `mo_dieu_chinh_muc = false`
   (học viên chưa điều chỉnh được cho tới khi Quản trị bật), mọi đăng ký `muc_hoc_chon = NULL` → hành vi y như cũ.
2. Từ nay, **import lại `ket_qua_danh_gia` (đầu vào) với mức bằng hoặc thấp hơn mức học viên đã tự chọn sẽ xóa
   lựa chọn đó** (về học theo mức đánh giá). Import lại cùng mức cũ thì lựa chọn được giữ.
3. Quay lui code: code cũ bỏ qua 3 cột mới (Prisma chỉ đọc cột nó biết) → không lỗi, chỉ mất tính năng. Không cần
   gỡ cột. Xem mục 6.

## 1. Ghi lại trạng thái + backup

```bash
cd ~/apps/boi-duong-nls
git rev-parse --short HEAD | tee ~/truoc-deploy-$(date +%F).txt
git status --short
export DB_URL="$(grep '^DATABASE_URL=' backend/.env | cut -d= -f2- | tr -d '"' | sed 's/?.*//')"
(umask 077; pg_dump "$DB_URL" -Fc -f ~/backups/postgres/truoc-dieu-chinh-muc-$(date +%F-%H%M).dump) && ls -lh ~/backups/postgres/ | tail -3
```

`git status` có file sửa trên VPS → `git stash` trước bước 2, `git stash pop` sau đó.

## 2. Kéo code + kiểm tra migration chờ

```bash
git pull origin main && git log --oneline -1          # kỳ vọng: b02ee5e hoặc mới hơn
cd backend && npx prisma migrate status
```

Kỳ vọng chưa áp (có thể kèm `20261007180000_doi_tuong_nhan_vien`, `20261008090000_cap_hoc_trung_cap_nghe`,
`20261008090100_mon_hoc_trung_cap_nghe` nếu các lần trước chưa deploy):

```
20261008120000_dieu_chinh_muc_hoc
20261008150000_muc_hoc_chon_luc
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
psql "$DB_URL" -c "\d dang_ky_hoc" | grep -E "muc_hoc_chon"      # muc_hoc_chon, muc_hoc_chon_luc
psql "$DB_URL" -c "SELECT ma_khoa, mo_dieu_chinh_muc FROM khoa_boi_duong;"   # tất cả f
pm2 logs boiduongnls-backend --lines 50 --nostream
```

## 5. Kiểm tra trên trình duyệt

- [ ] Quản trị → chi tiết khóa: có công tắc **"Cho học viên điều chỉnh mức lớp học"** (đang tắt).
- [ ] Học viên (tài khoản thử đã có mức đầu vào) → Lớp học: kết quả đầu vào nằm trong thẻ **GĐ1 · Đánh giá đầu vào**,
      **không** có nút điều chỉnh khi công tắc tắt.
- [ ] Chỉ khi đã sẵn sàng mở cho học viên: bật công tắc → học viên thấy nút "Điều chỉnh mức lớp", chỉ liệt kê mức ≤ đánh giá,
      Lưu → hộp thoại xác nhận → hiện "Đã điều chỉnh lúc …". Nếu chỉ thử nghiệm: thử xong **trả về mức đánh giá và tắt công tắc**.

Theo dõi lựa chọn của học viên:

```bash
psql "$DB_URL" -c "SELECT muc_dau_vao, muc_hoc_chon, count(*) FROM dang_ky_hoc WHERE muc_hoc_chon IS NOT NULL GROUP BY 1,2;"
```

## 6. Quay lui (nếu cần)

Ưu tiên **tắt công tắc** ở các khóa (dừng điều chỉnh mới, giữ dữ liệu) thay vì quay lui code.

Quay lui code (cột mới để nguyên, vô hại; lựa chọn của học viên vẫn còn trong DB cho lần deploy lại):

```bash
# Máy dev: git revert -m 1 b02ee5e && git revert -m 1 d57698c && git push
cd ~/apps/boi-duong-nls && git pull origin main && cd scripts/vps && bash 06-deploy.sh
```

`prisma migrate status` sau quay lui có thể báo 2 migration "applied but missing" — bình thường, không xóa bản ghi
`_prisma_migrations`.

Chỉ `pg_restore` bản dump ở bước 1 khi dữ liệu sai — mất mọi thay đổi từ lúc dump:

```bash
pm2 stop boiduongnls-backend
pg_restore -d "$DB_URL" --clean --if-exists ~/backups/postgres/truoc-dieu-chinh-muc-<ngay-gio>.dump
pm2 start boiduongnls-backend
```
