# Runbook deploy — Tình hình đi học + điểm danh bổ sung (ADR 0010)

> Đây là **lệnh để người vận hành tự chạy trên VPS**. Trợ lý không SSH, không deploy, không chạy lệnh trên VPS.

| Nội dung | Ảnh hưởng dữ liệu |
|---|---|
| Menu **Tình hình đi học**: người hỗ trợ học viên (`/ho-tro/di-hoc`, phạm vi cụm + lớp được gắn) và Quản trị (`/admin/di-hoc`, toàn hệ thống). Lọc theo khóa, họ tên/mã MOET, trường (tìm qua máy chủ), cụm, lớp, có vắng, chưa điểm danh; phân trang ở máy chủ; xuất Excel đủ dòng. Bấm học viên → từng buổi + **Điểm danh bổ sung** | **KHÔNG migration**, không đổi `.env`, **không đổi Nginx** (API admin nằm dưới tiền tố có sẵn `/thong-ke/di-hoc`, API hỗ trợ dưới `/ho-tro-hoc-vien/di-hoc`). |

Main lúc này còn kèm các thay đổi đã merge nhưng có thể chưa deploy: **Nhật ký email** (`/admin/nhat-ky-email`, runbook
`2026-10-17-nhat-ky-email.md`) và **DS học viên theo buổi ở cổng giảng viên** — cả hai đều **không migration**.

## ⚠️ Lưu ý

1. **Ghi dữ liệu thật:** người hỗ trợ học viên giờ **ghi được `diem_danh`** — chỉ "Có mặt" / "Vắng có phép", buổi đã
   bắt đầu, **không giới hạn thời gian**, bắt buộc lý do. Mỗi lần ghi: `nguon = thu_cong`, `nguoi_sua`, `ghi_chu = lý do`
   và 1 dòng nhật ký `ho_tro_diem_danh_bo_sung`.
2. **Nạp lại file điểm danh Excel vẫn ghi đè** (ADR 0005) → mất phần bổ sung của buổi đó. Dặn Quản trị không nạp lại buổi
   cũ sau khi hỗ trợ đã bổ sung, hoặc đối chiếu nhật ký trước.
3. Hiệu năng đo trên dev (khóa ~7.500 đăng ký): trang đầu ~1 s, lọc "có vắng/chưa điểm danh" ~1,5–2 s, xuất Excel cả
   khóa ~3–5 s. Prod nhiều điểm danh hơn sẽ chậm hơn tương ứng.

## 1. Ghi lại trạng thái

```bash
cd ~/apps/boi-duong-nls && git rev-parse --short HEAD | tee ~/truoc-deploy-di-hoc-$(date +%F).txt && git status --short
```

Chỉ được thấy các file `backend/.env.bak-*` chưa theo dõi (bình thường). Không có migration nên không bắt buộc backup;
muốn chắc thì đếm điểm danh để so sau:

```bash
export DB_URL="$(grep '^DATABASE_URL=' backend/.env | cut -d= -f2- | tr -d '"' | sed 's/?.*//')"
psql "$DB_URL" -c "SELECT nguon, count(*) FROM diem_danh GROUP BY 1 ORDER BY 1;"
```

## 2. Kéo code + kiểm tra migration

```bash
git pull origin main && cd backend && npx prisma migrate status
```

Kỳ vọng: "Database schema is up to date". Có migration chờ → **DỪNG**.

## 3. Deploy

```bash
cd ~/apps/boi-duong-nls/scripts/vps && bash 06-deploy.sh 2>&1 | tee ~/deploy-$(date +%F-%H%M).log
```

## 4. Kiểm tra

```bash
psql "$DB_URL" -c "SELECT nguon, count(*) FROM diem_danh GROUP BY 1 ORDER BY 1;"
pm2 logs boiduongnls-backend --lines 100 --nostream
unset DB_URL
```

- Số đếm `diem_danh` **y như mục 1** (deploy không đổi dữ liệu).
- `pm2 logs` không lỗi lặp lại.
- Giao diện (Ctrl+F5):
  1. Tài khoản **hỗ trợ học viên** → menu **Tình hình đi học** → chọn khóa → thấy học viên trong cụm/lớp của mình; thử
     tìm theo mã MOET (cả khi gõ thiếu số 0 đầu) và chọn trường bằng ô tìm kiếm.
  2. Bấm 1 học viên → thấy từng buổi; **Điểm danh bổ sung** 1 buổi đã qua → nhập lý do → trạng thái đổi, hiện người
     sửa + lý do.
  3. Tài khoản **Quản trị** → **Tình hình đi học** → thấy toàn bộ; Xuất Excel mở được.

## 5. Quay lui

Revert commit tính năng trên `main`, `git pull` + `06-deploy.sh`. Các dòng điểm danh đã bổ sung **giữ nguyên** (là dữ
liệu thật, nguồn `thu_cong`); muốn rà lại: `SELECT * FROM nhat_ky_hoat_dong WHERE hanh_dong = 'ho_tro_diem_danh_bo_sung' ORDER BY thoi_gian DESC;`
