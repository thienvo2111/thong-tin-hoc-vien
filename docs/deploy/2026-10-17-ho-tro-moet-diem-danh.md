# Runbook deploy — Mã MOET + điểm danh trên danh sách người hỗ trợ lớp (ADR 0008 L5 sửa, L8)

> Đây là **lệnh để người vận hành tự chạy trên VPS**. Trợ lý không SSH, không deploy, không chạy lệnh trên VPS.

| Nội dung | Ảnh hưởng dữ liệu |
|---|---|
| DS lớp và DS buổi (trang + Excel) có cột **Mã MOET**. Tab **Theo buổi**: cột **Điểm danh** (có mặt/tự điểm danh lúc…, vắng, có phép, đã báo vắng, chưa điểm danh, chưa đến giờ) + dòng tổng; Excel buổi thêm "Điểm danh", "Giờ tự điểm danh". Tab **Cả lớp**: cột **Có mặt / đã diễn ra** (x/y) | **KHÔNG migration**, không đổi `.env`, không đổi Nginx. Chỉ đọc thêm `diem_danh`, `bao_vang` |

Lưu ý:
- File lớp/buổi giờ có **mã MOET** (file cụm giữ nguyên, không có).
- File Excel buổi: tiêu đề cột chuyển từ **dòng 3 xuống dòng 4** (dòng 3 là tổng điểm danh).
- Số "Có mặt / đã diễn ra" chỉ tính các buổi của lớp đang xem (theo buổi chốt nếu đổi buổi), **không** theo chế độ chuyên cần của khóa → có thể lệch dashboard với học viên đã chuyển lớp ở chế độ `cong_nhan_lop_cu`.

## 1. Ghi lại trạng thái

```bash
cd ~/apps/boi-duong-nls && git rev-parse --short HEAD | tee ~/truoc-deploy-moet-diem-danh-$(date +%F).txt && git status --short
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

- `pm2 logs boiduongnls-backend --lines 100 --nostream` không lỗi lặp lại.
- Tài khoản hỗ trợ có gắn lớp (Ctrl+F5) → **Lớp hỗ trợ** → Xem danh sách:
  - Tab **Cả lớp**: có cột Mã MOET và "Có mặt / đã diễn ra".
  - Tab **Theo buổi** → chọn buổi đã học: cột Điểm danh có màu, dòng tổng "Có mặt x · Vắng y …"; đối chiếu vài học viên với bảng điểm danh của buổi.
  - Xuất Excel lớp và buổi: mã MOET giữ số 0 đầu.

## 5. Quay lui

Revert commit tính năng trên `main`, `git pull` + `06-deploy.sh`. Không có gì cần đảo ở DB.
