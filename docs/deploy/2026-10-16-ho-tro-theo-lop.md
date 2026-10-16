# Runbook deploy — Người hỗ trợ học viên theo lớp + xuất danh sách lớp (ADR 0008)

> Đây là **lệnh để người vận hành tự chạy trên VPS**. Trợ lý không SSH, không deploy, không chạy lệnh trên VPS.

Đưa VPS lên `main` (`ba7c595`). Gồm cả `18f6c10` (chỉ FE: link "Muốn đổi lại buổi này?") nếu VPS đang ở `d501f8c`.

| Nội dung | Ảnh hưởng dữ liệu |
|---|---|
| Quản trị gắn người hỗ trợ học viên vào **lớp** (chi tiết khóa, cột "Người hỗ trợ lớp"); người hỗ trợ có menu **Lớp hỗ trợ**: xem DS lớp, xuất Excel (1 sheet/lớp, **có ngày sinh**); tra cứu/sửa hồ sơ/mật khẩu/báo vắng/đề nghị đổi lớp cho học viên của lớp được gắn | **CÓ migration** `20261016200000_phan_cong_ho_tro_lop`: **chỉ CREATE TABLE** `phan_cong_ho_tro_lop` + 2 index + 2 FK. **Không sửa/xóa dòng nào** của bảng cũ |

Không đổi `.env`, không đổi Nginx (API mới nằm dưới prefix đã có `/ho-tro-hoc-vien`, `/khoa-boi-duong`). Dự kiến 5–10
phút. Gián đoạn: backend 3–5 giây lúc `pm2 reload`.

## ⚠️ Cảnh báo dữ liệu

1. Bảng mới rỗng sau deploy → **không ai thay đổi quyền** cho tới khi Quản trị gắn người hỗ trợ vào lớp.
2. Gắn lớp **mở rộng phạm vi** người hỗ trợ: thấy/sửa hồ sơ, cấp mật khẩu tạm, mở khóa cho mọi học viên được phân vào
   lớp đó (lớp gốc, mọi giai đoạn) — kể cả học viên ngoài cụm của họ.
3. File Excel lớp **có ngày sinh** (= mật khẩu mặc định của học viên). Dặn người hỗ trợ không chuyển file qua Zalo/nhóm
   chung. Mỗi lần xuất được ghi nhật ký `ho_tro_xuat_danh_sach_lop`.

## 1. Ghi lại trạng thái + backup (TRƯỚC khi deploy)

```bash
cd ~/apps/boi-duong-nls
git rev-parse --short HEAD | tee ~/truoc-deploy-ho-tro-lop-$(date +%F).txt
git status --short
export DB_URL="$(grep '^DATABASE_URL=' backend/.env | cut -d= -f2- | tr -d '"' | sed 's/?.*//')"
(umask 077; pg_dump "$DB_URL" -Fc -f ~/backups/postgres/truoc-ho-tro-lop-$(date +%F-%H%M).dump) && ls -lh ~/backups/postgres/ | tail -3
psql "$DB_URL" -c "SELECT (SELECT count(*) FROM phan_cong_ho_tro) pc_cum, (SELECT count(*) FROM lop_hoc) lop, (SELECT count(*) FROM nguoi_dung WHERE vai_tro='ho_tro_hoc_vien') ho_tro;"
unset DB_URL
```

Mật khẩu lấy từ `DATABASE_URL` trong `backend/.env` (bỏ đuôi `?schema=public`) — **không** dùng `-U`.
`git status --short` phải sạch; có thay đổi lạ → **DỪNG**.

## 2. Kéo code + kiểm tra migration chờ

```bash
git pull origin main && git log --oneline -1
cd backend && npx prisma migrate status
```

Kỳ vọng: HEAD = `ba7c595`, **chỉ 1** migration chưa áp: `20261016200000_phan_cong_ho_tro_lop`. Migration lạ hoặc báo
drift → **DỪNG**.

## 3. Deploy

```bash
cd ~/apps/boi-duong-nls/scripts/vps
bash 06-deploy.sh 2>&1 | tee ~/deploy-$(date +%F-%H%M).log
```

## 4. Kiểm tra sau deploy

```bash
export DB_URL="$(grep '^DATABASE_URL=' ~/apps/boi-duong-nls/backend/.env | cut -d= -f2- | tr -d '"' | sed 's/?.*//')"
psql "$DB_URL" -c '\d phan_cong_ho_tro_lop'
psql "$DB_URL" -c "SELECT (SELECT count(*) FROM phan_cong_ho_tro) pc_cum, (SELECT count(*) FROM lop_hoc) lop, (SELECT count(*) FROM nguoi_dung WHERE vai_tro='ho_tro_hoc_vien') ho_tro, (SELECT count(*) FROM phan_cong_ho_tro_lop) pc_lop;"
pm2 logs boiduongnls-backend --lines 100 --nostream
unset DB_URL
```

- `\d phan_cong_ho_tro_lop` thấy `uq_phan_cong_ho_tro_lop`, `idx_phan_cong_ho_tro_lop_lop`, 2 FK `ON DELETE CASCADE`.
- 3 số đếm đầu **y như mục 1**, `pc_lop = 0`.
- `pm2 logs` không có lỗi lặp lại.
- Thử trên UI (Ctrl+F5):
  1. Quản trị → chi tiết 1 khóa → bảng lớp có cột **Người hỗ trợ lớp** → gắn 1 tài khoản hỗ trợ vào 1 lớp Zoom.
  2. Đăng nhập tài khoản đó → menu **Lớp hỗ trợ** thấy lớp vừa gắn, sĩ số đúng → **Xem danh sách** → **Xuất Excel**
     mở được, có cột Ngày sinh, không có mã MOET/CCCD.
  3. Bấm tên 1 học viên ngoài cụm của tài khoản → mở được chi tiết.
  4. Quản trị gỡ người hỗ trợ khỏi lớp → tài khoản không còn thấy lớp; mở lại link chi tiết học viên đó → "Không tìm thấy".

## 5. Quay lui (nếu cần)

**Cách A — chỉ quay lui code** (khuyến nghị): `git revert ba7c595` trên `main`, `git pull` + `06-deploy.sh`. Bảng mới
để lại không hại gì (code cũ không đọc).

**Cách B — bỏ luôn bảng** (sau Cách A; mất các phân công lớp đã gắn):

```bash
export DB_URL="$(grep '^DATABASE_URL=' ~/apps/boi-duong-nls/backend/.env | cut -d= -f2- | tr -d '"' | sed 's/?.*//')"
psql "$DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
DROP TABLE "phan_cong_ho_tro_lop";
DELETE FROM _prisma_migrations WHERE migration_name = '20261016200000_phan_cong_ho_tro_lop';
COMMIT;
SQL
unset DB_URL
```
