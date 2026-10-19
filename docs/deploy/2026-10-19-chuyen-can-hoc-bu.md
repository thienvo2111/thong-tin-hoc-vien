# Runbook deploy — Tình hình đi học tính học bù / lớp cũ theo chuyên cần chính thức (ADR 0010 T7)

> Đây là **lệnh để người vận hành tự chạy trên VPS**. Trợ lý không SSH, không deploy, không chạy lệnh trên VPS.

| Nội dung | Ảnh hưởng dữ liệu |
|---|---|
| Tình hình đi học, cột "Có mặt / đã diễn ra" ở DS lớp, điểm danh tab **Theo buổi** và Excel buổi giờ tính bằng **đúng hàm chuyên cần của dashboard** (`tinhChuyenCan`): tính cả **học bù ở lớp khác** và **điểm danh ở lớp cũ** theo chế độ chuyên cần của khóa. Nhãn ghi nguồn "Có mặt – ở lớp X" + badge **Lớp khác**. Người hỗ trợ không bổ sung được buổi đã có mặt nhờ lớp khác | **KHÔNG migration**, không đổi `.env`, không đổi Nginx. Chỉ đổi cách đọc/tính. |

## ⚠️ Lưu ý cho người dùng

- Số **có mặt sẽ tăng** so với hôm trước ở Tình hình đi học / DS lớp (giờ đã tính học bù, lớp cũ) — **khớp dashboard**.
- Hệ thống không lưu lịch sử phân lớp nên **không phân biệt được** "học bù" với "lớp cũ" — cả hai hiện là "ở lớp X" / "Lớp khác".
- Lớp **Zoom** học bù / lớp cũ chỉ được tính khi khóa đặt chế độ **"công nhận lớp cũ"**; lớp **trực tiếp** luôn tính.
- Bảng `thong-ke` (dashboard) chỉ được tách hàm dùng chung, **không đổi kết quả**.

## 1. Ghi lại trạng thái

```bash
cd ~/apps/boi-duong-nls && git rev-parse --short HEAD | tee ~/truoc-deploy-chuyen-can-$(date +%F).txt && git status --short
```

Chỉ được thấy `backend/.env.bak-*` chưa theo dõi.

## 2. Kéo code + kiểm tra migration

```bash
git pull origin main && cd backend && npx prisma migrate status
```

Kỳ vọng: "Database schema is up to date". Có migration chờ → **DỪNG**.

## 3. Deploy

```bash
cd ~/apps/boi-duong-nls/scripts/vps && bash 06-deploy.sh 2>&1 | tee ~/deploy-$(date +%F-%H%M).log
```

Dòng `sudo: a password is required` khi reload Nginx là bình thường (bản build đã được chép vào `/var/www/boiduongnls`).

## 4. Kiểm tra

```bash
pm2 logs boiduongnls-backend --lines 50 --nostream --err
```

- Không có lỗi lặp lại.
- Giao diện (Ctrl+F5): **Tình hình đi học** → mở 1 học viên có học bù / đổi lớp → buổi đó hiện "Có mặt – ở lớp X" + badge **Lớp khác**, không còn nút Điểm danh bổ sung (với tài khoản hỗ trợ). So con số "Có mặt / đã diễn ra" của 1 học viên với chuyên cần ở dashboard → phải khớp.

## 5. Quay lui

Revert commit trên `main`, `git pull` + `06-deploy.sh`. Không có gì cần đảo ở DB.
