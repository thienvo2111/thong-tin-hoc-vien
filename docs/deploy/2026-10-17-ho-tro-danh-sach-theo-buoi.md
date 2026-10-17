# Runbook deploy — Danh sách theo buổi cho người hỗ trợ lớp (ADR 0008 L7)

> Đây là **lệnh để người vận hành tự chạy trên VPS**. Trợ lý không SSH, không deploy, không chạy lệnh trên VPS.

| Nội dung | Ảnh hưởng dữ liệu |
|---|---|
| Trang chi tiết lớp của người hỗ trợ có tab **Theo buổi**: danh sách từng buổi = phân lớp − người đổi ra + người đổi vào (ghi chú "Đổi buổi – từ lớp X"); người đổi ra liệt kê riêng "Đã chuyển sang lớp Y – không học buổi này"; xuất Excel 1 buổi hoặc mỗi buổi 1 sheet | **KHÔNG migration**, không đổi `.env`, không đổi Nginx. Chỉ thêm API đọc + nhật ký `ho_tro_xuat_danh_sach_buoi` |

Lưu ý: người đổi vào (thuộc lớp khác) xuất hiện trong file buổi, **kể cả ngày sinh**, nhưng người hỗ trợ vẫn không mở/sửa được hồ sơ của họ.

## 1. Ghi lại trạng thái

```bash
cd ~/apps/boi-duong-nls && git rev-parse --short HEAD | tee ~/truoc-deploy-ds-buoi-$(date +%F).txt && git status --short
```

Không có migration nên không bắt buộc backup; nếu muốn chắc chắn, chạy `pg_dump` như runbook `2026-10-16-ho-tro-theo-lop.md` mục 1.

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
- Đăng nhập tài khoản hỗ trợ có gắn lớp (Ctrl+F5) → **Lớp hỗ trợ** → Xem danh sách → tab **Theo buổi** → chọn buổi có người đổi buổi: thấy badge "Đổi vào" + ghi chú, mục "Đã chuyển sang lớp khác"; **Xuất buổi này** mở được, có cột Ghi chú.

## 5. Quay lui

Revert commit tính năng trên `main`, `git pull` + `06-deploy.sh`. Không có gì cần đảo ở DB.
