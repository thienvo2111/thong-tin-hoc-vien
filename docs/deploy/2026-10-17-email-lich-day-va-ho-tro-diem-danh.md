# Runbook deploy chung — Email lịch giảng dạy (ADR 0009) + Mã MOET & điểm danh cho người hỗ trợ lớp (ADR 0008 L5/L8)

> Đây là **lệnh để người vận hành tự chạy trên VPS**. Trợ lý không SSH, không deploy, không chạy lệnh trên VPS.

Đưa VPS từ bản đang chạy (đã có tab **Theo buổi**, `423206c`) lên `main` mới nhất. Thay cho 2 runbook lẻ
`2026-10-17-ho-tro-moet-diem-danh.md` và phần triển khai trong ADR 0009.

| Tính năng | Ảnh hưởng dữ liệu |
|---|---|
| **Email lịch giảng dạy** (ADR 0009): người hỗ trợ GV có menu **Gửi lịch dạy** (`/ho-tro-gv/gui-lich-day`), chọn khóa – giai đoạn – giảng viên → bấm Gửi → mỗi giảng viên 1 email gom mọi buổi của giai đoạn (mẫu 5a, lần sau 5b "cập nhật"). Chỉ gửi khi bấm, **không cron**. | **2 migration chỉ thêm**: `20261017100000_su_kien_nhac_lich_giang_vien` (`ALTER TYPE loai_su_kien_thong_bao ADD VALUE 'nhac_lich_giang_vien'`) → `20261017100100_nhac_lich_hang_doi_email` (cột nullable `nhat_ky_nhac_lich.hang_doi_email_id` + index + FK `ON DELETE SET NULL`). Không UPDATE/DELETE dòng nào. |
| **Người hỗ trợ lớp** (ADR 0008): cột **Mã MOET** ở DS lớp + DS buổi (trang + Excel); tab **Theo buổi** có cột **Điểm danh** + dòng tổng; tab **Cả lớp** có **Có mặt / đã diễn ra**. | Không migration — chỉ đọc thêm `diem_danh`, `bao_vang`. |

Không đổi `.env`, không đổi Nginx (API mới nằm dưới prefix có sẵn `/ho-tro-giang-vien`, `/ho-tro-hoc-vien`). Dự kiến
10–15 phút. Gián đoạn: backend 3–5 giây lúc `pm2 reload`.

## ⚠️ Cảnh báo

1. **Email gửi thật** qua SMTP đang cấu hình, đi làn hàng loạt, chịu `EMAIL_DAILY_LIMIT`. Ngay sau deploy **không có
   email nào tự phát sinh** — chỉ khi người hỗ trợ GV bấm Gửi. Lần thử đầu nên gửi cho **1 giảng viên** (tốt nhất là
   email của chính mình được gắn làm giảng viên ở khóa thử).
2. `ADD VALUE` vào enum không gỡ được bằng rollback (Postgres) — để nguyên vô hại.
3. File Excel lớp/buổi của người hỗ trợ giờ có **mã MOET** (file cụm vẫn không). File buổi: tiêu đề cột chuyển từ
   dòng 3 xuống **dòng 4** (dòng 3 = tổng điểm danh).
4. "Có mặt / đã diễn ra" chỉ tính buổi của lớp đang xem (buổi chốt nếu đổi buổi), không theo chế độ chuyên cần của
   khóa → có thể lệch dashboard với học viên đã chuyển lớp ở chế độ `cong_nhan_lop_cu`.

## 1. Ghi lại trạng thái + backup (TRƯỚC khi deploy)

```bash
cd ~/apps/boi-duong-nls
git rev-parse --short HEAD | tee ~/truoc-deploy-email-lich-day-$(date +%F).txt
git status --short
export DB_URL="$(grep '^DATABASE_URL=' backend/.env | cut -d= -f2- | tr -d '"' | sed 's/?.*//')"
(umask 077; pg_dump "$DB_URL" -Fc -f ~/backups/postgres/truoc-email-lich-day-$(date +%F-%H%M).dump) && ls -lh ~/backups/postgres/ | tail -3
psql "$DB_URL" -c "SELECT (SELECT count(*) FROM nhat_ky_nhac_lich) nhac_lich, (SELECT count(*) FROM hang_doi_email) hang_doi, (SELECT count(*) FROM hang_doi_email WHERE trang_thai = 'cho_gui') hang_doi_cho_gui;"
grep -E '^(SMTP_HOST|SMTP_FROM|EMAIL_DAILY_LIMIT)=' backend/.env | sed 's/=.*/=<đã đặt>/'
unset DB_URL
```

- Mật khẩu lấy từ `DATABASE_URL` trong `backend/.env` (bỏ đuôi `?schema=public`) — **không** dùng `-U`.
- `git status --short` phải sạch; có thay đổi lạ → **DỪNG**.
- Ghi lại 3 số đếm để so sau deploy (`hang_doi_cho_gui` = email đang chờ gửi, nên gần 0).
- Dòng `SMTP_HOST` phải có giá trị (đang gửi được email kích hoạt/đặt lại mật khẩu là được). Trống → email lịch dạy
  sẽ không tới giảng viên; vẫn deploy được nhưng **không** bấm Gửi cho tới khi cấu hình SMTP.

## 2. Kéo code + kiểm tra migration chờ

```bash
git pull origin main && git log --oneline -1
cd backend && npx prisma migrate status
```

Kỳ vọng **đúng 2** migration chưa áp: `20261017100000_su_kien_nhac_lich_giang_vien`,
`20261017100100_nhac_lich_hang_doi_email`. Migration lạ hoặc báo drift → **DỪNG**.

## 3. Deploy

```bash
cd ~/apps/boi-duong-nls/scripts/vps
bash 06-deploy.sh 2>&1 | tee ~/deploy-$(date +%F-%H%M).log
```

`06-deploy.sh` tự chạy `prisma migrate deploy` (2 migration theo thứ tự, enum trước), build và `pm2 reload`.

## 4. Kiểm tra sau deploy

```bash
export DB_URL="$(grep '^DATABASE_URL=' ~/apps/boi-duong-nls/backend/.env | cut -d= -f2- | tr -d '"' | sed 's/?.*//')"
cd ~/apps/boi-duong-nls/backend && npx prisma migrate status
psql "$DB_URL" -c "SELECT unnest(enum_range(NULL::loai_su_kien_thong_bao)) AS gia_tri;" | grep nhac_lich_giang_vien
psql "$DB_URL" -c '\d nhat_ky_nhac_lich' | grep -E 'hang_doi_email_id|idx_nhac_lich_hang_doi'
psql "$DB_URL" -c "SELECT (SELECT count(*) FROM nhat_ky_nhac_lich) nhac_lich, (SELECT count(*) FROM hang_doi_email) hang_doi;"
pm2 logs boiduongnls-backend --lines 100 --nostream
unset DB_URL
```

- `migrate status`: "Database schema is up to date".
- Thấy giá trị enum `nhac_lich_giang_vien`; thấy cột `hang_doi_email_id` và index `idx_nhac_lich_hang_doi`.
- 2 số đếm **y như mục 1** (migration không đổi dữ liệu).
- `pm2 logs` không có lỗi lặp lại.

Thử trên giao diện (Ctrl+F5):

1. **Email lịch dạy** — tài khoản **hỗ trợ giảng viên** → menu **Gửi lịch dạy** → chọn khóa + giai đoạn → tích **1**
   giảng viên thử → Gửi → xác nhận. Trong vài phút giảng viên nhận email; trang hiện trạng thái gửi thành công (không phải
   `that_bai`). Giảng viên không có email → nằm trong danh sách "bỏ qua" kèm lý do, không chặn cả lô.
2. **Người hỗ trợ lớp** — tài khoản **hỗ trợ học viên** có gắn lớp → **Lớp hỗ trợ** → Xem danh sách:
   - Tab **Cả lớp**: cột Mã MOET và "Có mặt / đã diễn ra".
   - Tab **Theo buổi** → chọn buổi đã học: cột Điểm danh có màu + dòng tổng; đối chiếu vài học viên với bảng điểm danh.
   - Xuất Excel lớp và buổi: mã MOET giữ số 0 đầu.

## 5. Quay lui (nếu cần)

**Cách A — chỉ quay lui code** (khuyến nghị): checkout lại commit ở mục 1 hoặc revert trên `main`, rồi `06-deploy.sh`.
Cột/enum mới để lại vô hại với code cũ (code cũ không đọc).

**Cách B — bỏ cột** (sau Cách A; mất liên kết email ↔ nhật ký nhắc lịch đã gửi):

```bash
export DB_URL="$(grep '^DATABASE_URL=' ~/apps/boi-duong-nls/backend/.env | cut -d= -f2- | tr -d '"' | sed 's/?.*//')"
psql "$DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
DROP INDEX "idx_nhac_lich_hang_doi";
ALTER TABLE "nhat_ky_nhac_lich" DROP COLUMN "hang_doi_email_id";
DELETE FROM _prisma_migrations WHERE migration_name = '20261017100100_nhac_lich_hang_doi_email';
COMMIT;
SQL
unset DB_URL
```

Giá trị enum `nhac_lich_giang_vien` không gỡ được — để nguyên. Các dòng `nhat_ky_nhac_lich` do email tạo ra vẫn còn
(trông như nhắc qua tin nhắn với code cũ).
