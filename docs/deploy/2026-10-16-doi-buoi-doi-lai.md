# Runbook deploy — Đổi lại đề nghị đổi buổi đã duyệt (ADR 0007 D11)

> Đây là **lệnh để người vận hành tự chạy trên VPS**. Trợ lý không SSH, không deploy, không chạy lệnh trên VPS.

Đưa VPS lên `main` có tính năng học viên **đổi lại** đề nghị đổi buổi đã duyệt. Cần deploy **sau** (hoặc cùng lúc với)
`docs/deploy/2026-10-16-doi-buoi-hoc.md`.

| Nội dung | Ảnh hưởng dữ liệu |
|---|---|
| Học viên gửi đề nghị đổi lại đè lên đề nghị đã duyệt; duyệt thì thay bản cũ, từ chối/hủy thì giữ bản cũ | **CÓ migration** `20261016170000_doi_buoi_tach_rang_buoc`: **chỉ đổi index** — `DROP INDEX uq_doi_buoi_hoat_dong`, tạo `uq_doi_buoi_cho` + `uq_doi_buoi_da_duyet` (partial unique). **Không sửa/xóa dòng nào** |

Không đổi `.env`, không đổi Nginx (prefix `doi-buoi-hoc` đã có). Dự kiến 5–10 phút. Gián đoạn: backend 3–5 giây lúc `pm2 reload`.

## ⚠️ Cảnh báo dữ liệu

1. Dữ liệu hiện có luôn thỏa 2 index mới (trước đây tối đa 1 dòng chờ|đã duyệt mỗi cặp đăng ký + buổi nguồn) →
   `CREATE UNIQUE INDEX` không thể lỗi trùng. Bảng `doi_buoi_hoc` nhỏ → khóa bảng chỉ trong tích tắc.
2. Sau deploy, duyệt một đề nghị đổi lại sẽ chuyển bản đã duyệt cũ sang `da_huy` (ghi chú "Đã thay bằng đề nghị đổi
   lại", `nguoi_xu_ly` NULL). Thống kê đếm bản này ở cột "hủy".
3. Cách đếm lượt đổi: theo **số buổi nguồn khác nhau** (trước: số dòng chờ + đã duyệt). Với dữ liệu hiện có hai cách cho
   cùng kết quả (mỗi cặp tối đa 1 dòng).

## 1. Ghi lại trạng thái + backup (TRƯỚC khi deploy)

```bash
cd ~/apps/boi-duong-nls
git rev-parse --short HEAD | tee ~/truoc-deploy-doi-lai-$(date +%F).txt
git status --short
export DB_URL="$(grep '^DATABASE_URL=' backend/.env | cut -d= -f2- | tr -d '"' | sed 's/?.*//')"
(umask 077; pg_dump "$DB_URL" -Fc -f ~/backups/postgres/truoc-doi-buoi-doi-lai-$(date +%F-%H%M).dump) && ls -lh ~/backups/postgres/ | tail -3
psql "$DB_URL" -c "SELECT trang_thai, count(*) FROM doi_buoi_hoc GROUP BY 1 ORDER BY 1;"
unset DB_URL
```

Mật khẩu lấy từ `DATABASE_URL` trong `backend/.env` (bỏ đuôi `?schema=public`) — **không** dùng `-U`.
Ghi lại kết quả đếm theo trạng thái để so sau deploy.

## 2. Kéo code + kiểm tra migration chờ

```bash
git pull origin main && git log --oneline -1
cd backend && npx prisma migrate status
```

Kỳ vọng chưa áp: `20261016170000_doi_buoi_tach_rang_buoc` (kèm `20261016120000_doi_buoi_hoc` nếu chưa deploy runbook
trước). Migration lạ hoặc báo drift → **DỪNG**.

## 3. Deploy

```bash
cd ~/apps/boi-duong-nls/scripts/vps
bash 06-deploy.sh 2>&1 | tee ~/deploy-$(date +%F-%H%M).log
```

## 4. Kiểm tra sau deploy

```bash
export DB_URL="$(grep '^DATABASE_URL=' ~/apps/boi-duong-nls/backend/.env | cut -d= -f2- | tr -d '"' | sed 's/?.*//')"
psql "$DB_URL" -c '\d doi_buoi_hoc'
psql "$DB_URL" -c "SELECT trang_thai, count(*) FROM doi_buoi_hoc GROUP BY 1 ORDER BY 1;"
pm2 logs boiduongnls-backend --lines 100 --nostream
unset DB_URL
```

- `\d doi_buoi_hoc` phải thấy 2 index mới và **không** còn `uq_doi_buoi_hoat_dong`:
  - `"uq_doi_buoi_cho" UNIQUE, btree (dang_ky_hoc_id, lich_nguon_id) WHERE trang_thai = 'cho_duyet'::trang_thai_de_nghi`
  - `"uq_doi_buoi_da_duyet" UNIQUE, btree (dang_ky_hoc_id, lich_nguon_id) WHERE trang_thai = 'da_duyet'::trang_thai_de_nghi`
- Số đếm theo trạng thái **y như mục 1** (migration không đổi dữ liệu).
- `pm2 logs` không có lỗi lặp lại.
- Thử (khóa thử): học viên có đề nghị đã duyệt thấy nút **Đổi lại**; người duyệt thấy badge **Đổi lại**.

## 5. Quay lui (nếu cần)

**Cách A — chỉ quay lui code** (khuyến nghị): revert commit trên `main`, `git pull` + `06-deploy.sh`. Index mới vẫn
chặn 2 đề nghị chờ cùng buổi nguồn, nhưng code cũ sẽ cho gửi đề nghị mới cho buổi đã duyệt (unique cũ không còn) và
duyệt nó sẽ lỗi trùng `uq_doi_buoi_da_duyet` → khi quay lui code nên làm luôn Cách B.

**Cách B — đảo index** (chỉ làm được khi **không có cặp nào có cả chờ + đã duyệt**; kiểm trước):

```bash
export DB_URL="$(grep '^DATABASE_URL=' ~/apps/boi-duong-nls/backend/.env | cut -d= -f2- | tr -d '"' | sed 's/?.*//')"
psql "$DB_URL" -c "SELECT dang_ky_hoc_id, lich_nguon_id, count(*) FROM doi_buoi_hoc WHERE trang_thai IN ('cho_duyet','da_duyet') GROUP BY 1,2 HAVING count(*) > 1;"
# Có dòng → xử lý (từ chối/hủy đề nghị đổi lại đang chờ) trước, rồi mới chạy:
psql "$DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
DROP INDEX "uq_doi_buoi_cho";
DROP INDEX "uq_doi_buoi_da_duyet";
CREATE UNIQUE INDEX "uq_doi_buoi_hoat_dong" ON "doi_buoi_hoc"("dang_ky_hoc_id", "lich_nguon_id")
    WHERE "trang_thai" IN ('cho_duyet', 'da_duyet');
DELETE FROM _prisma_migrations WHERE migration_name = '20261016170000_doi_buoi_tach_rang_buoc';
COMMIT;
SQL
unset DB_URL
```

Bản ghi đã bị thay (`da_huy`, "Đã thay bằng đề nghị đổi lại") giữ nguyên — code cũ hiển thị là "Học viên tự hủy".
